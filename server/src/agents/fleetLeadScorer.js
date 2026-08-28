// fleet-lead-scorer (02-intelligence/ai-agents.md) — "scores an inbound commercial/fleet
// inquiry (vehicle count requested, business-hours contact pattern, invoicing-terms
// request) and creates a follow-up notification for fleet-account-manager, rather than
// running a full sales pipeline" (04-growth/crm.md's own reasoning for skipping the
// pipeline doesn't apply to this lightweight scorer — it's explicitly kept in the roster).
// Makes NO Claude call: scoring three stated inputs against stated point values is
// arithmetic, not a judgment call, the same reasoning that kept membership-billing-agent
// and inventory-forecaster LLM-free. This app has no fleet-account-manager role (RBAC is
// admin/manager/staff) — notifications go to admin/manager instead.
const { db } = require('../config/db');
const { fleetInquiries } = require('../db/schema');
const { notifyRoles } = require('../utils/notify');

// Stated point values, not measured — a labeled assumption like every other agent's
// thresholds in this app (see simulationService.js's ASSUMPTIONS for the same posture).
const HOT_LEAD_THRESHOLD = 50;

const scoreInquiry = ({ vehicleCountRequested, contactPattern, invoicingTermsRequested }) => {
  let score = 0;
  if (vehicleCountRequested >= 10) score += 40;
  else if (vehicleCountRequested >= 5) score += 25;
  else if (vehicleCountRequested >= 2) score += 10;

  score += contactPattern === 'business-hours' ? 20 : 5;
  if (invoicingTermsRequested) score += 30;

  return score;
};

const createInquiry = async ({ customer, companyName, contactPhone, vehicleCountRequested, contactPattern, invoicingTermsRequested, createdBy }) => {
  const score = scoreInquiry({ vehicleCountRequested, contactPattern, invoicingTermsRequested });
  const [created] = await db
    .insert(fleetInquiries)
    .values({ customer: customer || null, companyName, contactPhone, vehicleCountRequested, contactPattern, invoicingTermsRequested, score, createdBy })
    .returning();

  const isHot = score >= HOT_LEAD_THRESHOLD;
  // "Never commits to custom fleet pricing — always a human-quoted follow-up," so this only
  // ever notifies; it never creates a MembershipPlan or quotes a price itself.
  await notifyRoles(['admin', 'manager'], {
    type: 'fleet_inquiry',
    title: isHot ? `Hot fleet lead: ${companyName}` : `New fleet inquiry: ${companyName}`,
    message: `${vehicleCountRequested} vehicles requested, ${contactPattern.replace('-', ' ')} contact${invoicingTermsRequested ? ', invoicing terms requested' : ''} — score ${score}/100.`,
  });

  return created;
};

module.exports = { scoreInquiry, createInquiry, HOT_LEAD_THRESHOLD };
