const asyncHandler = require('express-async-handler');
const { eq, and } = require('drizzle-orm');
const { db } = require('../config/db');
const { membershipPlans, membershipSubscriptions, customers, vehicles } = require('../db/schema');
const { getStripe, isStripeConfigured } = require('../config/stripe');
const membershipService = require('../services/membershipService');

const ACTIVE_SUB_STATUSES = ['active', 'past-due', 'suspended', 'paused'];

// ---------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------

const getPlans = asyncHandler(async (req, res) => {
  const { active } = req.query;
  const rows =
    active !== undefined
      ? await db.select().from(membershipPlans).where(eq(membershipPlans.active, active === 'true'))
      : await db.select().from(membershipPlans);
  res.json(rows);
});

const getPlan = asyncHandler(async (req, res) => {
  const [row] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, req.params.id));
  if (!row) {
    res.status(404);
    throw new Error('Membership plan not found');
  }
  res.json(row);
});

// Best-effort Stripe Product+Price sync — a failure here never blocks saving the plan
// locally; the plan just stays without a stripePriceId until it's re-saved once Stripe
// is reachable. Prices are immutable in Stripe, so a price change mints a new Price object.
const syncStripePrice = async (plan) => {
  if (!isStripeConfigured()) return null;
  try {
    const stripe = getStripe();
    const product = await stripe.products.create({ name: plan.name, metadata: { appPlanId: plan._id } });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.monthlyPrice * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    return price.id;
  } catch (err) {
    console.error('[stripe] price sync failed:', err.message);
    return null;
  }
};

const createPlan = asyncHandler(async (req, res) => {
  const { tier, name, coveredPackage, monthlyPrice, isUnlimited, washesPerMonthCap, rolloverAllowed, active } =
    req.body;
  const [created] = await db
    .insert(membershipPlans)
    .values({
      tier,
      name,
      coveredPackage,
      monthlyPrice: Number(monthlyPrice),
      isUnlimited: isUnlimited !== false,
      washesPerMonthCap: washesPerMonthCap || null,
      rolloverAllowed: !!rolloverAllowed,
      active: active !== false,
    })
    .returning();

  const stripePriceId = await syncStripePrice(created);
  if (stripePriceId) {
    await db.update(membershipPlans).set({ stripePriceId }).where(eq(membershipPlans._id, created._id));
    created.stripePriceId = stripePriceId;
  }
  res.status(201).json(created);
});

const updatePlan = asyncHandler(async (req, res) => {
  const [existing] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, req.params.id));
  if (!existing) {
    res.status(404);
    throw new Error('Membership plan not found');
  }
  const { tier, name, coveredPackage, monthlyPrice, isUnlimited, washesPerMonthCap, rolloverAllowed, active } =
    req.body;
  const updates = { updatedAt: new Date() };
  if (tier !== undefined) updates.tier = tier;
  if (name !== undefined) updates.name = name;
  if (coveredPackage !== undefined) updates.coveredPackage = coveredPackage;
  if (monthlyPrice !== undefined) updates.monthlyPrice = Number(monthlyPrice);
  if (isUnlimited !== undefined) updates.isUnlimited = isUnlimited;
  if (washesPerMonthCap !== undefined) updates.washesPerMonthCap = washesPerMonthCap || null;
  if (rolloverAllowed !== undefined) updates.rolloverAllowed = rolloverAllowed;
  if (active !== undefined) updates.active = active;

  if (updates.monthlyPrice !== undefined && updates.monthlyPrice !== existing.monthlyPrice) {
    const stripePriceId = await syncStripePrice({ ...existing, ...updates });
    if (stripePriceId) updates.stripePriceId = stripePriceId;
  }

  const [updated] = await db
    .update(membershipPlans)
    .set(updates)
    .where(eq(membershipPlans._id, existing._id))
    .returning();
  res.json(updated);
});

