const asyncHandler = require('express-async-handler');
const { and, count, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  tenants,
  tenantMembers,
  tenantSubscriptions,
  locations,
  employees,
  customers,
} = require('../db/schema');
const { runWithTenant, runAsPlatform } = require('../db/tenantDb');
const { slugify, uniqueSlug } = require('../utils/slug');
const { getPlan, featuresFor } = require('./plans');
const { onboardTenant } = require('./onboarding');

/**
 * Tenant provisioning + plan enforcement.
 */

/**
 * Create a business: the tenant record, its subscription, the owner membership
 * and the starter data (first location, bays, price list).
 *
 * Runs in platform scope — the tenant does not exist yet, so nothing can be
 * scoped to it. The starter data is created inside the new tenant's context.
 */
const createTenant = async ({
  name,
  slug,
  planCode = 'starter',
  status = 'trial',
  brandColor,
  currency,
  timezone,
  logoUrl,
  phone,
  address,
  owner,
  locationName,
  skipOnboarding = false,
}) => {
  const plan = await getPlan(planCode);
  const features = featuresFor(plan);

  const existing = await db.select({ slug: tenants.slug }).from(tenants);
  const taken = new Set(existing.map((r) => r.slug));
  const finalSlug = slug ? uniqueSlug(slugify(slug), taken) : uniqueSlug(name, taken);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: name.trim(),
      slug: finalSlug,
      status,
      plan: plan?.code || 'starter',
      brandColor: brandColor || '#0284c7',
      currency: currency || 'USD',
      timezone: timezone || 'Asia/Riyadh',
      taxRate: 0,
      phone: phone || null,
      address: address || null,
      logoUrl: logoUrl || null,
    })
    .returning();

  await db.insert(tenantSubscriptions).values({
    tenant: tenant._id,
    plan: plan?.code || 'starter',
    status: status === 'trial' ? 'trialing' : 'active',
    seats: 1,
    renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  if (owner) {
    await db.insert(tenantMembers).values({
      tenant: tenant._id,
      user: owner._id,
      role: 'owner',
      status: 'active',
      scopeAllLocations: true,
    });
  }

  const onboarded = skipOnboarding
    ? { location: null, packages: [] }
    : await runWithTenant(tenant._id, () =>
        onboardTenant({ tenantId: tenant._id, locationName, features })
      );

  return { tenant, plan: plan || null, features, location: onboarded.location };
};

/**
 * Everything the API needs to describe a business: its record, its plan, the
 * feature flags it unlocks and its subscription.
 */
const getTenantContext = async (tenant) => {
  if (!tenant) return null;
  const plan = await getPlan(tenant.plan);
  const [subscription] = await db
    .select()
    .from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenant, tenant._id));

  const features = featuresFor(plan);

  return {
    _id: tenant._id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    logoUrl: tenant.logoUrl,
    brandColor: tenant.brandColor,
    currency: tenant.currency,
    timezone: tenant.timezone,
    taxRate: tenant.taxRate,
    phone: tenant.phone,
    address: tenant.address,
    settings: tenant.settings || {},
    createdAt: tenant.createdAt,
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          maxLocations: plan.maxLocations,
          maxStaff: plan.maxStaff,
          maxCustomers: plan.maxCustomers,
        }
      : null,
    features,
    subscription: subscription
      ? {
          status: subscription.status,
          seats: subscription.seats,
          renewsAt: subscription.renewsAt,
          startedAt: subscription.startedAt,
        }
      : null,
  };
};

/** All businesses a user belongs to. */
const listUserTenants = async (userId) => {
  const rows = await db
    .select({
      _id: tenants._id,
      name: tenants.name,
      slug: tenants.slug,
      logoUrl: tenants.logoUrl,
      brandColor: tenants.brandColor,
      status: tenants.status,
      plan: tenants.plan,
      role: tenantMembers.role,
      membershipStatus: tenantMembers.status,
      scopeAllLocations: tenantMembers.scopeAllLocations,
      location: tenantMembers.location,
    })
    .from(tenantMembers)
    .leftJoin(tenants, eq(tenantMembers.tenant, tenants._id))
    .where(eq(tenantMembers.user, userId));

  return rows.filter((r) => r._id);
};

/** The locations (sites) of a business. */
const listLocations = async (tenantId) => {
  const rows = await db
    .select()
    .from(locations)
    .where(eq(locations.tenant, tenantId))
    .orderBy(locations.createdAt);
  return rows;
};

/** Count of rows in a tenant-owned table — used for plan limits. */
const countRows = async (table, tenantId) => {
  const [row] = await db
    .select({ value: count() })
    .from(table)
    .where(eq(table.tenant, tenantId));
  return Number(row?.value || 0);
};

/**
 * Throw when the business has run out of locations / staff / customers for its
 * plan. Called before creating a resource.
 */
const assertWithinLimits = async (tenant, kind, adding = 1) => {
  const plan = await getPlan(tenant.plan);
  if (!plan) return;

  const checks = {
    locations: { limit: plan.maxLocations, table: locations },
    staff: { limit: plan.maxStaff, table: employees },
    customers: { limit: plan.maxCustomers, table: customers },
  };

  const check = checks[kind];
  if (!check) return;

  const used = await countRows(check.table, tenant._id);
  if (used + adding > check.limit) {
    const label = kind === 'staff' ? 'staff accounts' : `${kind}`;
    const error = new Error(
      `Your ${plan.name} plan allows ${check.limit} ${label}. Upgrade your plan to add more.`
    );
    error.statusCode = 402;
    throw error;
  }
};

/**
 * Middleware: block a route when the business's plan does not include the
 * given feature.
 */
const requireFeature = (feature) =>
  asyncHandler(async (req, res, next) => {
    const plan = await getPlan(req.tenant?.plan);
    const features = featuresFor(plan);
    if (!features[feature]) {
      res.status(402);
      throw new Error(
        `The ${plan?.name || 'current'} plan does not include this feature. Upgrade to unlock it.`
      );
    }
    next();
  });

module.exports = {
  createTenant,
  getTenantContext,
  listUserTenants,
  listLocations,
  countRows,
  assertWithinLimits,
  requireFeature,
  runAsPlatform,
  and,
};
