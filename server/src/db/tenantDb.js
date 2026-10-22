/**
 * Tenant-aware data access.
 *
 * Every business table in this schema is owned by exactly one tenant. Rather than
 * trusting ~200 individual queries to remember `WHERE tenant_id = ?`, this module
 * wraps the Drizzle client so isolation is enforced *structurally*:
 *
 *   - SELECT / UPDATE / DELETE on a tenant-owned table automatically get
 *     `tenant_id = <active tenant>` ANDed into their WHERE clause.
 *   - INSERT into a tenant-owned table automatically gets `tenant_id` stamped.
 *   - UPDATE / DELETE without a WHERE clause on a tenant-owned table is refused.
 *   - A tenant-scoped query executed outside a tenant context throws instead of
 *     silently reading every tenant's rows.
 *
 * The active tenant comes from AsyncLocalStorage, so it is request-scoped and
 * cannot be spoofed by a client-supplied parameter.
 *
 * Controllers therefore keep using `db` exactly as before — they simply become
 * tenant-safe for free.
 */

const { AsyncLocalStorage } = require('async_hooks');
const { and, eq } = require('drizzle-orm');
const schema = require('./schema');

// Tables whose rows belong to exactly one tenant. These are the ones that get
// automatic scoping. Platform tables (tenants, users, tenant_members, ...) are
// deliberately NOT in this list: they are looked up across tenants (login,
// invite acceptance, platform admin) and are always filtered explicitly.
const TENANT_SCOPED_TABLES = new Set([
  schema.locations,
  schema.auditLogs,
  schema.customers,
  schema.vehicles,
  schema.services,
  schema.bookings,
  schema.bookingServices,
  schema.expenses,
  schema.notifications,
  schema.washPackages,
  schema.packagePricing,
  schema.serviceBays,
  schema.washOrders,
  schema.customerMessages,
  schema.membershipPlans,
  schema.membershipSubscriptions,
  schema.tickets,
  schema.ticketComments,
  schema.employees,
  schema.shifts,
  schema.leaveRequests,
  schema.suppliers,
  schema.supplies,
  schema.locationStock,
  schema.packageSupplyUsage,
  schema.purchaseOrders,
  schema.purchaseOrderLines,
  schema.stockAdjustments,
]);

// Tables that can be narrowed to a single site (branch) of a multi-location
// business. Tenancy is automatic; location narrowing is an explicit choice made
// by the controller (a manager may want every location at once).
const LOCATION_SCOPED_TABLES = new Set([
  schema.serviceBays,
  schema.washOrders,
  schema.bookings,
  schema.shifts,
  schema.employees,
  schema.expenses,
  schema.tickets,
  schema.locationStock,
  schema.purchaseOrders,
  schema.stockAdjustments,
]);

const tenantContext = new AsyncLocalStorage();

/** The active request's tenant context, or null outside a tenant request. */
const getContext = () => tenantContext.getStore() || null;

/** The active tenant id, or null. */
const getTenantId = () => getContext()?.tenantId ?? null;

/** The active location (site) id, or null when the request spans all sites. */
const getLocationId = () => getContext()?.locationId ?? null;

/** True when running with platform (SaaS operator) privileges — no tenant filter. */
const isPlatformScope = () => getContext()?.platform === true;

/**
 * Run `fn` inside a tenant context. Everything the function touches is scoped to
 * `tenantId` automatically.
 */
const runWithTenant = (tenantId, fn, extra = {}) =>
  tenantContext.run({ tenantId, platform: false, locationId: null, ...extra }, fn);

/**
 * Run `fn` with platform privileges (SaaS operator). Tenant-scoped queries run
 * unfiltered — only use this for cross-tenant operations such as signup,
 * tenant provisioning and the platform console.
 */
const runAsPlatform = (fn) => tenantContext.run({ tenantId: null, platform: true }, fn);

/**
 * Explicit tenant predicate for the rare query that needs to reach across
 * tenants (platform console, onboarding).
 */
const tenantEq = (table, tenantId) => eq(table.tenant, tenantId);

/**
 * Explicit location predicate. Returns undefined when no location is selected,
 * which Drizzle treats as "no filter".
 */
const locationEq = (table, locationId) => (locationId ? eq(table.location, locationId) : undefined);

// ---------------------------------------------------------------------------
// Scoped client
// ---------------------------------------------------------------------------

const noContextError = (op) =>
  new Error(
    `Tenant-scoped ${op} ran outside a tenant context. Wrap it in runWithTenant() ` +
      `(or runAsPlatform() if it is genuinely a cross-tenant operation).`
  );

const isBuilder = (value) =>
  !!value &&
  typeof value === 'object' &&
  (typeof value.execute === 'function' ||
    typeof value.from === 'function' ||
    typeof value.set === 'function');

/** Resolve the tenant predicate for a query, or null when the query isn't tenant-scoped. */
const tenantPredicateFor = (state) => {
  const table = state.tables.find((t) => TENANT_SCOPED_TABLES.has(t));
  if (!table) return null;
  const tenantId = getTenantId();
  if (!tenantId) {
    if (isPlatformScope()) return null;
    throw noContextError(state.mode.toUpperCase());
  }
  return eq(table.tenant, tenantId);
};

