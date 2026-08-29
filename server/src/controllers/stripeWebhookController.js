// Stripe webhook handler (06-platform/integrations.md: "real-time webhook for charge
// success/failure - drives MembershipSubscription's billing-charge-failed transition
// directly"). Mounted with a raw body parser in app.js, before the global express.json()
// middleware — Stripe's signature verification needs the exact bytes it signed.
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { membershipSubscriptions } = require('../db/schema');
const { getStripe, isStripeConfigured, isWebhookConfigured } = require('../config/stripe');
const { membershipPaymentFailedDunning, membershipSuspended, membershipCancelledForNonPayment, sendMembershipWelcome } = require('../utils/automations');
const { postMembershipCharge } = require('../services/ledgerService');
const { evaluateFailedPayment, evaluateSucceededPayment } = require('../agents/membershipBillingAgent');
const { recordAgentEvent } = require('../utils/agentMetrics');
const { logAudit } = require('../utils/auditLog');

const nextMonth = (from = new Date()) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
};

const handleCheckoutCompleted = async (session) => {
  if (session.mode !== 'subscription') return;
  const { appCustomerId, appVehicleId, appPlanId, billingDayOfMonth } = session.metadata || {};
  if (!appCustomerId || !appVehicleId || !appPlanId) return;

  const [created] = await db
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
    .returning();

  logAudit({ entity: 'membership_subscription', entityId: created._id, action: 'create', actorType: 'system', actorId: 'stripe-webhook', after: created });
  await sendMembershipWelcome(created);
};

// billing-charge-failed transitions from Active, or advances the clock on an already-
// delinquent subscription (Stripe keeps retrying the same invoice, or a later cycle's
// invoice fails too) — membership-billing-agent.js's evaluateFailedPayment decides where it
// lands (past-due / suspended / cancelled) per the state machine documented on
// membershipSubscriptions in db/schema.js. Paused/cancelled subscriptions aren't touched —
// this is the non-payment path, not a status Stripe should be able to override.
const handlePaymentFailed = async (invoice) => {
  if (!invoice.subscription) return;
  const [sub] = await db
    .select()
    .from(membershipSubscriptions)
    .where(eq(membershipSubscriptions.stripeSubscriptionId, invoice.subscription));
  if (!sub || !['active', 'past-due', 'suspended'].includes(sub.status)) return;

  const decision = evaluateFailedPayment(sub);
  const [updated] = await db
    .update(membershipSubscriptions)
    .set({ ...decision, updatedAt: new Date() })
    .where(eq(membershipSubscriptions._id, sub._id))
    .returning();
  recordAgentEvent('membership-billing-agent', 'deterministic', decision.status === 'suspended' || decision.status === 'cancelled');
  logAudit({ entity: 'membership_subscription', entityId: sub._id, action: 'update', actorType: 'agent', actorId: 'membership-billing-agent', before: sub, after: updated });

  if (decision.status === 'cancelled') {
    if (sub.stripeSubscriptionId && isStripeConfigured()) {
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId).catch((err) => console.error('[stripe] cancel-for-nonpayment failed:', err.message));
    }
    await membershipCancelledForNonPayment(updated);
  } else if (decision.status === 'suspended' && sub.status !== 'suspended') {
    await membershipSuspended(updated); // only notify on the transition *into* suspended, not every retry after
  } else {
    await membershipPaymentFailedDunning(updated);
  }
};

const handlePaymentSucceeded = async (invoice) => {
  if (!invoice.subscription) return;
  const [sub] = await db
    .select()
    .from(membershipSubscriptions)
    .where(eq(membershipSubscriptions.stripeSubscriptionId, invoice.subscription));
  if (!sub) return;

  const decision = ['past-due', 'suspended'].includes(sub.status) ? evaluateSucceededPayment() : { status: sub.status, failedPaymentAttempts: 0, firstFailedAt: null };
  const [updated] = await db
    .update(membershipSubscriptions)
    .set({
      ...decision,
      washesThisCycle: 0,
      nextBillingDate: nextMonth(),
      updatedAt: new Date(),
    })
    .where(eq(membershipSubscriptions._id, sub._id))
    .returning();
  logAudit({ entity: 'membership_subscription', entityId: sub._id, action: 'update', actorType: 'agent', actorId: 'membership-billing-agent', before: sub, after: updated });

  // Auto-posting rule (05-finance/accounting.md) — posted here rather than on
  // checkout.session.completed above so a brand-new subscription's first charge is only
  // posted once: Stripe fires invoice.payment_succeeded for that first invoice too, and this
  // event carries the actual amount charged (invoice.amount_paid), not just the plan's
  // sticker price — accurate through proration, coupons, etc.
  postMembershipCharge(sub, invoice.amount_paid / 100, `Membership charge (invoice ${invoice.id})`, { actorType: 'system', actorId: 'stripe-webhook' }).catch((err) =>
    console.error('[ledger] membership charge post failed:', err.message)
  );
};

const handleSubscriptionDeleted = async (stripeSubscription) => {
  await db
    .update(membershipSubscriptions)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(membershipSubscriptions.stripeSubscriptionId, stripeSubscription.id));
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
