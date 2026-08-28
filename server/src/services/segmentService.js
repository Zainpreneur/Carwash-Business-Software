// Customer segmentation (04-growth/marketing.md's own table) — the funnel/campaign
// targeting layer sits on top of this (drip sequences, paid ads), none of which is built;
// this is the real, computed part: which segment a customer is in right now, from data this
// app already has. Pure, stateless, computed live — same posture as ticket SLA risk.
const { eq, inArray, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { customers, washOrders, membershipSubscriptions } = require('../db/schema');

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_MEMBER_STATUSES = ['active', 'paused'];
const AT_RISK_MEMBER_STATUSES = ['past-due', 'suspended'];

// Segment precedence, since the spec's own definitions aren't mutually exclusive on their
// own terms (e.g. a fleet account could also be brand new): Fleet/Commercial first (a
// distinct account type, not a lifecycle stage), then membership standing, then pay-per-
// wash recency. The spec's own "2+ missed expected visits this cycle" clause for At-Risk
// Member isn't computed — this app has no per-member expected-visit-cadence baseline to
// miss against — so only the "recent PastDue" half of that definition is checked.
const computeSegment = ({ customer, lastWashAt, visitCount, membershipStatus }) => {
  if (customer.isFleetAccount) return 'fleet-commercial';
  if (membershipStatus && AT_RISK_MEMBER_STATUSES.includes(membershipStatus)) return 'at-risk-member';
  if (membershipStatus && ACTIVE_MEMBER_STATUSES.includes(membershipStatus)) return 'active-member';

  if (!lastWashAt || visitCount === 0) return 'new';
  const daysSinceLastWash = (Date.now() - new Date(lastWashAt).getTime()) / DAY_MS;
  if (daysSinceLastWash > 90) return 'lapsed';
  if (daysSinceLastWash >= 45 && visitCount >= 3) return 'at-risk-pay-per-wash';
  return 'active-pay-per-wash';
};

const getAllSegments = async () => {
  const allCustomers = await db.select().from(customers);
  const lastCompletedByCustomer = await db
    .select({ customer: washOrders.customer, checkedOutAt: washOrders.checkedOutAt })
    .from(washOrders)
    .where(eq(washOrders.status, 'completed'))
    .orderBy(desc(washOrders.checkedOutAt));
  const lastWashMap = new Map();
  for (const row of lastCompletedByCustomer) {
    if (row.customer && !lastWashMap.has(row.customer)) lastWashMap.set(row.customer, row.checkedOutAt);
  }

  const activeSubs = await db
    .select()
    .from(membershipSubscriptions)
    .where(inArray(membershipSubscriptions.status, [...ACTIVE_MEMBER_STATUSES, ...AT_RISK_MEMBER_STATUSES]));
  // A customer with more than one subscription (multiple vehicles) takes the worse status —
  // at-risk beats active — rather than whichever row happened to come back last from the
  // query, which would otherwise silently hide a real at-risk subscription.
  const subByCustomer = new Map();
  for (const s of activeSubs) {
    const existing = subByCustomer.get(s.customer);
    if (!existing || AT_RISK_MEMBER_STATUSES.includes(s.status)) subByCustomer.set(s.customer, s.status);
  }

  return allCustomers.map((customer) => ({
    customer,
    segment: computeSegment({
      customer,
      lastWashAt: lastWashMap.get(customer._id),
      visitCount: customer.visitCount,
      membershipStatus: subByCustomer.get(customer._id),
    }),
  }));
};

const getSegmentSummary = async () => {
  const rows = await getAllSegments();
  const counts = {};
  for (const r of rows) counts[r.segment] = (counts[r.segment] || 0) + 1;
  return counts;
};

module.exports = { computeSegment, getAllSegments, getSegmentSummary };
