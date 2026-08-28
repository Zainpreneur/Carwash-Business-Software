// Simulation & Forecasting (02-intelligence/simulation.md) — deployment guide step 8, the
// last step of the 8-step build order. "Seven models. The two that matter most ... get the
// deepest treatment here": bay-throughput-queue-simulator and membership-economics-
// simulator. Every model here is a pure, stateless computation over data this app already
// has — nothing is persisted, matching the spec's own framing ("usable from day one on
// stated assumptions") and the same "compute live, don't push" posture used for ticket SLA
// risk and shift no-show flags elsewhere in this app.
//
// Two of the spec's seven models are NOT built:
//   - downtime-cost-simulator needs Asset.status = 'down' windows from
//     03-operations/assets-iot.md, which isn't built (no IoT/Asset entity exists).
//   - demand-forecast's weather-api overlay isn't built (no weather integration) — the
//     baseline day-of-week/hour-of-day curve below is real, just without the rain/pollen
//     multiplier the spec describes on top of it.
// Every stated assumption below (variable cost components, service rates, elasticity) is
// exactly that — a labeled, editable constant, never presented as measured, per the spec's
// own "Calibration and honesty" section.
const { eq, and, gte, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  washOrders,
  washPackages,
  serviceBays,
  membershipPlans,
  membershipSubscriptions,
  shifts,
  employees,
  payrollRuns,
  purchaseOrders,
  expenses,
} = require('../db/schema');

const round2 = (n) => Math.round(n * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_TRUST_DAYS = 56; // "~8 weeks" per the spec's own calibration rule

// Stated assumptions — see file header. All editable, all labeled in every API response
// that uses them via an `assumptions` object, never silently baked into a bare number.
const ASSUMPTIONS = {
  effectiveCapacityFraction: 0.85, // "85% of ceiling, realistic sustained throughput"
  bayAttendantVehiclesPerHour: 8,
  washTechnicianVehiclesPerHour: 6,
  defaultHourlyWage: 16,
  chemicalCostPerWash: 0.85,
  waterEnergyCostPerWash: 0.4,
  defaultVariableCost: 2.35, // chemicals + water/energy + labor, the spec's own worked example
  benchmarkMedianWashesPerMonth: 3.2,
  benchmarkTopDecileWashesPerMonth: 10,
  benchmarkAvgTenureMonths: 14,
  priceElasticity: -0.3, // "10% price increase costs ~3% of the member base"
};

// --- bay-throughput-queue-simulator --------------------------------------------------
// "Models the tunnel as a single-server queue per effective slot ... computes expected
// vehicles/hour capacity and expected queue wait at a given demand level."
const getBayThroughput = async () => {
  const bays = await db.select().from(serviceBays).where(eq(serviceBays.operationalStatus, 'operational'));
  const byLane = { tunnel: bays.filter((b) => b.bayType === 'tunnel-conveyor'), 'detail-bay': bays.filter((b) => b.bayType === 'detail-bay') };

  const since = new Date(Date.now() - 14 * DAY_MS);
  const recentOrders = await db
    .select({ queuedAt: washOrders.queuedAt, deliveryLane: washPackages.deliveryLane })
    .from(washOrders)
    .innerJoin(washPackages, eq(washOrders.package, washPackages._id))
    .where(gte(washOrders.queuedAt, since));

  const lanes = Object.entries(byLane).map(([lane, laneBays]) => {
    const theoreticalCapacityPerHour = round2(laneBays.reduce((sum, b) => sum + (b.avgThroughputPerHour || 0), 0));
    const effectiveCapacityPerHour = round2(theoreticalCapacityPerHour * ASSUMPTIONS.effectiveCapacityFraction);

    const laneOrders = recentOrders.filter((o) => o.deliveryLane === lane);
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const o of laneOrders) hourly[new Date(o.queuedAt).getUTCHours()]++;
    const days = Math.max(1, Math.min(14, Math.ceil((Date.now() - since.getTime()) / DAY_MS)));
    const demandByHour = hourly.map((count) => round2(count / days));
    const peakHour = demandByHour.indexOf(Math.max(...demandByHour));
    const overCapacityHours = demandByHour.reduce((acc, demand, hour) => (demand > effectiveCapacityPerHour ? [...acc, hour] : acc), []);

    return {
      lane,
      bayCount: laneBays.length,
      theoreticalCapacityPerHour,
      effectiveCapacityPerHour,
      demandByHour,
      peakHour,
      peakDemand: demandByHour[peakHour] || 0,
      overCapacityHours,
      structurallyUndersized: overCapacityHours.length > 0,
    };
  });

  return { lanes, assumptions: { effectiveCapacityFraction: ASSUMPTIONS.effectiveCapacityFraction }, sampleDays: Math.min(14, Math.ceil((Date.now() - since.getTime()) / DAY_MS)) };
};

