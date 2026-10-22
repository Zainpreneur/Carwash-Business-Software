// Deterministic "always do X when Y" automations (carwash-compile/03-operations/automations.md).
// Only the 4 scoped to WashOrder/ServiceBay/MembershipSubscription are implemented — the rest
// depend on entities not yet built (Stock, MaintenanceOrder, Shift, Invoice, Ticket) or a job
// scheduler (the -3d/-2h reminders). Anything requiring judgment (real bay-dispatch
// rebalancing, telemetry drift detection) is explicitly an AI agent in the spec, not an
// automation — bay-down-reroute here uses the same deterministic auto-assign logic as a
// manual bay assignment as a stand-in for the future queue-dispatch-agent.
const { eq, and, inArray, gte, count } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  washOrders,
  washPackages,
  serviceBays,
  vehicles,
  customers,
  customerMessages,
  notifications,
  membershipSubscriptions,
  membershipPlans,
} = require('../db/schema');
const { notifyRoles } = require('./notify');
const { findOpenBay } = require('./bays');
const { sendWhatsAppTemplate } = require('./whatsapp');

const NON_TERMINAL_STATUSES = ['queued', 'bay-assigned', 'in-wash', 'quality-check', 'ready-for-pickup'];

// Sends (or, if WhatsApp isn't configured, attempts and logs the outcome of) a template
// message and records it to customer_messages either way — the shared plumbing every
// customer-facing automation in this file uses.
const sendAndLog = async (customer, { washOrderId, template, automation, params }) => {
  const result = await sendWhatsAppTemplate(customer.phone, template, params);
  await db.insert(customerMessages).values({
    customer: customer._id,
    washOrder: washOrderId || null,
    channel: 'whatsapp',
    template,
    automation,
    status: result.status,
    error: result.error || null,
  });
  return result;
};

// notify-ready-for-pickup: WashOrder QualityCheck -> ReadyForPickup, condition
// customer.whatsappOptIn == true, action send-whatsapp `wash-ready`. Anonymous walk-ins (no
// customer) and opted-out customers are silently skipped, matching the workflow's own "not
// a hard failure" handling.
const notifyReadyForPickup = async (order) => {
  if (!order.customer) return;
  const [customer] = await db.select().from(customers).where(eq(customers._id, order.customer));
  if (!customer || !customer.whatsappOptIn) return;
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles._id, order.vehicle));
  const [bay] = order.bay ? await db.select().from(serviceBays).where(eq(serviceBays._id, order.bay)) : [];

  await sendAndLog(customer, {
    washOrderId: order._id,
    template: 'wash-ready',
    automation: 'notify-ready-for-pickup',
    params: { customerName: customer.name, vehiclePlate: vehicle?.plateNumber, bayNumber: bay?.bayNumber },
  });
};

// membership-payment-failed-dunning: MembershipSubscription Active -> PastDue, action
// send-whatsapp `payment-failed-update-card` (the escalation ladder past WhatsApp — email,
// then a phone-line-agent callback — needs channels this app doesn't have yet, so this
// covers the first rung only). Called from the Stripe webhook handler on invoice.payment_failed.
const membershipPaymentFailedDunning = async (subscription) => {
  const [customer] = await db.select().from(customers).where(eq(customers._id, subscription.customer));
  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, subscription.plan));
  if (!customer) return;

  if (customer.whatsappOptIn) {
    await sendAndLog(customer, {
      template: 'payment-failed-update-card',
      automation: 'membership-payment-failed-dunning',
      params: { customerName: customer.name, planName: plan?.name, updateLink: '(update via Settings)' },
    });
  }

  await notifyRoles(['owner', 'admin', 'manager'], {
    type: 'membership_payment_failed',
    title: 'Membership payment failed',
    message: `${customer.name}'s ${plan?.name || 'membership'} payment failed (attempt ${subscription.failedPaymentAttempts}).`,
  });
};

// Suspend/cancel-for-nonpayment transitions (the membership-billing lifecycle in
// stripeWebhookController.js). No WhatsApp send here — 04-growth/whatsapp.md's template
// table doesn't define one for either event (only `payment-failed-update-card`, sent above
// on every retry up to this point), so this is staff-facing only rather than inventing a
// template the spec never specified.
const membershipSuspended = async (subscription) => {
  const [customer] = await db.select().from(customers).where(eq(customers._id, subscription.customer));
  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, subscription.plan));
  await notifyRoles(['owner', 'admin', 'manager'], {
    type: 'membership_suspended',
    title: 'Membership suspended',
    message: `${customer?.name || 'A customer'}'s ${plan?.name || 'membership'} was suspended after unresolved payment failures.`,
  });
};

const membershipCancelledForNonPayment = async (subscription) => {
  const [customer] = await db.select().from(customers).where(eq(customers._id, subscription.customer));
  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, subscription.plan));
  await notifyRoles(['owner', 'admin', 'manager'], {
    type: 'membership_cancelled_nonpayment',
    title: 'Membership cancelled (non-payment)',
    message: `${customer?.name || 'A customer'}'s ${plan?.name || 'membership'} was cancelled after 30 days unresolved.`,
  });
};

