// Deterministic "always do X when Y" automations for the primary wash lifecycle
// (carwash-compile/03-operations/automations.md). Only the 3 scoped to WashOrder/ServiceBay
// are implemented here — the rest depend on entities not yet built (MembershipSubscription,
// Stock, MaintenanceOrder, Shift, Invoice, Ticket). Anything requiring judgment (real bay-
// dispatch rebalancing, telemetry drift detection) is explicitly an AI agent in the spec,
// not an automation — bay-down-reroute here uses the same deterministic auto-assign logic
// as a manual bay assignment as a stand-in for the future queue-dispatch-agent.
const { eq, and, inArray, gte, count } = require('drizzle-orm');
const { db } = require('../config/db');
const { washOrders, washPackages, serviceBays, customers, customerMessages, notifications } = require('../db/schema');
const { notifyRoles } = require('./notify');
const { findOpenBay } = require('./bays');

const NON_TERMINAL_STATUSES = ['queued', 'bay-assigned', 'in-wash', 'quality-check', 'ready-for-pickup'];

// notify-ready-for-pickup: WashOrder QualityCheck -> ReadyForPickup, condition
// customer.whatsappOptIn == true, action send-whatsapp `wash-ready`. No real WhatsApp
// integration yet (needs Meta Business credentials — a later deployment-guide phase), so
// this logs the decision to customer_messages instead of silently doing nothing; anonymous
// walk-ins (no customer) and opted-out customers are silently skipped, matching the
// workflow's own "not a hard failure" handling.
const notifyReadyForPickup = async (order) => {
  if (!order.customer) return;
  const [customer] = await db.select().from(customers).where(eq(customers._id, order.customer));
  if (!customer || !customer.whatsappOptIn) return;
  await db.insert(customerMessages).values({
    customer: customer._id,
    washOrder: order._id,
    channel: 'whatsapp',
    template: 'wash-ready',
    automation: 'notify-ready-for-pickup',
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

  await notifyRoles(
    ['admin', 'manager'],
    {
      type: 'queue_wait_alert',
      title: 'Queue backing up',
      message: `${queueLength} vehicles queued — predicted wait ~${predictedWaitMinutes} min. Consider overflow staffing.`,
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

module.exports = { notifyReadyForPickup, checkQueueWaitAlert, handleBayDown };
