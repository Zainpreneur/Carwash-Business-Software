// Business health score (02-intelligence/analytics.md's "Executive View" composite). Per-KPI
// formulas are lifted verbatim from bir.json's `kpis` list, not reinvented here:
//   bay-utilization-rate        = sum(washCompletedAt - washStartedAt) / (operational hours x bay count)
//   membership-penetration-rate = count(WashOrder where paymentMethod=membership) / count(WashOrder), trailing 30 days
//   net-membership-growth       = count(MembershipSubscription: active entries this month) - count(cancelled this month)
//   equipment-uptime-rate       = 1 - (sum(Asset downtime hours) / (Asset count x operational hours)), trailing 30 days
//   avg-review-rating           = avg(external review rating), trailing 90 days
//
// Two things this app can't compute exactly as specified, documented rather than silently
// approximated:
//   - equipment-uptime-rate wants Asset.downtimeHours from a real IoT/maintenance-log entity
//     (03-operations/assets-iot.md), which this app doesn't have. The best real signal this
//     app holds is ServiceBay.operationalStatus — a current snapshot, not a downtime-hours
//     time series — so this computes "share of bays not currently down/retired" instead and
//     labels it a snapshot proxy, not the spec's actual trailing-30-day downtime-hours ratio.
//   - avg-review-rating's spec text says "across Google/Yelp" specifically; this app's
//     `reviews` table also holds Instagram/Facebook/TikTok/manual entries (no separate
//     Google/Yelp-only connector), so this averages every logged review regardless of source.
//
// Normalization: the five KPIs above are not naturally on the same scale (a 0-1 rate, a raw
// subscription-count delta, and a 1-5 star average can't be weighted-summed as-is without
// distorting the result). This app's own choice, not specified by the spec: each component is
// mapped to a 0-100 score first, then combined by the spec's own weights. A component with no
// underlying data (e.g. zero reviews logged) is excluded rather than scored as 0, and its
// weight is redistributed proportionally across the remaining components — scoring "no
// reviews yet" the same as "1-star reviews" would be actively misleading.
const { eq, and, gte, isNotNull } = require('drizzle-orm');
const { db } = require('../config/db');
const { washOrders, serviceBays, membershipSubscriptions, reviews, healthScoreWeights } = require('../db/schema');

const DAY_MS = 24 * 60 * 60 * 1000;
const OPERATING_HOURS_PER_DAY = 13; // 7am-8pm, matches wash-concierge's own stated hours
const PENETRATION_WINDOW_DAYS = 30;
const UPTIME_WINDOW_DAYS = 30;
const REVIEW_WINDOW_DAYS = 90;

const round1 = (n) => Math.round(n * 10) / 10;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

const DEFAULT_WEIGHTS = { membershipPenetration: 0.3, bayUtilization: 0.25, netMembershipGrowth: 0.2, avgReviewRating: 0.15, equipmentUptime: 0.1 };

// Single-row settings table — create the default row on first read rather than requiring a
// migration-time seed, so a fresh deploy still has sane weights from the first request.
const getWeights = async () => {
  const [row] = await db.select().from(healthScoreWeights).limit(1);
  if (row) return row;
  const [created] = await db.insert(healthScoreWeights).values(DEFAULT_WEIGHTS).returning();
  return created;
};

const updateWeights = async (patch, userId) => {
  const current = await getWeights();
  const next = {
    membershipPenetration: patch.membershipPenetration ?? current.membershipPenetration,
    bayUtilization: patch.bayUtilization ?? current.bayUtilization,
    netMembershipGrowth: patch.netMembershipGrowth ?? current.netMembershipGrowth,
    avgReviewRating: patch.avgReviewRating ?? current.avgReviewRating,
    equipmentUptime: patch.equipmentUptime ?? current.equipmentUptime,
  };
  const sum = Object.values(next).reduce((a, b) => a + Number(b), 0);
  if (Math.abs(sum - 1) > 0.01) {
    throw new Error(`Weights must sum to 1.0 (got ${round1(sum)}) — "intentionally visible and editable," not "intentionally inconsistent."`);
  }
  const [updated] = await db.update(healthScoreWeights).set({ ...next, updatedBy: userId, updatedAt: new Date() }).where(eq(healthScoreWeights._id, current._id)).returning();
  return updated;
};

const membershipPenetrationRate = async () => {
  const since = new Date(Date.now() - PENETRATION_WINDOW_DAYS * DAY_MS);
  const rows = await db.select({ paymentMethod: washOrders.paymentMethod }).from(washOrders).where(gte(washOrders.createdAt, since));
  if (rows.length === 0) return null;
  const membershipCount = rows.filter((r) => r.paymentMethod === 'membership').length;
  return clamp01(membershipCount / rows.length);
};

