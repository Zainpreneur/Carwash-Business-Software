// Partner API v1 (06-platform/api-webhooks.md) — the exposed-entity table's four
// read/create operations. Deliberately does NOT expose Employee, JournalEntry, or Payment
// detail, per the spec's own "deliberately not exposed" list; Stock here means the `supplies`
// table (this app's real inventory entity, matching Stock's spirit — on-hand quantity by
// item — even though the schema's own name is `supplies`, from the inventory phase).
//
// fleet-account-readonly's scoping mirrors the real human fleet-account-manager ABAC
// (server/src/utils/employeeScope.js) but narrower: a partner key belongs to one specific
// fleet customer (`req.apiKey.fleetCustomer`), not "every fleet account" the way a human
// fleet-account-manager staff member sees the whole fleet segment — "a fleet partner's API
// key sees only its own account's records," per the spec's own text.
const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { washOrders, customers, membershipSubscriptions, supplies, washPackages } = require('../db/schema');

const scopeToOwnFleetCustomer = (req) => (req.apiKey.scope === 'fleet-account-readonly' ? req.apiKey.fleetCustomer : null);

const getWashOrders = asyncHandler(async (req, res) => {
  const ownCustomer = scopeToOwnFleetCustomer(req);
  const rows = await db
    .select()
    .from(washOrders)
    .where(ownCustomer ? eq(washOrders.customer, ownCustomer) : undefined)
    .limit(200);
  res.json({ data: rows });
});

const createWashOrder = asyncHandler(async (req, res) => {
  const { customer, vehicle, package: packageId, price, paymentMethod } = req.body;
  if (!vehicle || !packageId || price === undefined) {
    res.status(400);
    throw new Error('vehicle, package, and price are required');
  }
  const [pkg] = await db.select().from(washPackages).where(eq(washPackages._id, packageId));
  if (!pkg) {
    res.status(400);
    throw new Error('Unknown package');
  }
  const [order] = await db
    .insert(washOrders)
    .values({
      orderNumber: `API-${Date.now()}`,
      customer: customer || null,
      vehicle,
      package: packageId,
      status: 'queued',
      queuedAt: new Date(),
      price: Number(price),
      paymentMethod: paymentMethod || 'fleet-invoice',
      bookingType: 'walk-in',
    })
    .returning();
  res.status(201).json(order);
});

const getCustomers = asyncHandler(async (req, res) => {
  const ownCustomer = scopeToOwnFleetCustomer(req);
  const rows = await db
    .select()
    .from(customers)
    .where(ownCustomer ? eq(customers._id, ownCustomer) : undefined)
    .limit(200);
  res.json({ data: rows });
});

const createCustomer = asyncHandler(async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone) {
    res.status(400);
    throw new Error('name and phone are required');
  }
  const [created] = await db.insert(customers).values({ name, phone, email }).returning();
  res.status(201).json(created);
});

const getMembershipSubscriptions = asyncHandler(async (req, res) => {
  const ownCustomer = scopeToOwnFleetCustomer(req);
  const rows = await db
    .select()
    .from(membershipSubscriptions)
    .where(ownCustomer ? eq(membershipSubscriptions.customer, ownCustomer) : undefined)
    .limit(200);
  res.json({ data: rows });
});

const getStock = asyncHandler(async (req, res) => {
  // Not fleet-scoped — Stock isn't in the spec's ABAC-scoped entity list, same for both keys.
  const rows = await db.select().from(supplies).where(eq(supplies.active, true)).limit(200);
  res.json({ data: rows.map((s) => ({ _id: s._id, name: s.name, quantityOnHand: s.quantityOnHand, unit: s.unit })) });
});

module.exports = { getWashOrders, createWashOrder, getCustomers, createCustomer, getMembershipSubscriptions, getStock };
