// Purchasing & shrinkage side-effects (03-operations/inventory.md). Receiving a shipment
// "auto-updates Stock and posts the A/P journal entry per 05-finance/accounting.md" — this
// is what finally gives 1400 Chemical & Supply Inventory, 2000 Supplier Payables, and 5700
// Inventory Shrinkage Expense (all seeded in the finance phase, all dead accounts until now)
// something to post against.
const { eq, sql } = require('drizzle-orm');
const { db } = require('../config/db');
const { purchaseOrders, purchaseOrderLines, supplies, stockAdjustments } = require('../db/schema');
const { postEntry } = require('./ledgerService');

const round2 = (n) => Math.round(n * 100) / 100;

// receivedLines: [{ lineId, quantityReceived }] — the quantity arriving *in this receipt*,
// not the running total (supports a shipment arriving in more than one batch, per the
// spec's own PartiallyReceived state). Over-receiving beyond what's still outstanding on a
// line is silently capped, not rejected — a miscounted delivery shouldn't 500.
const receivePurchaseOrder = async ({ purchaseOrderId, receivedLines }) => {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders._id, purchaseOrderId));
  if (!po) throw Object.assign(new Error('Purchase order not found'), { status: 404 });
  if (!['sent', 'partially-received'].includes(po.status)) {
    throw Object.assign(new Error(`Purchase order is "${po.status}" — expected "sent" or "partially-received"`), { status: 409 });
  }

  const lines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrder, po._id));
  let receivedValue = 0;

  for (const { lineId, quantityReceived } of receivedLines) {
    const line = lines.find((l) => l._id === lineId);
    if (!line || quantityReceived <= 0) continue;
    const remaining = line.quantityOrdered - line.quantityReceived;
    const applied = Math.min(quantityReceived, remaining);
    if (applied <= 0) continue;

    await db.update(purchaseOrderLines).set({ quantityReceived: line.quantityReceived + applied }).where(eq(purchaseOrderLines._id, line._id));
    await db
      .update(supplies)
      .set({ quantityOnHand: sql`${supplies.quantityOnHand} + ${applied}`, updatedAt: new Date() })
      .where(eq(supplies._id, line.supply));

    receivedValue += applied * line.unitCost;
    line.quantityReceived += applied; // keep the in-memory copy current for the check below
  }

  const allReceived = lines.every((l) => l.quantityReceived >= l.quantityOrdered);
  const anyReceived = lines.some((l) => l.quantityReceived > 0);
  const newStatus = allReceived ? 'received' : anyReceived ? 'partially-received' : po.status;

  await db
    .update(purchaseOrders)
    .set({ status: newStatus, receivedAt: allReceived ? new Date() : po.receivedAt, updatedAt: new Date() })
    .where(eq(purchaseOrders._id, po._id));

  if (receivedValue > 0) {
    await postEntry({
      memo: `Received shipment for PO ${po._id.slice(0, 8)}`,
      sourceEntity: 'purchase_order',
      sourceId: po._id,
      lines: [
        { account: '1400', debit: round2(receivedValue) },
        { account: '2000', credit: round2(receivedValue) },
      ],
    });
  }

  return { ...po, status: newStatus };
};

// "Closed" — the payable has been settled in cash. Requires fully Received first (you don't
// pay off and close a PO that's still short a case of wax).
const closePurchaseOrder = async (purchaseOrderId) => {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders._id, purchaseOrderId));
  if (!po) throw Object.assign(new Error('Purchase order not found'), { status: 404 });
  if (po.status !== 'received') {
    throw Object.assign(new Error(`Purchase order is "${po.status}" — expected "received"`), { status: 409 });
  }

  await db.update(purchaseOrders).set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() }).where(eq(purchaseOrders._id, po._id));

  await postEntry({
    memo: `Paid supplier invoice for PO ${po._id.slice(0, 8)}`,
    sourceEntity: 'purchase_order',
    sourceId: po._id,
    lines: [
      { account: '2000', debit: round2(po.totalAmount) },
      { account: '1000', credit: round2(po.totalAmount) },
    ],
  });

  return { ...po, status: 'closed' };
};

// Stock adjustment (shrinkage & write-offs). A loss (negative delta) expenses it — "posts to
// 5700 Inventory Shrinkage Expense ... rather than silently vanishing from the books"; a
// positive count-correction just corrects the quantity (finding unexpected extra stock
// isn't a standard accounting event this app models — documented simplification).
const postStockAdjustment = async (adjustment) => {
  const [supply] = await db.select().from(supplies).where(eq(supplies._id, adjustment.supply));
  if (!supply) throw Object.assign(new Error('Supply not found'), { status: 404 });

  const [updated] = await db
    .update(supplies)
    .set({ quantityOnHand: sql`${supplies.quantityOnHand} + ${adjustment.quantityDelta}`, updatedAt: new Date() })
    .where(eq(supplies._id, supply._id))
    .returning();

  const [created] = await db.insert(stockAdjustments).values(adjustment).returning();

  if (adjustment.quantityDelta < 0) {
    const value = round2(Math.abs(adjustment.quantityDelta) * supply.unitCost);
    if (value > 0) {
      await postEntry({
        memo: `Stock write-off: ${supply.name} (${adjustment.reasonCode})`,
        sourceEntity: 'stock_adjustment',
        sourceId: created._id,
        lines: [
          { account: '5700', debit: value },
          { account: '1400', credit: value },
        ],
      });
    }
  }

  return { adjustment: created, supply: updated };
};

module.exports = { receivePurchaseOrder, closePurchaseOrder, postStockAdjustment };
