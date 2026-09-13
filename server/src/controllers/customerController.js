const asyncHandler = require('express-async-handler');
const { eq, desc, or, like, count, inArray, and } = require('drizzle-orm');
const { db } = require('../config/db');
const { customers, vehicles, bookings, membershipSubscriptions, membershipPlans, tickets } = require('../db/schema');
const { withSla, OPEN_STATUSES } = require('../utils/tickets');

const getCustomers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const where = search
    ? or(
        like(customers.name, `%${search}%`),
        like(customers.phone, `%${search}%`),
        like(customers.email, `%${search}%`)
      )
    : undefined;

  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.createdAt))
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit));

  const [{ total }] = await db.select({ total: count() }).from(customers).where(where);
  res.json({ data: rows, total: Number(total), page: Number(page), pages: Math.ceil(Number(total) / Number(limit)) });
});

const getCustomer = asyncHandler(async (req, res) => {
  const [customer] = await db.select().from(customers).where(eq(customers._id, req.params.id));
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  const customerVehicles = await db.select().from(vehicles).where(eq(vehicles.customer, customer._id));

  const recentBookings = await db
    .select({
      _id: bookings._id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      total: bookings.total,
      vehicle: {
        _id: vehicles._id,
        make: vehicles.make,
        model: vehicles.model,
        plateNumber: vehicles.plateNumber,
      },
    })
    .from(bookings)
    .leftJoin(vehicles, eq(bookings.vehicle, vehicles._id))
    .where(eq(bookings.customer, customer._id))
    .orderBy(desc(bookings.scheduledAt))
    .limit(10);

  // Customer 360 (04-growth/crm.md's customer360Includes): membership status and support
  // history alongside the wash-history data already assembled above.
  const [membership] = await db
    .select({
      _id: membershipSubscriptions._id,
      status: membershipSubscriptions.status,
      nextBillingDate: membershipSubscriptions.nextBillingDate,
      washesThisCycle: membershipSubscriptions.washesThisCycle,
      plan: { _id: membershipPlans._id, name: membershipPlans.name, tier: membershipPlans.tier },
    })
    .from(membershipSubscriptions)
    .innerJoin(membershipPlans, eq(membershipSubscriptions.plan, membershipPlans._id))
    .where(and(eq(membershipSubscriptions.customer, customer._id), inArray(membershipSubscriptions.status, ['active', 'past-due', 'suspended', 'paused'])))
    .orderBy(desc(membershipSubscriptions.createdAt))
    .limit(1);

  const customerTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.customer, customer._id))
    .orderBy(desc(tickets.createdAt))
    .limit(10);

  res.json({
    ...customer,
    vehicles: customerVehicles,
    recentBookings,
    membership: membership || null,
    tickets: customerTickets.map(withSla),
    openTicketCount: customerTickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
  });
});

// Referral program (04-growth/marketing.md) — every customer gets a stable, shareable
// referralCode at creation; collision odds are negligible at this app's scale, and a
// unique-constraint violation surfaces as a real error rather than silently duplicating.
const generateReferralCode = (name) => {
  const base = (name || 'CUST').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase() || 'CUST';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
};

const createCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, address, notes, loyaltyPoints, referredByCode } = req.body;
  const [customer] = await db
    .insert(customers)
    .values({
      name,
      email: email ? String(email).toLowerCase() : undefined,
      phone,
      address,
      notes,
      loyaltyPoints,
      referralCode: generateReferralCode(name),
      referredByCode: referredByCode || undefined,
    })
    .returning();
  res.status(201).json(customer);
});

const updateCustomer = asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'address', 'notes', 'loyaltyPoints', 'active', 'isFleetAccount', 'referredByCode'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.email !== undefined && updates.email) updates.email = String(updates.email).toLowerCase();
  updates.updatedAt = new Date();

  const [customer] = await db
    .update(customers)
    .set(updates)
    .where(eq(customers._id, req.params.id))
    .returning();
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json(customer);
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const [customer] = await db.select().from(customers).where(eq(customers._id, req.params.id));
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  await db.delete(customers).where(eq(customers._id, req.params.id));
  res.json({ message: 'Customer removed' });
});

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
