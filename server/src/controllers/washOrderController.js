const asyncHandler = require('express-async-handler');
const { eq, desc, and, gte, lte, sql, count, inArray, ilike } = require('drizzle-orm');
const { db } = require('../config/db');
const { washOrders, customers, vehicles, washPackages, serviceBays, users, customerMessages } = require('../db/schema');
const { notifyRoles } = require('../utils/notify');
const { findOpenBay } = require('../utils/bays');
const { notifyReadyForPickup, checkQueueWaitAlert } = require('../utils/automations');
const { newCustomerWelcomeDayZero, creditReferralIfFirstWash } = require('../utils/growthAutomations');
const { postWashOrderCheckout, postFleetInvoiceCollection } = require('../services/ledgerService');

// wash-a-vehicle state machine (carwash-compile/01-foundation/data-model.md), kebab-cased
// to match this app's convention: Queued=queued, BayAssigned=bay-assigned, InWash=in-wash,
// QualityCheck=quality-check, ReadyForPickup=ready-for-pickup, Completed=completed,
// Cancelled=cancelled.
const NON_TERMINAL_STATUSES = ['queued', 'bay-assigned', 'in-wash', 'quality-check', 'ready-for-pickup'];

const generateOrderNumber = async () => {
  const today = new Date();
  const prefix = `WO${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const [{ total }] = await db
    .select({ total: count() })
    .from(washOrders)
    .where(ilike(washOrders.orderNumber, `${prefix}%`));
  return `${prefix}-${String(Number(total) + 1).padStart(3, '0')}`;
};

const listSelect = {
  _id: washOrders._id,
  orderNumber: washOrders.orderNumber,
  customer: { _id: customers._id, name: customers.name, phone: customers.phone },
  vehicle: {
    _id: vehicles._id,
    make: vehicles.make,
    model: vehicles.model,
    plateNumber: vehicles.plateNumber,
    type: vehicles.type,
  },
  package: {
    _id: washPackages._id,
    name: washPackages.name,
    tier: washPackages.tier,
    deliveryLane: washPackages.deliveryLane,
  },
  bay: { _id: serviceBays._id, bayNumber: serviceBays.bayNumber, bayType: serviceBays.bayType },
  assignedTechnician: { _id: users._id, name: users.name },
  bookingType: washOrders.bookingType,
  scheduledFor: washOrders.scheduledFor,
  queuePosition: washOrders.queuePosition,
  queuedAt: washOrders.queuedAt,
  bayAssignedAt: washOrders.bayAssignedAt,
  washStartedAt: washOrders.washStartedAt,
  washCompletedAt: washOrders.washCompletedAt,
  checkedOutAt: washOrders.checkedOutAt,
  status: washOrders.status,
  qcResult: washOrders.qcResult,
  price: washOrders.price,
  paymentMethod: washOrders.paymentMethod,
  promoCode: washOrders.promoCode,
  createdAt: washOrders.createdAt,
};

const baseQuery = () =>
  db
    .select(listSelect)
    .from(washOrders)
    .leftJoin(customers, eq(washOrders.customer, customers._id))
    .innerJoin(vehicles, eq(washOrders.vehicle, vehicles._id))
    .innerJoin(washPackages, eq(washOrders.package, washPackages._id))
    .leftJoin(serviceBays, eq(washOrders.bay, serviceBays._id))
    .leftJoin(users, eq(washOrders.assignedTechnician, users._id));

const getWashOrders = asyncHandler(async (req, res) => {
  const { status, active, bay, date, customer, page = 1, limit = 50 } = req.query;
  const filters = [];
  // RBAC (carwash-compile/01-foundation/dashboards.md, Bay Attendant): "my queue today"
  // only, not the full order history — staff can never pull completed/cancelled orders
  // through this endpoint, regardless of what status/active they request. Site-manager-
  // level history (the /wash-queue "show completed & cancelled" view) is admin/manager only.
  if (req.user.role === 'staff') {
    // A specific non-terminal status (e.g. the Checkout page's ready-for-pickup) still
    // narrows the result; a terminal one is silently denied by falling back to "all active".
    filters.push(
      status && NON_TERMINAL_STATUSES.includes(status)
        ? eq(washOrders.status, status)
        : inArray(washOrders.status, NON_TERMINAL_STATUSES)
    );
  } else {
    if (status) filters.push(eq(washOrders.status, status));
    if (active === 'true') filters.push(inArray(washOrders.status, NON_TERMINAL_STATUSES));
  }
  if (bay) filters.push(eq(washOrders.bay, bay));
  if (customer) filters.push(eq(washOrders.customer, customer));
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filters.push(and(gte(washOrders.queuedAt, start), lte(washOrders.queuedAt, end)));
  }
  const where = filters.length ? and(...filters) : undefined;

  const rows = await baseQuery()
    .where(where)
    .orderBy(desc(washOrders.queuedAt))
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit));

  const [{ total }] = await db.select({ total: count() }).from(washOrders).where(where);
  res.json({ data: rows, total: Number(total), page: Number(page), pages: Math.ceil(Number(total) / Number(limit)) });
});

// Cashier home-view tile (dashboards.md): "today's revenue split (membership vs.
// pay-per-wash vs. fleet)". Buckets today's completed wash orders by paymentMethod.
const getCheckoutStats = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const rows = await db
    .select({ paymentMethod: washOrders.paymentMethod, price: washOrders.price })
    .from(washOrders)
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, start), lte(washOrders.checkedOutAt, end)));

  const split = { membership: 0, payPerWash: 0, fleet: 0 };
  for (const r of rows) {
    if (r.paymentMethod === 'membership') split.membership += r.price;
    else if (r.paymentMethod === 'fleet-invoice') split.fleet += r.price;
    else split.payPerWash += r.price;
  }

  res.json({
    checkedOutToday: rows.length,
    totalRevenue: split.membership + split.payPerWash + split.fleet,
    split,
  });
});

// Audit trail for the notify-ready-for-pickup automation — what each firing decided to send,
// since there's no real WhatsApp transport yet to show a delivered message. admin/manager
// only (customer contact history, not a floor-staff concern).
const getCustomerMessages = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: customerMessages._id,
      customer: { _id: customers._id, name: customers.name },
      washOrder: { _id: washOrders._id, orderNumber: washOrders.orderNumber },
      channel: customerMessages.channel,
      template: customerMessages.template,
      automation: customerMessages.automation,
      status: customerMessages.status,
      error: customerMessages.error,
      createdAt: customerMessages.createdAt,
    })
    .from(customerMessages)
    .innerJoin(customers, eq(customerMessages.customer, customers._id))
    .leftJoin(washOrders, eq(customerMessages.washOrder, washOrders._id))
    .orderBy(desc(customerMessages.createdAt))
    .limit(100);
  res.json(rows);
});

const getWashOrder = asyncHandler(async (req, res) => {
  const [row] = await baseQuery().where(eq(washOrders._id, req.params.id));
  if (!row) {
    res.status(404);
    throw new Error('Wash order not found');
  }
  res.json(row);
});

const createWashOrder = asyncHandler(async (req, res) => {
  const { customer, vehicle, package: packageId, price, paymentMethod, bookingType, scheduledFor, promoCode } =
    req.body;

  if (!vehicle) {
    res.status(400);
    throw new Error('A vehicle is required');
  }
  if (!packageId) {
    res.status(400);
    throw new Error('A wash package is required');
  }

  const [pkg] = await db.select().from(washPackages).where(eq(washPackages._id, packageId));
  if (!pkg || !pkg.active) {
    res.status(400);
    throw new Error('Selected wash package is unavailable');
  }
  if (price === undefined || price === null || price === '') {
    res.status(400);
    throw new Error('A price is required (auto-priced by vehicle tier, or quoted manually)');
  }

  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(washOrders)
    .where(inArray(washOrders.status, NON_TERMINAL_STATUSES));

  const orderNumber = await generateOrderNumber();

  const [order] = await db
    .insert(washOrders)
    .values({
      orderNumber,
      customer: customer || null,
      vehicle,
      package: packageId,
      bookingType: bookingType || 'walk-in',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      queuePosition: Number(activeCount) + 1,
      queuedAt: new Date(),
      status: 'queued',
      price: Number(price),
      paymentMethod: paymentMethod || 'cash',
      promoCode: promoCode || null,
      createdBy: req.user._id,
    })
    .returning();

  notifyRoles(
    ['admin', 'manager', 'staff'],
    {
      type: 'wash_order_created',
      title: 'Vehicle queued',
      message: `${orderNumber} logged for ${pkg.name} — queue position ${order.queuePosition}`,
    },
    req.user._id
  ).catch(() => {});
  checkQueueWaitAlert(req.user._id).catch(() => {});

  const [full] = await baseQuery().where(eq(washOrders._id, order._id));
  res.status(201).json(full);
});

// Loads a wash order and enforces the state machine — sets res.status and throws when the
// order is missing (404) or not in an allowed state for the requested transition (409).
const requireStatus = async (res, id, expected) => {
  const [order] = await db.select().from(washOrders).where(eq(washOrders._id, id));
  if (!order) {
    res.status(404);
    throw new Error('Wash order not found');
  }
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(order.status)) {
    res.status(409);
    throw new Error(`Wash order is "${order.status}" — expected ${allowed.join(' or ')}`);
  }
  return order;
};

const respondUpdated = async (res, id) => {
  const [full] = await baseQuery().where(eq(washOrders._id, id));
  res.json(full);
};

// bay-assigned: queue-dispatch-agent step, done manually here (auto-assign next open bay
// matching the package's lane) with an optional explicit bayId override.
const assignBay = asyncHandler(async (req, res) => {
  const order = await requireStatus(res, req.params.id, 'queued');
  const [pkg] = await db.select().from(washPackages).where(eq(washPackages._id, order.package));
  const laneBayType = pkg.deliveryLane === 'detail-bay' ? 'detail-bay' : 'tunnel-conveyor';

  let bay;
  if (req.body.bayId) {
    [bay] = await db.select().from(serviceBays).where(eq(serviceBays._id, req.body.bayId));
    if (!bay || bay.operationalStatus !== 'operational') {
      res.status(400);
      throw new Error('Selected bay is not operational');
    }
  } else {
    bay = await findOpenBay(laneBayType);
  }

  if (!bay) {
    checkQueueWaitAlert(req.user._id).catch(() => {});
    res.status(409);
    throw new Error('No bay available right now — vehicle stays queued. Escalate to site manager for overflow.');
  }

  await db
    .update(washOrders)
    .set({ bay: bay._id, status: 'bay-assigned', bayAssignedAt: new Date(), updatedAt: new Date() })
    .where(eq(washOrders._id, order._id));
  checkQueueWaitAlert(req.user._id).catch(() => {});

  await respondUpdated(res, order._id);
});

const startWash = asyncHandler(async (req, res) => {
  const order = await requireStatus(res, req.params.id, 'bay-assigned');
  await db
    .update(washOrders)
    .set({
      status: 'in-wash',
      washStartedAt: new Date(),
      // Whoever starts the wash is recorded as the assigned technician — this column
      // existed since Phase 1 but nothing ever set it until now (03-operations/hr.md's
      // detail-technician commission and the analytics cube's technician-throughput report
      // both key off it).
      assignedTechnician: order.assignedTechnician || req.user._id,
      updatedAt: new Date(),
    })
    .where(eq(washOrders._id, order._id));
  await respondUpdated(res, order._id);
});

const completeWash = asyncHandler(async (req, res) => {
  const order = await requireStatus(res, req.params.id, 'in-wash');
  await db
    .update(washOrders)
    .set({ status: 'quality-check', washCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(washOrders._id, order._id));
  await respondUpdated(res, order._id);
});

// qc-passed -> ready-for-pickup ; qc-failed-rework -> back to in-wash, no extra charge
// (deliberate loop, not a shortcut to ready-for-pickup — see data-model.md).
const qualityCheck = asyncHandler(async (req, res) => {
  const { result } = req.body;
  if (!['pass', 'fail'].includes(result)) {
    res.status(400);
    throw new Error('result must be "pass" or "fail"');
  }
  const order = await requireStatus(res, req.params.id, 'quality-check');
  const nextStatus = result === 'pass' ? 'ready-for-pickup' : 'in-wash';
  await db
    .update(washOrders)
    .set({ status: nextStatus, qcResult: result, updatedAt: new Date() })
    .where(eq(washOrders._id, order._id));

  if (result === 'pass') {
    notifyRoles(
      ['admin', 'manager', 'staff'],
      { type: 'wash_order_ready', title: 'Ready for pickup', message: `${order.orderNumber} passed QC — ready for pickup.` },
      req.user._id
    ).catch(() => {});
    notifyReadyForPickup(order).catch(() => {}); // notify-ready-for-pickup automation
  }

  await respondUpdated(res, order._id);
});

const checkout = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;
  const order = await requireStatus(res, req.params.id, 'ready-for-pickup');

  await db
    .update(washOrders)
    .set({
      status: 'completed',
      checkedOutAt: new Date(),
      paymentMethod: paymentMethod || order.paymentMethod,
      updatedAt: new Date(),
    })
    .where(eq(washOrders._id, order._id));

  await db.update(vehicles).set({ lastWashAt: new Date(), updatedAt: new Date() }).where(eq(vehicles._id, order.vehicle));

  if (order.customer) {
    const [customerBefore] = await db.select().from(customers).where(eq(customers._id, order.customer));
    const isFirstEverWash = customerBefore?.visitCount === 0;

    const [updatedCustomer] = await db
      .update(customers)
      .set({
        totalSpent: sql`${customers.totalSpent} + ${order.price}`,
        visitCount: sql`${customers.visitCount} + 1`,
        loyaltyPoints: sql`${customers.loyaltyPoints} + ${Math.floor(order.price / 10)}`,
        updatedAt: new Date(),
      })
      .where(eq(customers._id, order.customer))
      .returning();

    // new-customer-welcome day 0 + referral crediting (04-growth/marketing.md) — both key
    // off this being the customer's first-ever completed wash.
    if (isFirstEverWash && updatedCustomer) {
      newCustomerWelcomeDayZero(updatedCustomer, order).catch((err) => console.error('[growth] new-customer-welcome failed:', err.message));
      creditReferralIfFirstWash(updatedCustomer).catch((err) => console.error('[growth] referral credit failed:', err.message));
    }
  }

  notifyRoles(
    ['admin', 'manager', 'staff'],
    {
      type: 'wash_order_completed',
      title: `${order.orderNumber} checked out`,
      message: `Checked out for $${Number(order.price).toFixed(2)} (${paymentMethod || order.paymentMethod}).`,
    },
    req.user._id
  ).catch(() => {});

  // Auto-posting rule (05-finance/accounting.md) — checkout is the spec's own first example
  // of a workflow step that moves money.
  postWashOrderCheckout({ ...order, paymentMethod: paymentMethod || order.paymentMethod }).catch((err) =>
    console.error('[ledger] wash order checkout post failed:', err.message)
  );

  await respondUpdated(res, order._id);
});

// AR collection (02-intelligence/analytics.md's AR Aging report needs a "collected" event to
// age against, which nothing in this app posted before this phase — see ledgerService's
// postFleetInvoiceCollection header comment).
const collectFleetInvoice = asyncHandler(async (req, res) => {
  const [order] = await db.select().from(washOrders).where(eq(washOrders._id, req.params.id));
  if (!order) {
    res.status(404);
    throw new Error('Wash order not found');
  }
  if (order.paymentMethod !== 'fleet-invoice') {
    res.status(400);
    throw new Error('Only fleet-invoice orders can be marked collected');
  }
  if (order.fleetInvoiceCollectedAt) {
    res.status(400);
    throw new Error('Already marked collected');
  }
  const [updated] = await db
    .update(washOrders)
    .set({ fleetInvoiceCollectedAt: new Date(), updatedAt: new Date() })
    .where(eq(washOrders._id, order._id))
    .returning();
  postFleetInvoiceCollection(order).catch((err) => console.error('[ledger] fleet invoice collection post failed:', err.message));
  res.json(updated);
});

const cancelWashOrder = asyncHandler(async (req, res) => {
  const order = await requireStatus(res, req.params.id, ['queued', 'bay-assigned']);
  await db
    .update(washOrders)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(washOrders._id, order._id));
  checkQueueWaitAlert(req.user._id).catch(() => {});
  await respondUpdated(res, order._id);
});

const deleteWashOrder = asyncHandler(async (req, res) => {
  const deleted = await db.delete(washOrders).where(eq(washOrders._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Wash order not found');
  }
  res.json({ message: 'Wash order removed' });
});

module.exports = {
  getWashOrders,
  getCheckoutStats,
  getCustomerMessages,
  getWashOrder,
  createWashOrder,
  assignBay,
  startWash,
  completeWash,
  qualityCheck,
  checkout,
  collectFleetInvoice,
  cancelWashOrder,
  deleteWashOrder,
};
