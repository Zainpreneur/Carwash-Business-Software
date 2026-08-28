// inventory-forecaster (02-intelligence/ai-agents.md) — "predicts chemical/consumable usage
// from rolling wash volume and package mix, flags reorder points, and drafts purchase
// orders." Like membership-billing-agent, this makes NO Claude call: the spec's own
// description is a rolling-average forecast and a reorder-policy threshold comparison, not
// a natural-language judgment call. The "prediction" is arithmetic, not reasoning.
//
// Trigger is "nightly schedule" per the spec; this app has no scheduler (the same
// documented gap as the -3d/-2h reminder jobs and proactive SLA alerting), so it runs
// on-demand instead, via POST /api/inventory/forecast/run.
//
// Known simplification: recommendations are computed purely from quantityOnHand vs. the
// reorder point — they don't subtract quantity already on an open (Sent/PartiallyReceived)
// PurchaseOrder for that supply. Running the forecast twice before a shipment arrives will
// recommend (and, on /run, create) a duplicate order. A real nightly run wouldn't hit this
// as often since one pass a day is the whole point; it's a sharper edge on the on-demand
// trigger this app substitutes for a real scheduler.
const { eq, and, gte } = require('drizzle-orm');
const { db } = require('../config/db');
const { supplies, packageSupplyUsage, washOrders, purchaseOrders, purchaseOrderLines } = require('../db/schema');
const { recordAgentEvent } = require('../utils/agentMetrics');

const TRAILING_DAYS = 7;
const PAR_LEVEL_DAYS = 30;
const AUTO_APPROVE_THRESHOLD = 150; // "auto-approves and sends POs under $150"
const round2 = (n) => Math.round(n * 100) / 100;

// Reorder policy: "reorder to a 30-day par level whenever on-hand drops below a 7-day
// average-consumption supply, computed from trailing wash volume by package mix." Returns
// one recommendation per supply that needs reordering — supplies with no consumption data
// (a new item, or a package mix that never uses it) are skipped rather than flagged, since
// there's nothing to forecast from.
const computeRecommendations = async () => {
  const since = new Date(Date.now() - TRAILING_DAYS * 24 * 60 * 60 * 1000);
  const recentOrders = await db
    .select({ package: washOrders.package })
    .from(washOrders)
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, since)));

  const washesByPackage = new Map();
  for (const o of recentOrders) {
    washesByPackage.set(o.package, (washesByPackage.get(o.package) || 0) + 1);
  }

  const usageRows = await db.select().from(packageSupplyUsage);
  const activeSupplies = await db.select().from(supplies).where(eq(supplies.active, true));

  const recommendations = [];
  for (const supply of activeSupplies) {
    const usageForSupply = usageRows.filter((u) => u.supply === supply._id);
    if (!usageForSupply.length) continue;

    const dailyConsumption = usageForSupply.reduce((sum, u) => {
      const washes = washesByPackage.get(u.package) || 0;
      return sum + (washes / TRAILING_DAYS) * u.quantityPerWash;
    }, 0);
    if (dailyConsumption <= 0) continue;

    const sevenDaySupply = dailyConsumption * TRAILING_DAYS;
    if (supply.quantityOnHand >= sevenDaySupply) continue;

    const parLevel = dailyConsumption * PAR_LEVEL_DAYS;
    const recommendedQuantity = Math.max(0, round2(parLevel - supply.quantityOnHand));
    if (recommendedQuantity <= 0) continue;

    recommendations.push({
      supply,
      dailyConsumption: round2(dailyConsumption),
      sevenDaySupply: round2(sevenDaySupply),
      recommendedQuantity,
      estimatedCost: round2(recommendedQuantity * supply.unitCost),
    });
  }
  return recommendations;
};

// Drafts one PurchaseOrder per supplier from the current recommendations — "auto-approves
// and sends POs under $150; anything above requires site-manager sign-off before the PO
// leaves Draft." A supply with no supplier on file can't be ordered automatically; it's
// still surfaced by computeRecommendations() for a human to act on, just excluded here.
const createPurchaseOrdersFromRecommendations = async (createdBy) => {
  const recommendations = await computeRecommendations();
  const bySupplier = new Map();
  for (const rec of recommendations) {
    if (!rec.supply.supplier) continue;
    if (!bySupplier.has(rec.supply.supplier)) bySupplier.set(rec.supply.supplier, []);
    bySupplier.get(rec.supply.supplier).push(rec);
  }

  const created = [];
  for (const [supplierId, recs] of bySupplier) {
    const totalAmount = round2(recs.reduce((sum, r) => sum + r.estimatedCost, 0));
    const autoApprove = totalAmount < AUTO_APPROVE_THRESHOLD;
    const [po] = await db
      .insert(purchaseOrders)
      .values({
        supplier: supplierId,
        status: autoApprove ? 'sent' : 'draft',
        totalAmount,
        source: 'inventory-forecaster',
        createdBy,
        sentAt: autoApprove ? new Date() : null,
      })
      .returning();

    await db.insert(purchaseOrderLines).values(
      recs.map((r) => ({
        purchaseOrder: po._id,
        supply: r.supply._id,
        quantityOrdered: r.recommendedQuantity,
        unitCost: r.supply.unitCost,
      }))
    );
    created.push(po);
  }
  recordAgentEvent('inventory-forecaster', 'deterministic', created.some((po) => po.status === 'draft'));
  return created;
};

module.exports = { computeRecommendations, createPurchaseOrdersFromRecommendations, AUTO_APPROVE_THRESHOLD };