// --- demand-forecast ------------------------------------------------------------------
// Baseline day-of-week/hour-of-day curve from real WashOrder history. No weather-api
// overlay (not built). Falls back to an industry-benchmark-shaped curve, clearly labeled,
// until 8 weeks of real data exist — "before that, show industry-benchmark seasonality
// defaults clearly labeled as such."
const BENCHMARK_HOURLY_SHAPE = [0, 0, 0, 0, 0, 0.2, 0.5, 0.8, 1, 1.1, 1.3, 1.4, 1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.6, 0.4, 0.2, 0, 0, 0];

const getDemandForecast = async () => {
  const [earliestOrder] = await db.select({ queuedAt: washOrders.queuedAt }).from(washOrders).orderBy(washOrders.queuedAt).limit(1);
  const historyDays = earliestOrder ? Math.floor((Date.now() - new Date(earliestOrder.queuedAt).getTime()) / DAY_MS) : 0;
  const trusted = historyDays >= HISTORY_TRUST_DAYS;

  const lookbackDays = historyDays > 0 ? Math.min(historyDays, 90) : 90;
  const since = new Date(Date.now() - lookbackDays * DAY_MS);
  const rows = await db.select({ queuedAt: washOrders.queuedAt }).from(washOrders).where(gte(washOrders.queuedAt, since));

  const byDow = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of rows) {
    const d = new Date(r.queuedAt);
    byDow[d.getUTCDay()][d.getUTCHours()]++;
  }
  const weeksObserved = Math.max(1, Math.floor((historyDays || 1) / 7));
  const observedCurve = byDow.map((hours) => hours.map((count) => round2(count / weeksObserved)));

  const totalObserved = rows.length;
  const dataSource = trusted && totalObserved > 20 ? 'observed' : 'industry-benchmark';
  const curve =
    dataSource === 'observed'
      ? observedCurve
      : Array.from({ length: 7 }, (_, dow) => BENCHMARK_HOURLY_SHAPE.map((v) => round2(v * (dow === 0 || dow === 6 ? 6 : 4))));

  return { dataSource, historyDays, weeklyCurve: curve, note: dataSource === 'industry-benchmark' ? `Needs ~${HISTORY_TRUST_DAYS} days of history (has ${historyDays}) before this switches to observed volume.` : null };
};

// --- staffing-capacity-simulator -------------------------------------------------------
const getStaffingCapacity = async () => {
  const demand = await getDemandForecast();
  const activeEmployees = await db.select().from(employees).where(inArray(employees.status, ['active', 'on-leave']));
  const upcomingShifts = await db
    .select({ startsAt: shifts.startsAt, endsAt: shifts.endsAt, position: employees.position })
    .from(shifts)
    .innerJoin(employees, eq(shifts.employee, employees._id))
    .where(and(gte(shifts.startsAt, new Date()), inArray(shifts.status, ['scheduled', 'completed'])));

  // Coverage by day-of-week/hour from currently scheduled shifts (a rolling snapshot, not
  // a full week guarantee — shifts get scheduled incrementally in this app).
  const coverage = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ 'bay-attendant': 0, 'wash-technician': 0 })));
  for (const s of upcomingShifts) {
    if (!['bay-attendant', 'wash-technician'].includes(s.position)) continue;
    const start = new Date(s.startsAt);
    const end = new Date(s.endsAt);
    for (let t = new Date(start); t < end; t = new Date(t.getTime() + 60 * 60 * 1000)) {
      coverage[t.getUTCDay()][t.getUTCHours()][s.position]++;
    }
  }

  const gaps = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const demandThisHour = demand.weeklyCurve[dow][hour];
      if (demandThisHour <= 0) continue;
      const attendantsNeeded = Math.ceil(demandThisHour / ASSUMPTIONS.bayAttendantVehiclesPerHour);
      const techniciansNeeded = Math.ceil(demandThisHour / ASSUMPTIONS.washTechnicianVehiclesPerHour);
      const scheduled = coverage[dow][hour];
      if (scheduled['bay-attendant'] < attendantsNeeded || scheduled['wash-technician'] < techniciansNeeded) {
        gaps.push({
          dayOfWeek: dow,
          hour,
          demandVehiclesPerHour: demandThisHour,
          needed: { 'bay-attendant': attendantsNeeded, 'wash-technician': techniciansNeeded },
          scheduled,
        });
      }
    }
  }

  return { gaps, activeStaffCount: activeEmployees.length, assumptions: { bayAttendantVehiclesPerHour: ASSUMPTIONS.bayAttendantVehiclesPerHour, washTechnicianVehiclesPerHour: ASSUMPTIONS.washTechnicianVehiclesPerHour }, demandDataSource: demand.dataSource };
};

