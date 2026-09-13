// Purchasing & shrinkage side-effects (03-operations/inventory.md). Receiving a shipment
// auto-updates Stock; closing pays the supplier invoice. The double-entry journal postings
// that used to accompany these (ledger/accounting module) were removed — inventory math is
// kept, the accounting layer is not.
const { eq, sql } = require('drizzle-orm');
const { db } = require('../config/db');
const { purchaseOrders, purchaseOrderLines, supplies, stockAdjustments } = require('../db/schema');

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

    line.quantityReceived += applied; // keep the in-memory copy current for the check below
  }

  const allReceived = lines.every((l) => l.quantityReceived >= l.quantityOrdered);
  const anyReceived = lines.some((l) => l.quantityReceived > 0);
  const newStatus = allReceived ? 'received' : anyReceived ? 'partially-received' : po.status;

  await db
    .update(purchaseOrders)
    .set({ status: newStatus, receivedAt: allReceived ? new Date() : po.receivedAt, updatedAt: new Date() })
    .where(eq(purchaseOrders._id, po._id));

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

  return { ...po, status: 'closed' };
};

// Stock adjustment (shrinkage & write-offs). A loss (negative delta) reduces quantity;
// a positive count-correction just corrects the quantity.
const postStockAdjustment = async (adjustment) => {
  const [supply] = await db.select().from(supplies).where(eq(supplies._id, adjustment.supply));
  if (!supply) throw Object.assign(new Error('Supply not found'), { status: 404 });

  const [updated] = await db
    .update(supplies)
    .set({ quantityOnHand: sql`${supplies.quantityOnHand} + ${adjustment.quantityDelta}`, updatedAt: new Date() })
    .where(eq(supplies._id, supply._id))
    .returning();

  const [created] = await db.insert(stockAdjustments).values(adjustment).returning();

  return { adjustment: created, supply: updated };
};

module.exports = { receivePurchaseOrder, closePurchaseOrder, postStockAdjustment };