const bayUtilizationRate = async () => {
  const bays = await db.select().from(serviceBays);
  const operationalBays = bays.filter((b) => b.operationalStatus !== 'retired');
  if (operationalBays.length === 0) return null;

  const since = new Date(Date.now() - UPTIME_WINDOW_DAYS * DAY_MS);
  const completed = await db
    .select({ washStartedAt: washOrders.washStartedAt, washCompletedAt: washOrders.washCompletedAt })
    .from(washOrders)
    .where(and(gte(washOrders.washCompletedAt, since), isNotNull(washOrders.washStartedAt)));

  const consumedHours = completed.reduce((sum, o) => {
    if (!o.washStartedAt || !o.washCompletedAt) return sum;
    return sum + Math.max(0, (new Date(o.washCompletedAt) - new Date(o.washStartedAt)) / (60 * 60 * 1000));
  }, 0);

  const daysElapsed = Math.min(UPTIME_WINDOW_DAYS, Math.max(1, Math.ceil((Date.now() - since.getTime()) / DAY_MS)));
  const availableHours = operationalBays.length * OPERATING_HOURS_PER_DAY * daysElapsed;
  return availableHours > 0 ? clamp01(consumedHours / availableHours) : null;
};

// "This month" per bir.json's literal wording — calendar month to date, not a rolling window.
const netMembershipGrowth = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const subs = await db.select({ status: membershipSubscriptions.status, createdAt: membershipSubscriptions.createdAt, updatedAt: membershipSubscriptions.updatedAt }).from(membershipSubscriptions);
  const newThisMonth = subs.filter((s) => new Date(s.createdAt) >= monthStart).length;
  const cancelledThisMonth = subs.filter((s) => s.status === 'cancelled' && new Date(s.updatedAt) >= monthStart).length;
  const activeAtMonthStart = subs.filter((s) => s.status !== 'cancelled' && new Date(s.createdAt) < monthStart).length;
  return { net: newThisMonth - cancelledThisMonth, newThisMonth, cancelledThisMonth, activeAtMonthStart };
};

const avgReviewRating = async () => {
  const since = new Date(Date.now() - REVIEW_WINDOW_DAYS * DAY_MS);
  const rows = await db.select({ rating: reviews.rating }).from(reviews).where(gte(reviews.createdAt, since));
  if (rows.length === 0) return null;
  return rows.reduce((sum, r) => sum + r.rating, 0) / rows.length;
};

// Documented proxy — see file header. A snapshot of "not currently down," not the spec's
// actual trailing-30-day downtime-hours ratio (no Asset entity to compute that from).
const equipmentUptimeProxy = async () => {
  const bays = await db.select().from(serviceBays);
  const relevant = bays.filter((b) => b.operationalStatus !== 'retired');
  if (relevant.length === 0) return null;
  const up = relevant.filter((b) => b.operationalStatus === 'operational').length;
  return clamp01(up / relevant.length);
};

const getBusinessHealthScore = async () => {
  const weights = await getWeights();
  const [penetration, utilization, growth, reviewAvg, uptime] = await Promise.all([
    membershipPenetrationRate(),
    bayUtilizationRate(),
    netMembershipGrowth(),
    avgReviewRating(),
    equipmentUptimeProxy(),
  ]);

  // Growth is a raw count, not a rate — normalized relative to the active base so a shop
  // with 5 members and a shop with 500 aren't scored on the same absolute-count scale.
  // Clamped to +/-50% relative growth mapping to the 0-100 range; this app's own choice,
  // since bir.json's formula stops at the raw count and doesn't specify a scoring scale.
  const growthRate = growth.activeAtMonthStart > 0 ? growth.net / growth.activeAtMonthStart : (growth.net > 0 ? 1 : 0);
  const growthScore = clamp01((Math.max(-0.5, Math.min(0.5, growthRate)) + 0.5)) * 100;

  const components = [
    { key: 'membershipPenetration', label: 'Membership Penetration', weight: weights.membershipPenetration, raw: penetration, score: penetration === null ? null : penetration * 100, unit: 'rate' },
    { key: 'bayUtilization', label: 'Bay Utilization', weight: weights.bayUtilization, raw: utilization, score: utilization === null ? null : utilization * 100, unit: 'rate' },
    { key: 'netMembershipGrowth', label: 'Net Membership Growth', weight: weights.netMembershipGrowth, raw: growth.net, score: growthScore, unit: 'count', detail: growth },
    { key: 'avgReviewRating', label: 'Avg Review Rating', weight: weights.avgReviewRating, raw: reviewAvg, score: reviewAvg === null ? null : ((reviewAvg - 1) / 4) * 100, unit: 'stars' },
    { key: 'equipmentUptime', label: 'Equipment Uptime (proxy)', weight: weights.equipmentUptime, raw: uptime, score: uptime === null ? null : uptime * 100, unit: 'rate' },
  ];

  const available = components.filter((c) => c.score !== null);
  const weightSum = available.reduce((sum, c) => sum + c.weight, 0);
  const score = weightSum > 0 ? round1(available.reduce((sum, c) => sum + c.score * c.weight, 0) / weightSum) : null;

  return {
    score,
    components: components.map((c) => ({ ...c, score: c.score === null ? null : round1(c.score) })),
    excludedFromScore: components.filter((c) => c.score === null).map((c) => c.key),
    weights,
  };
};

module.exports = { getBusinessHealthScore, getWeights, updateWeights };