/** AND a user-supplied WHERE with the tenant predicate. */
const applyTenantScope = (state, condition) => {
  const predicate = tenantPredicateFor(state);
  if (!predicate) return condition;
  return and(predicate, condition);
};

/** AND a join's ON clause with the tenant predicate of the joined table. */
const applyJoinScope = (table, on) => {
  if (!TENANT_SCOPED_TABLES.has(table)) return on;
  const tenantId = getTenantId();
  if (!tenantId) {
    if (isPlatformScope()) return on;
    throw noContextError('JOIN');
  }
  return and(eq(table.tenant, tenantId), on);
};

/** Stamp `tenant` on inserted rows so callers can't forget it. */
const applyInsertScope = (state, values) => {
  const table = state.tables[0];
  if (!table || !TENANT_SCOPED_TABLES.has(table)) return values;
  const tenantId = getTenantId();
  if (!tenantId) {
    if (isPlatformScope()) return values;
    throw noContextError('INSERT');
  }
  const stamp = (row) =>
    row && typeof row === 'object' && !Array.isArray(row) && row.tenant === undefined
      ? { ...row, tenant: tenantId }
      : row;
  return Array.isArray(values) ? values.map(stamp) : stamp(values);
};

/**
 * Guarantee the query is filtered before it runs. Selects that never called
 * `.where()` still get the tenant predicate; updates and deletes without any
 * `.where()` are refused outright (they would hit every tenant's rows).
 */
const ensureScoped = (target, state) => {
  if (state.scoped) return;

  // Inserts are stamped with the tenant, not filtered by it.
  if (state.mode === 'insert') return;

  if (state.mode === 'update' || state.mode === 'delete') {
    const table = state.tables[0];
    if (table && TENANT_SCOPED_TABLES.has(table)) {
      throw new Error(
        `Refusing to run a ${state.mode.toUpperCase()} on a tenant-owned table without a .where() clause.`
      );
    }
    return;
  }

  const predicate = tenantPredicateFor(state);
  if (!predicate) return;
  target.where(predicate);
  state.scoped = true;
};

const EXECUTION_METHODS = new Set(['then', 'all', 'get', 'execute', 'run', 'values', 'getSQL']);

/**
 * Wrap a Drizzle query builder so tenant scoping is applied transparently.
 */
const wrapBuilder = (builder, state) =>
  new Proxy(builder, {
    get(target, prop) {
      if (prop === 'where') {
        return (condition) => {
          state.scoped = true;
          return wrapBuilder(target.where(applyTenantScope(state, condition)), state);
        };
      }

      if (prop === 'from') {
        return (table) => {
          state.tables.push(table);
          return wrapBuilder(target.from(table), state);
        };
      }

      if (prop === 'leftJoin' || prop === 'innerJoin' || prop === 'rightJoin' || prop === 'fullJoin') {
        return (table, on) => {
          state.tables.push(table);
          return wrapBuilder(target[prop](table, applyJoinScope(table, on)), state);
        };
      }

      if (prop === 'values' && state.mode === 'insert') {
        return (values) => wrapBuilder(target.values(applyInsertScope(state, values)), state);
      }

      if (EXECUTION_METHODS.has(prop)) {
        return (...args) => {
          ensureScoped(target, state);
          const result = target[prop](...args);
          return isBuilder(result) ? wrapBuilder(result, state) : result;
        };
      }

      const value = Reflect.get(target, prop, target);
      if (typeof value === 'function') {
        return (...args) => {
          const result = value.apply(target, args);
          return isBuilder(result) ? wrapBuilder(result, state) : result;
        };
      }
      return value;
    },
  });

/**
 * Wrap the raw Drizzle client in a tenant-scoped client.
 */
const createTenantDb = (rawDb) =>
  new Proxy(rawDb, {
    get(target, prop) {
      if (prop === 'select' || prop === 'selectDistinct') {
        return (...args) =>
          wrapBuilder(target[prop](...args), { mode: 'select', tables: [], scoped: false });
      }

      if (prop === 'insert') {
        return (table) =>
          wrapBuilder(target.insert(table), { mode: 'insert', tables: [table], scoped: false });
      }

      if (prop === 'update') {
        return (table) =>
          wrapBuilder(target.update(table), { mode: 'update', tables: [table], scoped: false });
      }

      if (prop === 'delete') {
        return (table) =>
          wrapBuilder(target.delete(table), { mode: 'delete', tables: [table], scoped: false });
      }

      const value = Reflect.get(target, prop, target);
      if (typeof value === 'function') return value.bind(target);
      return value;
    },
  });

module.exports = {
  TENANT_SCOPED_TABLES,
  LOCATION_SCOPED_TABLES,
  createTenantDb,
  getContext,
  getTenantId,
  getLocationId,
  isPlatformScope,
  runWithTenant,
  runAsPlatform,
  tenantEq,
  locationEq,
};
