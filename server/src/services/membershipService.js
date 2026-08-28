// Shared enroll-membership logic (01-foundation/data-model.md) — used by both the HTTP
// endpoint (membershipController.createSubscription) and wash-concierge's
// start_membership_signup tool, so a chat-driven signup goes through the exact same Stripe/
// demo-mode path a cashier-driven one does. Throws a plain Error with a `.status` for the
// HTTP layer to map; callers that aren't HTTP (the agent) just read `.message`.
const { eq, and, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { membershipPlans, membershipSubscriptions, customers } = require('../db/schema');
const { getStripe, isStripeConfigured } = require('../config/stripe');
const { sendMembershipWelcome } = require('../utils/automations');
const { postMembershipCharge } = require('./ledgerService');

const ACTIVE_SUB_STATUSES = ['active', 'past-due', 'suspended', 'paused'];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const nextMonth = (from = new Date()) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
};

const createSubscription = async ({ customerId, vehicleId, planId, successUrl, cancelUrl }) => {
  if (!customerId || !vehicleId || !planId) {
    throw httpError(400, 'Customer, vehicle, and plan are all required');
  }

  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, planId));
  if (!plan || !plan.active) {
    throw httpError(400, 'Selected plan is unavailable');
  }

  const [existing] = await db
    .select()
    .from(membershipSubscriptions)
    .where(and(eq(membershipSubscriptions.vehicle, vehicleId), inArray(membershipSubscriptions.status, ACTIVE_SUB_STATUSES)));
  if (existing) {
    throw httpError(409, 'This vehicle already has an active membership — cancel it first to switch plans');
  }

  if (isStripeConfigured()) {
    if (!plan.stripePriceId) {
      throw httpError(400, 'This plan has no Stripe price yet — edit and re-save it while Stripe is connected');
    }
    const [customer] = await db.select().from(customers).where(eq(customers._id, customerId));
    if (!customer) {
      throw httpError(404, 'Customer not found');
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

    return { mode: 'stripe', checkoutUrl: session.url };
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
  // Demo mode simulates a successful first charge (the subscription is created 'active'
  // with no real Stripe payment) — the ledger posts the same as if it had been real, same
  // "demo mode" posture as the rest of this feature: it behaves like the real thing, it just
  // isn't backed by a real charge.
  postMembershipCharge(created, plan.monthlyPrice, `${plan.name} membership signup (demo mode)`).catch((err) =>
    console.error('[ledger] membership signup post failed:', err.message)
  );

  return { mode: 'local', subscription: created };
};

module.exports = { createSubscription, ACTIVE_SUB_STATUSES };
