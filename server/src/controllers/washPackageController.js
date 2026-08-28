const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { washPackages, packagePricing } = require('../db/schema');

const VEHICLE_TIERS = ['sedan-coupe', 'suv-truck', 'van-oversized'];

const attachPricing = async (rows) => {
  if (!rows.length) return [];
  const pricing = await db.select().from(packagePricing);
  const byPackage = new Map();
  for (const p of pricing) {
    if (!byPackage.has(p.package)) byPackage.set(p.package, {});
    byPackage.get(p.package)[p.vehicleType] = p.price;
  }
  return rows.map((r) => ({ ...r, pricing: byPackage.get(r._id) || {} }));
};

const getWashPackages = asyncHandler(async (req, res) => {
  const { active } = req.query;
  const rows = active !== undefined
    ? await db.select().from(washPackages).where(eq(washPackages.active, active === 'true'))
    : await db.select().from(washPackages);
  res.json(await attachPricing(rows));
});

const getWashPackage = asyncHandler(async (req, res) => {
  const [row] = await db.select().from(washPackages).where(eq(washPackages._id, req.params.id));
  if (!row) {
    res.status(404);
    throw new Error('Wash package not found');
  }
  const [withPricing] = await attachPricing([row]);
  res.json(withPricing);
});

const createWashPackage = asyncHandler(async (req, res) => {
  const { name, tier, deliveryLane, includesInterior, avgCycleTimeMinutes, active, pricing } = req.body;
  const [created] = await db
    .insert(washPackages)
    .values({ name, tier, deliveryLane, includesInterior, avgCycleTimeMinutes, active })
    .returning();

  if (pricing) {
    const rows = VEHICLE_TIERS.filter((t) => pricing[t] !== undefined && pricing[t] !== '').map((t) => ({
      package: created._id,
      vehicleType: t,
      price: Number(pricing[t]),
    }));
    if (rows.length) await db.insert(packagePricing).values(rows);
  }

  const [withPricing] = await attachPricing([created]);
  res.status(201).json(withPricing);
});

const updateWashPackage = asyncHandler(async (req, res) => {
  const [existing] = await db.select().from(washPackages).where(eq(washPackages._id, req.params.id));
  if (!existing) {
    res.status(404);
    throw new Error('Wash package not found');
  }
  const { name, tier, deliveryLane, includesInterior, avgCycleTimeMinutes, active, pricing } = req.body;
  const updates = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (tier !== undefined) updates.tier = tier;
  if (deliveryLane !== undefined) updates.deliveryLane = deliveryLane;
  if (includesInterior !== undefined) updates.includesInterior = includesInterior;
  if (avgCycleTimeMinutes !== undefined) updates.avgCycleTimeMinutes = avgCycleTimeMinutes;
  if (active !== undefined) updates.active = active;

  await db.update(washPackages).set(updates).where(eq(washPackages._id, existing._id));

  if (pricing) {
    await db.delete(packagePricing).where(eq(packagePricing.package, existing._id));
    const rows = VEHICLE_TIERS.filter((t) => pricing[t] !== undefined && pricing[t] !== '').map((t) => ({
      package: existing._id,
      vehicleType: t,
      price: Number(pricing[t]),
    }));
    if (rows.length) await db.insert(packagePricing).values(rows);
  }

  const [updated] = await db.select().from(washPackages).where(eq(washPackages._id, existing._id));
  const [withPricing] = await attachPricing([updated]);
  res.json(withPricing);
});

const deleteWashPackage = asyncHandler(async (req, res) => {
  const deleted = await db.delete(washPackages).where(eq(washPackages._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Wash package not found');
  }
  res.json({ message: 'Wash package removed' });
});

module.exports = {
  VEHICLE_TIERS,
  getWashPackages,
  getWashPackage,
  createWashPackage,
  updateWashPackage,
  deleteWashPackage,
};