// --- membership-economics-simulator (the profitability core) --------------------------
const getMembershipEconomics = async () => {
  const throughput = await getBayThroughput();
  const tunnelEffective = throughput.lanes.find((l) => l.lane === 'tunnel')?.effectiveCapacityPerHour;

  const wageRows = await db.select({ hourlyRate: employees.hourlyRate }).from(employees).where(inArray(employees.position, ['bay-attendant', 'wash-technician']));
  const validWages = wageRows.map((r) => r.hourlyRate).filter((r) => r > 0);
  const avgWage = validWages.length ? round2(validWages.reduce((s, w) => s + w, 0) / validWages.length) : ASSUMPTIONS.defaultHourlyWage;
  const throughputForLabor = tunnelEffective > 0 ? tunnelEffective : 14.5; // spec's own worked-example fallback

  const laborCostPerWash = round2(avgWage / throughputForLabor);
  const variableCostPerWash = round2(ASSUMPTIONS.chemicalCostPerWash + ASSUMPTIONS.waterEnergyCostPerWash + laborCostPerWash);

  const plans = await db.select().from(membershipPlans).where(eq(membershipPlans.active, true));
  const activeSubs = await db.select().from(membershipSubscriptions).where(inArray(membershipSubscriptions.status, ['active', 'past-due', 'suspended', 'paused']));
  const cancelledSubs = await db.select().from(membershipSubscriptions).where(eq(membershipSubscriptions.status, 'cancelled'));

  const tiers = plans.map((plan) => {
    const subsForPlan = activeSubs.filter((s) => s.plan === plan._id);
    const breakevenWashesPerMonth = round2(plan.monthlyPrice / variableCostPerWash);

    const hasEnoughSamples = subsForPlan.length >= 5;
    const avgWashesPerMonth = hasEnoughSamples
      ? round2(subsForPlan.reduce((sum, s) => sum + s.washesThisCycle, 0) / subsForPlan.length)
      : ASSUMPTIONS.benchmarkMedianWashesPerMonth;

    const cancelledForPlan = cancelledSubs.filter((s) => s.plan === plan._id);
    const avgTenureMonths = cancelledForPlan.length >= 3
      ? round2(cancelledForPlan.reduce((sum, s) => sum + (new Date(s.updatedAt) - new Date(s.createdAt)) / (30 * DAY_MS), 0) / cancelledForPlan.length)
      : ASSUMPTIONS.benchmarkAvgTenureMonths;

    const contributionMarginPerMonth = round2(plan.monthlyPrice - variableCostPerWash * avgWashesPerMonth);
    const ltv = round2(contributionMarginPerMonth * avgTenureMonths);

    return {
      plan: { _id: plan._id, name: plan.name, tier: plan.tier, monthlyPrice: plan.monthlyPrice },
      activeSubscriptionCount: subsForPlan.length,
      breakevenWashesPerMonth,
      avgWashesPerMonth,
      washesDataSource: hasEnoughSamples ? 'observed' : 'industry-benchmark',
      isLosingMoneyOnAverage: avgWashesPerMonth > breakevenWashesPerMonth,
      contributionMarginPerMonth,
      avgTenureMonths,
      tenureDataSource: cancelledForPlan.length >= 3 ? 'observed' : 'industry-benchmark',
      ltv,
    };
  });

  return { variableCostPerWash, laborCostPerWash, tiers, assumptions: ASSUMPTIONS };
};

