const asyncHandler = require('express-async-handler');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { purchaseOrders, purchaseOrderLines, suppliers, supplies, users } = require('../db/schema');
const { receivePurchaseOrder, closePurchaseOrder } = require('../services/inventoryService');

const listSelect = {
  _id: purchaseOrders._id,
  supplier: { _id: suppliers._id, name: suppliers.name, leadTimeDays: suppliers.leadTimeDays },
  status: purchaseOrders.status,
  totalAmount: purchaseOrders.totalAmount,
  source: purchaseOrders.source,
  createdBy: { _id: users._id, name: users.name },
  sentAt: purchaseOrders.sentAt,
  receivedAt: purchaseOrders.receivedAt,
  closedAt: purchaseOrders.closedAt,
  createdAt: purchaseOrders.createdAt,
};

const baseQuery = () =>
  db
    .select(listSelect)
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplier, suppliers._id))
    .leftJoin(users, eq(purchaseOrders.createdBy, users._id));

const getPurchaseOrders = asyncHandler(async (req, res) => {
  const rows = await baseQuery().orderBy(desc(purchaseOrders.createdAt));
  res.json(rows);
});

const getPurchaseOrder = asyncHandler(async (req, res) => {
  const [row] = await baseQuery().where(eq(purchaseOrders._id, req.params.id));
  if (!row) {
    res.status(404);
    throw new Error('Purchase order not found');
  }
  const lines = await db
    .select({
      _id: purchaseOrderLines._id,
      supply: { _id: supplies._id, name: supplies.name, unit: supplies.unit },
      quantityOrdered: purchaseOrderLines.quantityOrdered,
      quantityReceived: purchaseOrderLines.quantityReceived,
      unitCost: purchaseOrderLines.unitCost,
    })
    .from(purchaseOrderLines)
    .innerJoin(supplies, eq(purchaseOrderLines.supply, supplies._id))
    .where(eq(purchaseOrderLines.purchaseOrder, row._id));
  res.json({ ...row, lines });
});

// A staff-drafted PO (as opposed to inventory-forecaster's automatic ones) always starts in
// Draft — a human still has to send it.
const createPurchaseOrder = asyncHandler(async (req, res) => {
  const { supplier, lines } = req.body;
  if (!supplier || !Array.isArray(lines) || !lines.length) {
    res.status(400);
    throw new Error('supplier and at least one line ({ supply, quantityOrdered, unitCost }) are required');
  }
  const totalAmount = lines.reduce((sum, l) => sum + Number(l.quantityOrdered) * Number(l.unitCost), 0);
  const [po] = await db
    .insert(purchaseOrders)
    .values({ supplier, status: 'draft', totalAmount, source: 'manual', createdBy: req.user._id })
    .returning();
  await db.insert(purchaseOrderLines).values(
    lines.map((l) => ({ purchaseOrder: po._id, supply: l.supply, quantityOrdered: l.quantityOrdered, unitCost: l.unitCost }))
  );
  res.status(201).json(po);
});

// "site-manager approves above the agent's $150 autonomous threshold" — also the human
// approval step for a manually-drafted PO of any size, since nothing auto-approves those.
const approvePurchaseOrder = asyncHandler(async (req, res) => {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders._id, req.params.id));
  if (!po) {
    res.status(404);
    throw new Error('Purchase order not found');
  }
  if (po.status !== 'draft') {
    res.status(409);
    throw new Error(`Purchase order is "${po.status}" — expected "draft"`);
  }
  const [updated] = await db
    .update(purchaseOrders)
    .set({ status: 'sent', approvedBy: req.user._id, sentAt: new Date(), updatedAt: new Date() })
    .where(eq(purchaseOrders._id, po._id))
    .returning();
  res.json(updated);
});

const receivePO = asyncHandler(async (req, res) => {
  const { receivedLines } = req.body;
  if (!Array.isArray(receivedLines) || !receivedLines.length) {
    res.status(400);
    throw new Error('receivedLines ({ lineId, quantityReceived }[]) is required');
  }
  try {
    const result = await receivePurchaseOrder({ purchaseOrderId: req.params.id, receivedLines });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500);
    throw err;
  }
});

const closePO = asyncHandler(async (req, res) => {
  try {
    const result = await closePurchaseOrder(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500);
    throw err;
  }
});

module.exports = { getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, approvePurchaseOrder, receivePO, closePO };
