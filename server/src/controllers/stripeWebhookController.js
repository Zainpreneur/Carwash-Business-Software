// Stripe webhook handler (06-platform/integrations.md: "real-time webhook for charge
// success/failure - drives MembershipSubscription's billing-charge-failed transition
// directly"). Mounted with a raw body parser in app.js, before the global express.json()
// middleware — Stripe's signature verification needs the exact bytes it signed.
//
// Stripe calls this without a session, so the handler has to work out which business
// (tenant) each event belongs to and then run the actual work inside that tenant's
// context — otherwise a membership change would be written against the wrong data.
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  membershipSubscriptions,
  membershipPlans,
  customers,
  vehicles,
} = require('../db/schema');
const { runAsPlatform, runWithTenant } = require('../db/tenantDb');
const { getStripe, isStripeConfigured, isWebhookConfigured } = require('../config/stripe');
const {
  membershipPaymentFailedDunning,
  membershipSuspended,
  membershipCancelledForNonPayment,
  sendMembershipWelcome,
} = require('../utils/automations');

// Membership billing state machine (was the deterministic portion of the cut
// membership-billing-agent): 3 failed attempts or 7 days unresolved -> suspended,
// 30 days unresolved -> cancelled. No I/O, pure decision functions.
const SUSPEND_AFTER_ATTEMPTS = 3;
const SUSPEND_AFTER_DAYS = 7;
const CANCEL_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const nextMonth = (from = new Date()) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
};

const evaluateFailedPayment = (subscription, now = new Date()) => {
  const attempts = (subscription.failedPaymentAttempts || 0) + 1;
  const firstFailedAt = subscription.firstFailedAt || now;
  const daysUnresolved = (now - firstFailedAt) / DAY_MS;

  if (subscription.status === 'suspended') {
    if (daysUnresolved >= CANCEL_AFTER_DAYS) {
      return { status: 'cancelled', failedPaymentAttempts: attempts, firstFailedAt };
    }
    return { status: 'suspended', failedPaymentAttempts: attempts, firstFailedAt };
  }

  if (attempts >= SUSPEND_AFTER_ATTEMPTS || daysUnresolved >= SUSPEND_AFTER_DAYS) {
    return { status: 'suspended', failedPaymentAttempts: attempts, firstFailedAt };
  }
  return { status: 'past-due', failedPaymentAttempts: attempts, firstFailedAt };
};

const evaluateSucceededPayment = () => ({ status: 'active', failedPaymentAttempts: 0, firstFailedAt: null });

/** Find the business a Stripe customer/plan belongs to (cross-tenant lookup). */
const tenantOfCustomer = async (customerId) => {
  const [customer] = await runAsPlatform(() =>
    db.select().from(customers).where(eq(customers._id, customerId))
  );
  return customer?.tenant || null;
};

const handleCheckoutCompleted = async (session) => {
  if (session.mode !== 'subscription') return;
  const { appCustomerId, appVehicleId, appPlanId, appTenantId, billingDayOfMonth } =
    session.metadata || {};
  if (!appCustomerId || !appVehicleId || !appPlanId) return;

  const tenantId = appTenantId || (await tenantOfCustomer(appCustomerId));
  if (!tenantId) return;

  const created = await runWithTenant(tenantId, () =>
    db
      .insert(membershipSubscriptions)
      .values({
        customer: appCustomerId,
        vehicle: appVehicleId,
        plan: appPlanId,
        billingDayOfMonth: Number(billingDayOfMonth) || new Date().getDate(),
        nextBillingDate: nextMonth(),
        status: 'active',
        stripeSubscriptionId: session.subscription,
      })
      .returning()
  );

  if (created) await runWithTenant(tenantId, () => sendMembershipWelcome(created));
};

// billing-charge-failed transitions from Active, or advances the clock on an already-
// delinquent subscription (Stripe keeps retrying the same invoice, or a later cycle's
// invoice fails too) — membership-billing-agent.js's evaluateFailedPayment decides where it
// lands (past-due / suspended / cancelled) per the state machine documented on
// membershipSubscriptions in db/schema.js. Paused/cancelled subscriptions aren't touched —
// this is the non-payment path, not a status Stripe should be able to override.
const handlePaymentFailed = async (invoice) => {
  if (!invoice.subscription) return;

  const sub = await runAsPlatform(async () => {
    const [row] = await db
      .select()
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.stripeSubscriptionId, invoice.subscription));
    return row;
  });
  if (!sub || !['active', 'past-due', 'suspended'].includes(sub.status)) return;

  const decision = evaluateFailedPayment(sub);
  const updated = await runWithTenant(sub.tenant, () =>
    db
      .update(membershipSubscriptions)
      .set({ ...decision, updatedAt: new Date() })
      .where(eq(membershipSubscriptions._id, sub._id))
      .returning()
  );

  if (decision.status === 'cancelled') {
    if (sub.stripeSubscriptionId && isStripeConfigured()) {
      await getStripe()
        .subscriptions.cancel(sub.stripeSubscriptionId)
        .catch((err) => console.error('[stripe] cancel-for-nonpayment failed:', err.message));
    }
    await runWithTenant(sub.tenant, () => membershipCancelledForNonPayment(updated));
  } else if (decision.status === 'suspended' && sub.status !== 'suspended') {
    // only notify on the transition *into* suspended, not every retry after
    await runWithTenant(sub.tenant, () => membershipSuspended(updated));
  } else {
    await runWithTenant(sub.tenant, () => membershipPaymentFailedDunning(updated));
  }
};

const handlePaymentSucceeded = async (invoice) => {
  if (!invoice.subscription) return;

  const sub = await runAsPlatform(async () => {
    const [row] = await db
      .select()
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.stripeSubscriptionId, invoice.subscription));
    return row;
  });
  if (!sub) return;

  const decision = ['past-due', 'suspended'].includes(sub.status)
    ? evaluateSucceededPayment()
    : { status: sub.status, failedPaymentAttempts: 0, firstFailedAt: null };

  await runWithTenant(sub.tenant, () =>
    db
      .update(membershipSubscriptions)
      .set({
        ...decision,
        washesThisCycle: 0,
        nextBillingDate: nextMonth(),
        updatedAt: new Date(),
      })
      .where(eq(membershipSubscriptions._id, sub._id))
  );
};

const handleSubscriptionDeleted = async (stripeSubscription) => {
  const rows = await runAsPlatform(async () => {
    const found = await db
      .select()
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.stripeSubscriptionId, stripeSubscription.id));
    return found;
  });

  for (const row of rows) {
    await runWithTenant(row.tenant, () =>
      db
        .update(membershipSubscriptions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(membershipSubscriptions._id, row._id))
    );
  }
};

const handleStripeWebhook = async (req, res) => {
  if (!isStripeConfigured() || !isWebhookConfigured()) {
    return res.status(501).json({ message: 'Stripe is not configured on this server' });
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        break; // ignore event types we don't act on
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err.message);
    // Acknowledge anyway — Stripe retries on non-2xx, and this is a bug we want to fix, not
    // Stripe hammering us with retries for it.
    res.json({ received: true, handlerError: err.message });
  }
};

module.exports = { handleStripeWebhook };
