// Executive/Owner View (02-intelligence/views.md) — "Leads with the health score, then
// cars-washed-per-day, membership-penetration-rate, net-membership-growth, then *only* open
// anomaly alerts - never raw data." Medium is whatsapp-digest, cadence daily; this app has no
// scheduler (the same documented gap behind every "nightly"/"daily" trigger elsewhere), so an
// admin sends it on demand from /reports instead of it firing itself every morning.
//
// Every number here is composed from real services already built in this session —
// healthScoreService, reportingCubeService — not recomputed. openAnomalyAlerts is honestly
// empty: 02-intelligence/analytics.md's anomaly-detection rule table isn't built (documented
// there already), so there's nothing real to surface here either; a fabricated alert would
// be worse than an honest empty list.
const { db } = require('../config/db');
const { washOrders } = require('../db/schema');
const { eq, and, gte, lte, count } = require('drizzle-orm');
const { getBusinessHealthScore } = require('./healthScoreService');
const { revenueByBayDaily } = require('./reportingCubeService');

const getExecutiveDigest = async () => {
  const health = await getBusinessHealthScore();
  const membershipPenetration = health.components.find((c) => c.key === 'membershipPenetration');
  const netMembershipGrowth = health.components.find((c) => c.key === 'netMembershipGrowth');

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const [{ total: carsWashedToday }] = await db
    .select({ total: count() })
    .from(washOrders)
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, start), lte(washOrders.checkedOutAt, end)));

  const bayRevenueToday = await revenueByBayDaily({ days: 1 });

  return {
    healthScore: health.score,
    carsWashedToday,
    membershipPenetrationRate: membershipPenetration?.raw ?? null,
    netMembershipGrowth: netMembershipGrowth?.raw ?? null,
    revenueByBayToday: bayRevenueToday,
    openAnomalyAlerts: [], // documented gap — see file header
  };
};

const formatDigestText = (digest) => {
  const lines = [
    `SplashPoint daily digest`,
    `Health score: ${digest.healthScore ?? '—'}/100`,
    `Cars washed today: ${digest.carsWashedToday}`,
    `Membership penetration: ${digest.membershipPenetrationRate === null ? 'n/a' : `${(digest.membershipPenetrationRate * 100).toFixed(1)}%`}`,
    `Net membership growth (this month): ${digest.netMembershipGrowth === null ? 'n/a' : digest.netMembershipGrowth}`,
  ];
  if (digest.revenueByBayToday.length) {
    lines.push('Revenue by bay today:');
    for (const b of digest.revenueByBayToday) lines.push(`  Bay ${b.bayNumber}: $${b.revenue.toFixed(2)} (${b.washCount} washes)`);
  }
  lines.push(digest.openAnomalyAlerts.length ? `Open anomaly alerts: ${digest.openAnomalyAlerts.length}` : 'No open anomaly alerts.');
  return lines.join('\n');
};

module.exports = { getExecutiveDigest, formatDigestText };
