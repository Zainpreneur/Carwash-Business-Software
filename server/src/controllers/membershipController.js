const asyncHandler = require('express-async-handler');
const { eq, and, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { membershipPlans, membershipSubscriptions, customers, vehicles } = require('../db/schema');
const { getStripe, isStripeConfigured } = require('../config/stripe');
const { sendMembershipWelcome } = require('../utils/automations');

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

const nextMonth = (from = new Date()) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
};

// enroll-membership workflow (01-foundation/data-model.md): cashier captures vehicle plate
// + payment token -> creates MembershipSubscription (Active) -> welcome message. With
// Stripe configured, "payment token capture" is a hosted Stripe Checkout Session — this app
// never collects a raw card number, per the spec's own paymentMethodToken PII rule — and
// the subscription itself is created by the webhook once payment is actually confirmed, not
// here. Without Stripe, it's created directly as a local demo record with no real billing.
const createSubscription = asyncHandler(async (req, res) => {
  const { customer: customerId, vehicle: vehicleId, plan: planId, successUrl, cancelUrl } = req.body;
  if (!customerId || !vehicleId || !planId) {
    res.status(400);
    throw new Error('Customer, vehicle, and plan are all required');
  }

  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, planId));
  if (!plan || !plan.active) {
    res.status(400);
    throw new Error('Selected plan is unavailable');
  }

  const [existing] = await db
    .select()
    .from(membershipSubscriptions)
    .where(and(eq(membershipSubscriptions.vehicle, vehicleId), inArray(membershipSubscriptions.status, ACTIVE_SUB_STATUSES)));
  if (existing) {
    res.status(409);
    throw new Error('This vehicle already has an active membership — cancel it first to switch plans');
  }

  if (isStripeConfigured()) {
    if (!plan.stripePriceId) {
      res.status(400);
      throw new Error('This plan has no Stripe price yet — edit and re-save it while Stripe is connected');
    }
    const [customer] = await db.select().from(customers).where(eq(customers._id, customerId));
    if (!customer) {
      res.status(404);
      throw new Error('Customer not found');
    }

    const stripe = getStripe();
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || undefined,
        metadata: { appCustomerId: customer._id },
      });
      stripeCustomerId = stripeCustomer.id;
      await db.update(customers).set({ stripeCustomerId, updatedAt: new Date() }).where(eq(customers._id, customer._id));
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: successUrl || `${process.env.CLIENT_URL || ''}/checkout?membership=success`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL || ''}/checkout?membership=cancelled`,
      metadata: {
        appCustomerId: customerId,
        appVehicleId: vehicleId,
        appPlanId: planId,
        billingDayOfMonth: String(new Date().getDate()),
      },
    });

    return res.json({ mode: 'stripe', checkoutUrl: session.url });
  }

  // No Stripe connected — create the subscription locally so the feature is demoable.
  const [created] = await db
    .insert(membershipSubscriptions)
    .values({
      customer: customerId,
      vehicle: vehicleId,
      plan: planId,
      billingDayOfMonth: new Date().getDate(),
      nextBillingDate: nextMonth(),
      status: 'active',
    })
    .returning();

  sendMembershipWelcome(created).catch(() => {});

  res.status(201).json({ mode: 'local', subscription: created });
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
  cancelSubscription,
};
