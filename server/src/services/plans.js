const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { saasPlans } = require('../db/schema');

/**
 * The SaaS plan catalogue.
 *
 * A tenant buys a *business* plan (Starter / Growth / Enterprise). It is
 * separate from the car wash's own membership plans (carwash-compile
 * 01-foundation/data-model.md "Membership"), which sell washes to end customers.
 *
 * A plan carries three kinds of rule:
 *   - feature flags  — which modules the business may open at all
 *   - seat limits    — how many locations / staff / customers it may have
 *   - price          — informational for now; tenant billing is out of scope
 */

const DEFAULT_PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    maxLocations: 1,
    maxStaff: 5,
    maxCustomers: 500,
    features: {
      washFloor: true,
      bookings: true,
      reports: true,
      memberships: false,
      inventory: false,
      hr: false,
      whatsapp: false,
    },
    sortOrder: 1,
  },
  {
    code: 'growth',
    name: 'Growth',
    priceMonthly: 129,
    maxLocations: 3,
    maxStaff: 25,
    maxCustomers: 5000,
    features: {
      washFloor: true,
      bookings: true,
      reports: true,
      memberships: true,
      inventory: true,
      hr: true,
      whatsapp: true,
    },
    sortOrder: 2,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 299,
    maxLocations: 25,
    maxStaff: 100,
    maxCustomers: 50000,
    features: {
      washFloor: true,
      bookings: true,
      reports: true,
      memberships: true,
      inventory: true,
      hr: true,
      whatsapp: true,
    },
    sortOrder: 3,
  },
];

// Modules that exist in every plan — they are the core product.
const CORE_FEATURES = ['washFloor', 'bookings', 'reports'];

/** Insert (or refresh) the built-in plan catalogue. */
const syncPlans = async () => {
  for (const plan of DEFAULT_PLANS) {
    const [existing] = await db.select().from(saasPlans).where(eq(saasPlans.code, plan.code));
    if (existing) {
      await db
        .update(saasPlans)
        .set({
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          maxLocations: plan.maxLocations,
          maxStaff: plan.maxStaff,
          maxCustomers: plan.maxCustomers,
          features: plan.features,
          sortOrder: plan.sortOrder,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(saasPlans.code, plan.code));
    } else {
      await db.insert(saasPlans).values(plan);
    }
  }
};

const listPlans = async () => {
  const rows = await db.select().from(saasPlans).orderBy(saasPlans.sortOrder);
  return rows.map((p) => ({ ...p, features: { ...p.features } }));
};

const getPlan = async (code) => {
  const [plan] = await db.select().from(saasPlans).where(eq(saasPlans.code, code || 'starter'));
  return plan || null;
};

/**
 * The effective feature set for a tenant: the plan's flags, with the core
 * modules always on.
 */
const featuresFor = (plan) => {
  const features = { ...(plan?.features || {}) };
  for (const key of CORE_FEATURES) features[key] = true;
  return features;
};

module.exports = {
  DEFAULT_PLANS,
  CORE_FEATURES,
  syncPlans,
  listPlans,
  getPlan,
  featuresFor,
};
