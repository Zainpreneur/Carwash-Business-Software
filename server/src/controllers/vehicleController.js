const asyncHandler = require('express-async-handler');
const { eq, desc, ilike, and, sql } = require('drizzle-orm');
const { db } = require('../config/db');
const { vehicles, customers, bookings } = require('../db/schema');

const withCustomer = {
  _id: vehicles._id,
  customer: {
    _id: customers._id,
    name: customers.name,
    phone: customers.phone,
    email: customers.email,
  },
  make: vehicles.make,
  model: vehicles.model,
  year: vehicles.year,
  color: vehicles.color,
  plateNumber: vehicles.plateNumber,
  type: vehicles.type,
  createdAt: vehicles.createdAt,
};

const getVehicles = asyncHandler(async (req, res) => {
  const { customer, search } = req.query;
  const filters = [];
  if (customer) filters.push(eq(vehicles.customer, customer));
  if (search) filters.push(ilike(vehicles.plateNumber, `%${search}%`));

  const rows = await db
    .select(withCustomer)
    .from(vehicles)
    .innerJoin(customers, eq(vehicles.customer, customers._id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(vehicles.createdAt));
  res.json(rows);
});

const getVehicle = asyncHandler(async (req, res) => {
  const [vehicle] = await db
    .select(withCustomer)
    .from(vehicles)
    .innerJoin(customers, eq(vehicles.customer, customers._id))
    .where(eq(vehicles._id, req.params.id));
  if (!vehicle) {
    res.status(404);
    throw new Error('Vehicle not found');
  }
  res.json(vehicle);
});

const createVehicle = asyncHandler(async (req, res) => {
  const { customer, make, model, year, color, plateNumber, type } = req.body;
  const [vehicle] = await db
    .insert(vehicles)
    .values({ customer, make, model, year, color, plateNumber: String(plateNumber).toUpperCase(), type })
    .returning();
  const [populated] = await db
    .select(withCustomer)
    .from(vehicles)
    .innerJoin(customers, eq(vehicles.customer, customers._id))
    .where(eq(vehicles._id, vehicle._id));
  res.status(201).json(populated);
});

const updateVehicle = asyncHandler(async (req, res) => {
  const allowed = ['customer', 'make', 'model', 'year', 'color', 'type'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (req.body.plateNumber !== undefined) updates.plateNumber = String(req.body.plateNumber).toUpperCase();
  updates.updatedAt = new Date();

  const [updated] = await db.update(vehicles).set(updates).where(eq(vehicles._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('Vehicle not found');
  }
  const [populated] = await db
    .select(withCustomer)
    .from(vehicles)
    .innerJoin(customers, eq(vehicles.customer, customers._id))
    .where(eq(vehicles._id, updated._id));
  res.json(populated);
});

const deleteVehicle = asyncHandler(async (req, res) => {
  const deleted = await db.delete(vehicles).where(eq(vehicles._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Vehicle not found');
  }
  res.json({ message: 'Vehicle removed' });
});

// Full customer profile bundle for the plate-scan flow.
const getCustomerBundle = async (customerId) => {
  const [customer] = await db.select().from(customers).where(eq(customers._id, customerId));
  if (!customer) return null;
  const ownedVehicles = await db.select().from(vehicles).where(eq(vehicles.customer, customerId));
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
    .where(eq(bookings.customer, customerId))
    .orderBy(desc(bookings.scheduledAt))
    .limit(10);
  return { ...customer, vehicles: ownedVehicles, recentBookings };
};

// GET /api/vehicles/plate/:plate — scan-to-lookup entry point.
// Matches on a normalized plate (alphanumerics only, case-insensitive),
// falling back to a substring match so partial OCR reads still resolve.
const lookupByPlate = asyncHandler(async (req, res) => {
  const plate = String(req.params.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (plate.length < 2) {
    res.status(400);
    throw new Error('A valid plate number is required');
  }

  const normalizedPlate = sql`upper(regexp_replace(${vehicles.plateNumber}, '[^A-Za-z0-9]', '', 'g'))`;
  const baseQuery = db
    .select(withCustomer)
    .from(vehicles)
    .innerJoin(customers, eq(vehicles.customer, customers._id));

  let [vehicle] = await baseQuery.where(eq(normalizedPlate, plate)).limit(1);
  if (!vehicle) {
    [vehicle] = await db
      .select(withCustomer)
      .from(vehicles)
      .innerJoin(customers, eq(vehicles.customer, customers._id))
      .where(sql`${normalizedPlate} LIKE ${`%${plate}%`}`)
      .limit(1);
  }
  if (!vehicle) {
    res.status(404);
    throw new Error(`No vehicle found for plate "${plate}"`);
  }

  const customerProfile = await getCustomerBundle(vehicle.customer._id);
  res.json({ vehicle, customer: customerProfile });
});

module.exports = { getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle, lookupByPlate };