// --- pricing-scenario-simulator --------------------------------------------------------
const getPricingScenario = async ({ planId, priceChangePercent, elasticity = ASSUMPTIONS.priceElasticity }) => {
  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans._id, planId));
  if (!plan) throw Object.assign(new Error('Membership plan not found'), { status: 404 });

  const economics = await getMembershipEconomics();
  const tier = economics.tiers.find((t) => t.plan._id === planId);
  const currentCount = tier?.activeSubscriptionCount || 0;
  const currentPrice = plan.monthlyPrice;
  const newPrice = round2(currentPrice * (1 + priceChangePercent / 100));

  // "a 10% price increase costs ~3% of the member base" — elasticity applied to the member
  // count, symmetric for a price decrease (more signups, not modeled as a hard floor).
  const memberImpactPercent = round2(elasticity * priceChangePercent);
  const newCount = Math.max(0, Math.round(currentCount * (1 + memberImpactPercent / 100)));

  const currentRevenue = round2(currentCount * currentPrice);
  const newRevenue = round2(newCount * newPrice);
  const currentMargin = round2(currentCount * (tier?.contributionMarginPerMonth || 0));
  const newContributionMargin = round2(newPrice - economics.variableCostPerWash * (tier?.avgWashesPerMonth || ASSUMPTIONS.benchmarkMedianWashesPerMonth));
  const newMargin = round2(newCount * newContributionMargin);

  return {
    plan: { _id: plan._id, name: plan.name },
    priceChangePercent,
    elasticity,
    currentPrice,
    newPrice,
    currentMemberCount: currentCount,
    projectedMemberCount: newCount,
    memberImpactPercent,
    revenueDelta: round2(newRevenue - currentRevenue),
    marginDelta: round2(newMargin - currentMargin),
  };
};

// --- cash-flow-forecast -----------------------------------------------------------------
const getCashFlowForecast = async (weeksAhead = 4) => {
  const activeSubs = await db
    .select({ monthlyPrice: membershipPlans.monthlyPrice })
    .from(membershipSubscriptions)
    .innerJoin(membershipPlans, eq(membershipSubscriptions.plan, membershipPlans._id))
    .where(inArray(membershipSubscriptions.status, ['active', 'past-due']));
  const monthlyMRR = round2(activeSubs.reduce((sum, s) => sum + s.monthlyPrice, 0));
  const weeklyMRR = round2((monthlyMRR * 12) / 52);

  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const recentCompleted = await db
    .select({ price: washOrders.price })
    .from(washOrders)
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, since30)));
  const avgTicket = recentCompleted.length ? round2(recentCompleted.reduce((s, o) => s + Number(o.price), 0) / recentCompleted.length) : 25;
  const demand = await getDemandForecast();
  const weeklyVehicleVolume = demand.weeklyCurve.flat().reduce((s, v) => s + v, 0);
  const weeklyPayPerWashRevenue = round2(weeklyVehicleVolume * avgTicket * 0.6); // ~60% of visits are pay-per-wash, not membership — see note below

  const recentPayrollRuns = await db.select().from(payrollRuns).limit(3);
  const avgPayroll = recentPayrollRuns.length ? round2(recentPayrollRuns.reduce((s, r) => s + r.totalAmount, 0) / recentPayrollRuns.length) : 0;
  const weeklyPayroll = round2(avgPayroll / 2); // biweekly -> weekly

  const openPOs = await db.select().from(purchaseOrders).where(inArray(purchaseOrders.status, ['sent', 'partially-received']));
  const weeklyPOOutflow = round2(openPOs.reduce((s, po) => s + po.totalAmount, 0) / weeksAhead); // spread outstanding orders across the window rather than dumping them all in week 1

  const since90 = new Date(Date.now() - 90 * DAY_MS);
  const recentExpenses = await db.select({ amount: expenses.amount }).from(expenses).where(gte(expenses.date, since90));
  const weeklyOtherExpenses = round2(recentExpenses.reduce((s, e) => s + e.amount, 0) / (90 / 7));

  const weeks = [];
  for (let i = 0; i < weeksAhead; i++) {
    const inflow = round2(weeklyMRR + weeklyPayPerWashRevenue);
    const outflow = round2(weeklyPayroll + weeklyPOOutflow + weeklyOtherExpenses);
    weeks.push({ week: i + 1, inflow, outflow, net: round2(inflow - outflow) });
  }

  let running = 0;
  const withRunningBalance = weeks.map((w) => {
    running = round2(running + w.net);
    return { ...w, cumulativeNet: running };
  });

  return {
    weeks: withRunningBalance,
    anyNegativeWeek: withRunningBalance.some((w) => w.cumulativeNet < 0),
    inputs: { weeklyMRR, weeklyPayPerWashRevenue, weeklyPayroll, weeklyPOOutflow, weeklyOtherExpenses, avgTicket, demandDataSource: demand.dataSource },
    note: 'Pay-per-wash revenue assumes ~60% of forecasted visits are pay-per-wash vs. membership-covered — a stated assumption, not derived from an actual membership-vs-pay-per-wash visit split (this app does not track that split directly).',
  };
};

module.exports = {
  ASSUMPTIONS,
  getBayThroughput,
  getDemandForecast,
  getStaffingCapacity,
  getMembershipEconomics,
  getPricingScenario,
  getCashFlowForecast,
};
