const asyncHandler = require('express-async-handler');
const { eq, asc, and } = require('drizzle-orm');
const { db } = require('../config/db');
const { services } = require('../db/schema');

const getServices = asyncHandler(async (req, res) => {
  const { active, category } = req.query;
  const filters = [];
  if (active !== undefined) filters.push(eq(services.active, active === 'true'));
  if (category) filters.push(eq(services.category, category));

  const rows = await db
    .select()
    .from(services)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(services.category), asc(services.price));
  res.json(rows);
});

const getService = asyncHandler(async (req, res) => {
  const [service] = await db.select().from(services).where(eq(services._id, req.params.id));
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  res.json(service);
});

const createService = asyncHandler(async (req, res) => {
  const { name, description, category, price, durationMinutes, vehicleTypePricing, active } = req.body;
  const [service] = await db
    .insert(services)
    .values({ name, description, category, price, durationMinutes, vehicleTypePricing, active })
    .returning();
  res.status(201).json(service);
});

const updateService = asyncHandler(async (req, res) => {
  const allowed = ['name', 'description', 'category', 'price', 'durationMinutes', 'vehicleTypePricing', 'active'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  updates.updatedAt = new Date();

  const [service] = await db.update(services).set(updates).where(eq(services._id, req.params.id)).returning();
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  res.json(service);
});

const deleteService = asyncHandler(async (req, res) => {
  const deleted = await db.delete(services).where(eq(services._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Service not found');
  }
  res.json({ message: 'Service removed' });
});

module.exports = { getServices, getService, createService, updateService, deleteService };
