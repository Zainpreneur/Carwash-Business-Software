// Stripe webhook handler (06-platform/integrations.md: "real-time webhook for charge
// success/failure - drives MembershipSubscription's billing-charge-failed transition
// directly"). Mounted with a raw body parser in app.js, before the global express.json()
// middleware — Stripe's signature verification needs the exact bytes it signed.
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { membershipSubscriptions } = require('../db/schema');
const { getStripe, isStripeConfigured, isWebhookConfigured } = require('../config/stripe');
const { membershipPaymentFailedDunning, sendMembershipWelcome } = require('../utils/automations');

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

  await sendMembershipWelcome(created);
};

const handlePaymentFailed = async (invoice) => {
  if (!invoice.subscription) return;
  const [sub] = await db
    .select()
    .from(membershipSubscriptions)
    .where(eq(membershipSubscriptions.stripeSubscriptionId, invoice.subscription));
  if (!sub || sub.status !== 'active') return; // billing-charge-failed only transitions from Active

  const [updated] = await db
    .update(membershipSubscriptions)
    .set({ status: 'past-due', failedPaymentAttempts: sub.failedPaymentAttempts + 1, updatedAt: new Date() })
    .where(eq(membershipSubscriptions._id, sub._id))
    .returning();

  await membershipPaymentFailedDunning(updated);
};

const handlePaymentSucceeded = async (invoice) => {
  if (!invoice.subscription) return;
  const [sub] = await db
    .select()
    .from(membershipSubscriptions)
    .where(eq(membershipSubscriptions.stripeSubscriptionId, invoice.subscription));
  if (!sub) return;

  await db
    .update(membershipSubscriptions)
    .set({
      status: sub.status === 'past-due' ? 'active' : sub.status,
      failedPaymentAttempts: 0,
      washesThisCycle: 0,
      nextBillingDate: nextMonth(),
      updatedAt: new Date(),
    })
    .where(eq(membershipSubscriptions._id, sub._id));
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