const deletePlan = asyncHandler(async (req, res) => {
  const deleted = await db.delete(membershipPlans).where(eq(membershipPlans._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Membership plan not found');
  }
  res.json({ message: 'Membership plan removed' });
});

// ---------------------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------------------

const listSelect = {
  _id: membershipSubscriptions._id,
  customer: { _id: customers._id, name: customers.name, phone: customers.phone },
  vehicle: { _id: vehicles._id, make: vehicles.make, model: vehicles.model, plateNumber: vehicles.plateNumber },
  plan: {
    _id: membershipPlans._id,
    name: membershipPlans.name,
    tier: membershipPlans.tier,
    monthlyPrice: membershipPlans.monthlyPrice,
  },
  billingDayOfMonth: membershipSubscriptions.billingDayOfMonth,
  nextBillingDate: membershipSubscriptions.nextBillingDate,
  pausedUntil: membershipSubscriptions.pausedUntil,
  washesThisCycle: membershipSubscriptions.washesThisCycle,
  failedPaymentAttempts: membershipSubscriptions.failedPaymentAttempts,
  status: membershipSubscriptions.status,
  stripeSubscriptionId: membershipSubscriptions.stripeSubscriptionId,
  createdAt: membershipSubscriptions.createdAt,
};

const baseSubQuery = () =>
  db
    .select(listSelect)
    .from(membershipSubscriptions)
    .innerJoin(customers, eq(membershipSubscriptions.customer, customers._id))
    .innerJoin(vehicles, eq(membershipSubscriptions.vehicle, vehicles._id))
    .innerJoin(membershipPlans, eq(membershipSubscriptions.plan, membershipPlans._id));

const getSubscriptions = asyncHandler(async (req, res) => {
  const { customer, status } = req.query;
  const filters = [];
  if (customer) filters.push(eq(membershipSubscriptions.customer, customer));
  if (status) filters.push(eq(membershipSubscriptions.status, status));
  const where = filters.length ? and(...filters) : undefined;
  const rows = await baseSubQuery().where(where).orderBy(membershipSubscriptions.createdAt);
  res.json(rows);
});

// enroll-membership workflow (01-foundation/data-model.md): cashier captures vehicle plate
// + payment token -> creates MembershipSubscription (Active) -> welcome message. Shared with
// wash-concierge's start_membership_signup tool via services/membershipService.js, so a
// chat-driven signup goes through the exact same Stripe/demo-mode path a cashier-driven one
// does — see that module for the Stripe Checkout Session vs. local-demo-record logic.
const createSubscription = asyncHandler(async (req, res) => {
  const { customer: customerId, vehicle: vehicleId, plan: planId, successUrl, cancelUrl } = req.body;
  try {
    const result = await membershipService.createSubscription({ customerId, vehicleId, planId, successUrl, cancelUrl });
    res.status(result.mode === 'stripe' ? 200 : 201).json(result);
  } catch (err) {
    res.status(err.status || 500);
    throw err;
  }
});

const requireSubStatus = async (res, id, expected) => {
  const [sub] = await db.select().from(membershipSubscriptions).where(eq(membershipSubscriptions._id, id));
  if (!sub) {
    res.status(404);
    throw new Error('Membership subscription not found');
  }
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(sub.status)) {
    res.status(409);
    throw new Error(`Subscription is "${sub.status}" — expected ${allowed.join(' or ')}`);
  }
  return sub;
};

const pauseSubscription = asyncHandler(async (req, res) => {
  const sub = await requireSubStatus(res, req.params.id, 'active');
  const { pausedUntil } = req.body;

  if (sub.stripeSubscriptionId && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.update(sub.stripeSubscriptionId, { pause_collection: { behavior: 'void' } });
    } catch (err) {
      console.error('[stripe] pause failed:', err.message);
    }
  }

  const [updated] = await db
    .update(membershipSubscriptions)
    .set({ status: 'paused', pausedUntil: pausedUntil ? new Date(pausedUntil) : null, updatedAt: new Date() })
    .where(eq(membershipSubscriptions._id, sub._id))
    .returning();
  res.json(updated);
});

const resumeSubscription = asyncHandler(async (req, res) => {
  const sub = await requireSubStatus(res, req.params.id, 'paused');

  if (sub.stripeSubscriptionId && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.update(sub.stripeSubscriptionId, { pause_collection: '' });
    } catch (err) {
      console.error('[stripe] resume failed:', err.message);
    }
  }

  const [updated] = await db
    .update(membershipSubscriptions)
    .set({ status: 'active', pausedUntil: null, updatedAt: new Date() })
    .where(eq(membershipSubscriptions._id, sub._id))
    .returning();
  res.json(updated);
});

// "active (paid manually)" — the state machine's own third way out of past-due/suspended,
// for a customer who pays at the counter (cash/card) instead of Stripe successfully
// retrying. Doesn't touch Stripe at all — if a real subscription is attached, whatever
// happens there next (another retry, its own dunning) is independent of this app's own
// record now reading active again.
const markPaidManually = asyncHandler(async (req, res) => {
  const sub = await requireSubStatus(res, req.params.id, ['past-due', 'suspended']);
  const [updated] = await db
    .update(membershipSubscriptions)
    .set({ status: 'active', failedPaymentAttempts: 0, firstFailedAt: null, updatedAt: new Date() })
    .where(eq(membershipSubscriptions._id, sub._id))
    .returning();
  res.json(updated);
});

// "Cancellation itself is allowed autonomously" per the spec's WhatsApp conversational-flow
// table — no approval gate here for a customer- or staff-initiated cancel.
const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await requireSubStatus(res, req.params.id, ACTIVE_SUB_STATUSES);

  if (sub.stripeSubscriptionId && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (err) {
      console.error('[stripe] cancel failed:', err.message);
    }
  }

  const [updated] = await db
    .update(membershipSubscriptions)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(membershipSubscriptions._id, sub._id))
    .returning();
  res.json(updated);
});

module.exports = {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  getSubscriptions,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  markPaidManually,
  cancelSubscription,
};