// queue-wait-alert: fires when queueLength > 8 or predictedWaitMinutes > 20, notifying
// site-manager-equivalent roles. Deduped to at most one alert per 15-minute window so it
// doesn't refire on every single queue-changing request while the condition still holds.
const checkQueueWaitAlert = async (actorUserId) => {
  const queued = await db
    .select({ package: washOrders.package })
    .from(washOrders)
    .where(eq(washOrders.status, 'queued'));
  const queueLength = queued.length;
  if (queueLength === 0) return;

  const packageIds = [...new Set(queued.map((o) => o.package))];
  const packages = await db.select().from(washPackages).where(inArray(washPackages._id, packageIds));
  const avgCycle = packages.length
    ? packages.reduce((sum, p) => sum + p.avgCycleTimeMinutes, 0) / packages.length
    : 15;

  const openBays = await db
    .select({ count: count() })
    .from(serviceBays)
    .where(eq(serviceBays.operationalStatus, 'operational'));
  const bayCount = Math.max(Number(openBays[0]?.count) || 1, 1);

  const predictedWaitMinutes = Math.ceil((queueLength / bayCount) * avgCycle);
  if (queueLength <= 8 && predictedWaitMinutes <= 20) return;

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const [{ recentCount }] = await db
    .select({ recentCount: count() })
    .from(notifications)
    .where(and(eq(notifications.type, 'queue_wait_alert'), gte(notifications.createdAt, fifteenMinAgo)));
  if (Number(recentCount) > 0) return;

  // The spec's own escalation guardrail is specifically ">25 min predicted wait" (a deeper
  // backup than the >20 min alert threshold above). The 15-minute dedup above stands in for
  // the spec's "3 consecutive vehicles" condition — in practice a sustained backup keeps
  // re-triggering past that window, a transient one doesn't.
  const recommendation = `${queueLength} vehicles queued — predicted wait ~${predictedWaitMinutes} min. Consider overflow staffing.`;

  await notifyRoles(
    ['admin', 'manager'],
    {
      type: 'queue_wait_alert',
      title: 'Queue backing up',
      message: recommendation,
    },
    actorUserId
  );
};

// bay-down-reroute: ServiceBay.operationalStatus -> down. Orders not yet started
// (bay-assigned) are rerouted to another open bay in the same lane, or requeued if none is
// free. Orders already mid-wash/QC on that bay can't be safely moved — those are escalated
// to site-manager instead, per the spec's own "skipped if already failed/unsafe" carve-out.
const handleBayDown = async (bay, actorUserId) => {
  const affected = await db
    .select()
    .from(washOrders)
    .where(and(eq(washOrders.bay, bay._id), inArray(washOrders.status, NON_TERMINAL_STATUSES)));

  let rerouted = 0;
  let requeued = 0;
  let midServiceCount = 0;

  for (const order of affected) {
    if (order.status !== 'bay-assigned') {
      midServiceCount += 1;
      continue;
    }
    const [pkg] = await db.select().from(washPackages).where(eq(washPackages._id, order.package));
    const laneBayType = pkg?.deliveryLane === 'detail-bay' ? 'detail-bay' : 'tunnel-conveyor';
    const nextBay = await findOpenBay(laneBayType, { excludeBayId: bay._id });

    if (nextBay) {
      await db
        .update(washOrders)
        .set({ bay: nextBay._id, bayAssignedAt: new Date(), updatedAt: new Date() })
        .where(eq(washOrders._id, order._id));
      rerouted += 1;
    } else {
      await db
        .update(washOrders)
        .set({ bay: null, status: 'queued', bayAssignedAt: null, updatedAt: new Date() })
        .where(eq(washOrders._id, order._id));
      requeued += 1;
    }
  }

  const parts = [`Bay ${bay.bayNumber} marked down.`];
  if (rerouted) parts.push(`${rerouted} order(s) rerouted to another bay.`);
  if (requeued) parts.push(`${requeued} order(s) sent back to the queue — no open bay in that lane.`);
  if (midServiceCount) parts.push(`${midServiceCount} order(s) already mid-service on it need manual attention.`);

  await notifyRoles(
    ['admin', 'manager'],
    { type: 'bay_down', title: `Bay ${bay.bayNumber} is down`, message: parts.join(' ') },
    actorUserId
  );
};

// enroll-membership workflow's final step: "wash-concierge sends welcome message with
// plate-verification explainer" (data-model.md). Called once a MembershipSubscription is
// actually Active — either immediately (no-Stripe demo mode) or from the Stripe webhook
// once checkout.session.completed confirms real payment.
const sendMembershipWelcome = async (subscription) => {
  const [customer] = await db.select().from(customers).where(eq(customers._id, subscription.customer));
  if (!customer || !customer.whatsappOptIn) return;
  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, subscription.plan));

  await sendAndLog(customer, {
    template: 'membership-welcome',
    automation: 'enroll-membership',
    params: {
      customerName: customer.name,
      planName: plan?.name,
      billingDate: subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toDateString() : undefined,
    },
  });
};

module.exports = {
  notifyReadyForPickup,
  checkQueueWaitAlert,
  handleBayDown,
  membershipPaymentFailedDunning,
  membershipSuspended,
  membershipCancelledForNonPayment,
  sendMembershipWelcome,
  sendAndLog,
};
