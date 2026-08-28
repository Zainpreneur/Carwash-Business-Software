// Generated documents (06-platform/knowledge-base.md's document-types table). wash-receipt,
// membership-agreement, and wash-package-comparison are the spec's own three "generated from"
// document types — deterministic template + variable renders against live records, not
// AI-composed, "same pattern as the WhatsApp templates" per the spec's own text — as opposed
// to the authored knowledge-article/internal documents covered by knowledgeArticles
// (server/src/controllers/knowledgeBaseController.js). No PDF rendering here — a structured
// JSON payload the client renders and can print via the browser's own print dialog, which is
// the deterministic-render/variable-substitution behavior the spec actually asks for; a real
// PDF file store is a presentation-layer choice, not the generation logic itself.
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { washOrders, vehicles, customers, washPackages, membershipSubscriptions, membershipPlans, packagePricing } = require('../db/schema');
const { TAX_RATE } = require('./ledgerService');

const round2 = (n) => Math.round(n * 100) / 100;

// wash-receipt: only makes sense once money has actually changed hands — generating one for
// a still-in-progress order would be printing a receipt for a sale that hasn't happened.
const generateWashReceipt = async (washOrderId) => {
  const [order] = await db.select().from(washOrders).where(eq(washOrders._id, washOrderId));
  if (!order) return null;
  if (!order.checkedOutAt) throw new Error('wash-receipt can only be generated for a checked-out order');

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles._id, order.vehicle));
  const [pkg] = await db.select().from(washPackages).where(eq(washPackages._id, order.package));
  const customer = order.customer ? (await db.select().from(customers).where(eq(customers._id, order.customer)))[0] : null;

  const total = Number(order.price);
  // Tax-inclusive, backed out with the same TAX_RATE the ledger itself posted this checkout
  // with — a receipt that disagreed with the ledger's own numbers would be a real bug, not a
  // rounding footnote, so this reads the same shared constant rather than recomputing its own.
  const tax = round2(total - total / (1 + TAX_RATE));
  const subtotal = round2(total - tax);

  return {
    type: 'wash-receipt',
    orderNumber: order.orderNumber,
    issuedAt: order.checkedOutAt,
    customerName: customer?.name || 'Walk-in',
    vehicle: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})` : null,
    packageName: pkg?.name || null,
    paymentMethod: order.paymentMethod,
    subtotal,
    tax,
    taxRate: TAX_RATE,
    total,
  };
};

// membership-agreement: rendered live off the subscription's *current* plan, since this app
// doesn't snapshot plan terms at signup time (membershipSubscriptions.plan is a live FK, not
// a point-in-time copy). Documented gap: if the plan's price/cap changes after a member
// signs up, re-generating this agreement later shows the plan's current terms, not
// necessarily what the member actually agreed to on their signup date — a real deployment
// wanting "what did they sign under" (the spec's own framing) would need to snapshot plan
// terms onto the subscription at creation, which this app does not do.
const generateMembershipAgreement = async (subscriptionId) => {
  const [sub] = await db.select().from(membershipSubscriptions).where(eq(membershipSubscriptions._id, subscriptionId));
  if (!sub) return null;

  const [customer] = await db.select().from(customers).where(eq(customers._id, sub.customer));
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles._id, sub.vehicle));
  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, sub.plan));

  return {
    type: 'membership-agreement',
    subscriptionId: sub._id,
    signedAt: sub.createdAt,
    customerName: customer?.name,
    vehicle: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})` : null,
    planName: plan?.name,
    planTier: plan?.tier,
    monthlyPrice: plan?.monthlyPrice,
    isUnlimited: plan?.isUnlimited,
    washesPerMonthCap: plan?.washesPerMonthCap,
    rolloverAllowed: plan?.rolloverAllowed,
    billingDayOfMonth: sub.billingDayOfMonth,
    status: sub.status,
    terms: [
      `This membership covers ${plan?.isUnlimited ? 'unlimited washes' : `up to ${plan?.washesPerMonthCap} washes per month`} on the vehicle above, on the "${plan?.name}" package tier only — an upgrade to a higher tier is a plan change, not covered automatically.`,
      plan?.rolloverAllowed
        ? 'Unused washes roll over one billing cycle.'
        : 'Unused washes do not roll over to the next billing cycle.',
      `Billed monthly on day ${sub.billingDayOfMonth} of each cycle at $${plan?.monthlyPrice}/month until paused or cancelled.`,
      'May be paused or cancelled at any time with no cancellation fee, effective at the end of the current billing cycle.',
      'A failed billing charge moves this membership to past-due, then suspended after 7 days unresolved, then cancelled after 30 days unresolved, per the standard billing policy.',
    ],
  };
};

// wash-package-comparison: every active package with its per-vehicle-type pricing tiers —
// the same data list_wash_packages hands wash-concierge, rendered as a standalone document
// a cashier can hand to a customer instead of narrating pricing verbally.
const generateWashPackageComparison = async () => {
  const packages = await db.select().from(washPackages).where(eq(washPackages.active, true));
  const pricing = await db.select().from(packagePricing);
  return {
    type: 'wash-package-comparison',
    generatedAt: new Date(),
    packages: packages.map((p) => ({
      name: p.name,
      tier: p.tier,
      lane: p.deliveryLane,
      pricingByVehicleType: Object.fromEntries(pricing.filter((pr) => pr.package === p._id).map((pr) => [pr.vehicleType, pr.price])),
    })),
  };
};

module.exports = { generateWashReceipt, generateMembershipAgreement, generateWashPackageComparison };
