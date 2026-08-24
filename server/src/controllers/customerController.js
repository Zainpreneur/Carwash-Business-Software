const asyncHandler = require('express-async-handler');
const { eq, desc, or, ilike, count } = require('drizzle-orm');
const { db } = require('../config/db');
const { customers, vehicles, bookings } = require('../db/schema');

const getCustomers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const where = search
    ? or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
        ilike(customers.email, `%${search}%`)
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

  res.json({ ...customer, vehicles: customerVehicles, recentBookings });
});

const createCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, address, notes, loyaltyPoints } = req.body;
  const [customer] = await db
    .insert(customers)
    .values({
      name,
      email: email ? String(email).toLowerCase() : undefined,
      phone,
      address,
      notes,
      loyaltyPoints,
    })
    .returning();
  res.status(201).json(customer);
});

const updateCustomer = asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'address', 'notes', 'loyaltyPoints', 'active'];
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
