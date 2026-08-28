const asyncHandler = require('express-async-handler');
const { eq, and, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { serviceBays, washOrders, vehicles, customers, washPackages } = require('../db/schema');

// A bay's "current" wash order is derived (not stored) — whichever active, non-terminal
// order references it. Avoids a circular FK between service_bays and wash_orders.
const ACTIVE_STATUSES = ['bay-assigned', 'in-wash', 'quality-check', 'ready-for-pickup'];

const getServiceBays = asyncHandler(async (req, res) => {
  const bays = await db.select().from(serviceBays).orderBy(serviceBays.bayNumber);

  const current = bays.length
    ? await db
        .select({
          _id: washOrders._id,
          orderNumber: washOrders.orderNumber,
          bay: washOrders.bay,
          status: washOrders.status,
          vehicle: { make: vehicles.make, model: vehicles.model, plateNumber: vehicles.plateNumber },
          customer: { name: customers.name },
          package: { name: washPackages.name },
        })
        .from(washOrders)
        .innerJoin(vehicles, eq(washOrders.vehicle, vehicles._id))
        .leftJoin(customers, eq(washOrders.customer, customers._id))
        .innerJoin(washPackages, eq(washOrders.package, washPackages._id))
        .where(
          and(
            inArray(
              washOrders.bay,
              bays.map((b) => b._id)
            ),
            inArray(washOrders.status, ACTIVE_STATUSES)
          )
        )
    : [];

  const byBay = new Map(current.map((o) => [o.bay, o]));
  res.json(bays.map((b) => ({ ...b, currentWashOrder: byBay.get(b._id) || null })));
});

const createServiceBay = asyncHandler(async (req, res) => {
  const { bayNumber, bayType, operationalStatus, avgThroughputPerHour } = req.body;
  const [created] = await db
    .insert(serviceBays)
    .values({ bayNumber, bayType, operationalStatus, avgThroughputPerHour })
    .returning();
  res.status(201).json(created);
});

const updateServiceBay = asyncHandler(async (req, res) => {
  const { bayNumber, bayType, operationalStatus, avgThroughputPerHour } = req.body;
  const updates = { updatedAt: new Date() };
  if (bayNumber !== undefined) updates.bayNumber = bayNumber;
  if (bayType !== undefined) updates.bayType = bayType;
  if (operationalStatus !== undefined) updates.operationalStatus = operationalStatus;
  if (avgThroughputPerHour !== undefined) updates.avgThroughputPerHour = avgThroughputPerHour;

  const [updated] = await db.update(serviceBays).set(updates).where(eq(serviceBays._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('Service bay not found');
  }
  res.json(updated);
});

const deleteServiceBay = asyncHandler(async (req, res) => {
  const deleted = await db.delete(serviceBays).where(eq(serviceBays._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Service bay not found');
  }
  res.json({ message: 'Service bay removed' });
});

module.exports = { ACTIVE_STATUSES, getServiceBays, createServiceBay, updateServiceBay, deleteServiceBay };
