import { eq } from 'drizzle-orm';
import type { Database } from './client.js';

/** Any table that carries a `tenant` column. */
export type TenantScopedTable = {
  tenant: unknown;
};

/**
 * Tenant-scoped query helpers.
 *
 * The original Express app used a Proxy that rewrote every Drizzle query to add
 * `tenant_id = <active>` and stamp inserts. That magic is hard to type safely, so
 * this Hono-era version exposes explicit, typed helpers instead: every call site
 * must pass the tenant id, and the helpers add the filter for you.
 *
 * For defence-in-depth, also enable libSQL/Turso per-tenant database isolation
 * (one database per business) and/or Postgres-style RLS is not available on SQLite —
 * so explicit scoping + unique indexes + audit logs remain the guard rails.
 */
export function createTenantDb(db: Database, tenantId: string) {
  return {
    /** Scope a SELECT/UPDATE/DELETE query builder to the active tenant. */
    scope<T extends { where: (cond: unknown) => T }>(table: TenantScopedTable, qb: T): T {
      return qb.where(eq((table as { tenant: Parameters<typeof eq>[0] }).tenant, tenantId));
    },

    /** Stamp a row with the active tenant before inserting. */
    stamp<T extends Record<string, unknown>>(values: T): T & { tenant: string } {
      return { ...values, tenant: tenantId };
    },

    /** Shorthand: select from a tenant table already filtered. */
    table<T extends TenantScopedTable>(table: T) {
      return table;
    },

    tenantId,
    raw: db,
  };
}

export type TenantDb = ReturnType<typeof createTenantDb>;
