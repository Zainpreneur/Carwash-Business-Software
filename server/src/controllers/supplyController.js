const asyncHandler = require('express-async-handler');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { supplies, suppliers, stockAdjustments, employees } = require('../db/schema');
const { postStockAdjustment } = require('../services/inventoryService');

const listSelect = {
  _id: supplies._id,
  name: supplies.name,
  warehouse: supplies.warehouse,
  unit: supplies.unit,
  quantityOnHand: supplies.quantityOnHand,
  unitCost: supplies.unitCost,
  active: supplies.active,
  supplier: { _id: suppliers._id, name: suppliers.name, leadTimeDays: suppliers.leadTimeDays },
};

const getSupplies = asyncHandler(async (req, res) => {
  const rows = await db.select(listSelect).from(supplies).leftJoin(suppliers, eq(supplies.supplier, suppliers._id)).orderBy(supplies.name);
  res.json(rows);
});

const createSupply = asyncHandler(async (req, res) => {
  const { name, warehouse, unit, quantityOnHand, unitCost, supplier } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('name is required');
  }
  const [created] = await db
    .insert(supplies)
    .values({ name, warehouse: warehouse || 'main-chemical-room', unit: unit || 'unit', quantityOnHand: quantityOnHand || 0, unitCost: unitCost || 0, supplier: supplier || null })
    .returning();
  res.status(201).json(created);
});

const updateSupply = asyncHandler(async (req, res) => {
  const allowed = ['name', 'warehouse', 'unit', 'quantityOnHand', 'unitCost', 'supplier', 'active'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  updates.updatedAt = new Date();
  const [updated] = await db.update(supplies).set(updates).where(eq(supplies._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('Supply not found');
  }
  res.json(updated);
});

const deleteSupply = asyncHandler(async (req, res) => {
  const deleted = await db.delete(supplies).where(eq(supplies._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Supply not found');
  }
  res.json({ message: 'Supply removed' });
});

const getAdjustments = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: stockAdjustments._id,
      supply: { _id: supplies._id, name: supplies.name },
      quantityDelta: stockAdjustments.quantityDelta,
      reasonCode: stockAdjustments.reasonCode,
      notes: stockAdjustments.notes,
      approvedBy: { _id: employees._id, name: employees.name },
      createdAt: stockAdjustments.createdAt,
    })
    .from(stockAdjustments)
    .innerJoin(supplies, eq(stockAdjustments.supply, supplies._id))
    .innerJoin(employees, eq(stockAdjustments.approvedBy, employees._id))
    .orderBy(desc(stockAdjustments.createdAt));
  res.json(rows);
});

// "Always requiring approvedBy (an Employee, typically site-manager) — same approval
// discipline as a discount/refund."
const createAdjustment = asyncHandler(async (req, res) => {
  const { supply, quantityDelta, reasonCode, notes, approvedBy } = req.body;
  const REASON_CODES = ['breakage', 'spillage', 'theft', 'expired', 'count-correction'];
  if (!supply || !quantityDelta || !REASON_CODES.includes(reasonCode) || !approvedBy) {
    res.status(400);
    throw new Error(`supply, a non-zero quantityDelta, approvedBy, and reasonCode (${REASON_CODES.join(', ')}) are required`);
  }
  try {
    const result = await postStockAdjustment({ supply, quantityDelta, reasonCode, notes, approvedBy, createdBy: req.user._id });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500);
    throw err;
  }
});

module.exports = { getSupplies, createSupply, updateSupply, deleteSupply, getAdjustments, createAdjustment };
