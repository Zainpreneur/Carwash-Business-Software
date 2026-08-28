// The reporting cube (02-intelligence/analytics.md) — six named reports, each sliced by one
// of the spec's own dimensions. Aggregation is done in JS over a bounded window rather than
// raw SQL date_trunc, matching the rest of this app's services (segmentService,
// simulationService) — the row counts at this app's scale don't need database-side grouping.
//
// Revenue measure definition, kept consistent everywhere it's used here (per the spec's own
// "Reports never sum raw price as Revenue" rule): WashOrder.price is tax-inclusive, so every
// Revenue/AverageOrderValue figure below is price net of its embedded TAX_RATE portion, the
// same net figure the ledger's 4000/4100/4200 accounts recognize.
//
// Not built (documented, not silently skipped): `equipment-uptime-by-asset` — needs a real
// Asset entity with a downtime-hours log (03-operations/assets-iot.md), which this app
// doesn't have; healthScoreService's equipment-uptime component already documents the same
// gap with the best available proxy (ServiceBay.operationalStatus), and there's no
// per-Asset breakdown to add on top of a proxy that has no per-Asset granularity to begin
// with.
const { eq, and, gte, isNull, isNotNull } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  washOrders, serviceBays, vehicles, washPackages,
  packageSupplyUsage, supplies, employees, shifts,
} = require('../db/schema');
const { TAX_RATE } = require('./ledgerService');

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round(n * 100) / 100;
const netOfTax = (price) => round2(Number(price) / (1 + TAX_RATE));

// ISO week key (Monday-start) so "this week"/"last week" buckets line up with a real
// calendar week rather than a rolling 7-day window that drifts with today's date.
const isoWeekKey = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 1 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

// --- revenue-by-bay-daily ---------------------------------------------------------------
const revenueByBayDaily = async ({ days = 14 } = {}) => {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await db
    .select({ bayNumber: serviceBays.bayNumber, checkedOutAt: washOrders.checkedOutAt, price: washOrders.price })
    .from(washOrders)
    .innerJoin(serviceBays, eq(washOrders.bay, serviceBays._id))
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, since)));

  const byKey = new Map();
  for (const r of rows) {
    const day = new Date(r.checkedOutAt).toISOString().slice(0, 10);
    const key = `${r.bayNumber}|${day}`;
    const entry = byKey.get(key) || { bayNumber: r.bayNumber, date: day, revenue: 0, washCount: 0 };
    entry.revenue = round2(entry.revenue + netOfTax(r.price));
    entry.washCount += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.bayNumber - b.bayNumber);
};

// --- membership-mix-weekly ---------------------------------------------------------------
const membershipMixWeekly = async ({ weeks = 8 } = {}) => {
  const since = new Date(Date.now() - weeks * 7 * DAY_MS);
  const rows = await db
    .select({ paymentMethod: washOrders.paymentMethod, checkedOutAt: washOrders.checkedOutAt, price: washOrders.price })
    .from(washOrders)
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, since)));

  const byKey = new Map();
  for (const r of rows) {
    const week = isoWeekKey(new Date(r.checkedOutAt));
    const key = `${week}|${r.paymentMethod}`;
    const entry = byKey.get(key) || { week, paymentMethod: r.paymentMethod, revenue: 0, washCount: 0 };
    entry.revenue = round2(entry.revenue + netOfTax(r.price));
    entry.washCount += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => a.week.localeCompare(b.week));
};

// --- package-tier-margin ------------------------------------------------------------------
// ChemicalCostPerWash comes from packageSupplyUsage x Supply.unitCost — a real per-wash
// consumption model this app already built for inventory-forecaster, reused here rather than
// re-derived. GrossMargin needs a real average revenue per wash for that tier to subtract
// the chemical cost from, trailing 30 days (same window the health score uses).
const packageTierMargin = async () => {
  const packages = await db.select().from(washPackages).where(eq(washPackages.active, true));
  const usage = await db.select().from(packageSupplyUsage);
  const supplyRows = await db.select().from(supplies);
  const supplyCost = new Map(supplyRows.map((s) => [s._id, s.unitCost]));

  const since = new Date(Date.now() - 30 * DAY_MS);
  const orders = await db
    .select({ package: washOrders.package, price: washOrders.price })
    .from(washOrders)
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, since)));

  return packages.map((pkg) => {
    const chemicalCostPerWash = round2(
      usage.filter((u) => u.package === pkg._id).reduce((sum, u) => sum + u.quantityPerWash * (supplyCost.get(u.supply) || 0), 0)
    );
    const pkgOrders = orders.filter((o) => o.package === pkg._id);
    const avgRevenuePerWash = pkgOrders.length ? round2(pkgOrders.reduce((sum, o) => sum + netOfTax(o.price), 0) / pkgOrders.length) : null;
    const grossMargin = avgRevenuePerWash === null ? null : round2(avgRevenuePerWash - chemicalCostPerWash);
    return {
      tier: pkg.tier,
      packageName: pkg.name,
      washCount: pkgOrders.length,
      avgRevenuePerWash,
      chemicalCostPerWash,
      grossMargin,
      grossMarginPercent: grossMargin === null || !avgRevenuePerWash ? null : round2((grossMargin / avgRevenuePerWash) * 100),
    };
  });
};

// --- aov-by-vehicle-type ------------------------------------------------------------------
const aovByVehicleType = async ({ days = 30 } = {}) => {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await db
    .select({ type: vehicles.type, price: washOrders.price })
    .from(washOrders)
    .innerJoin(vehicles, eq(washOrders.vehicle, vehicles._id))
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, since)));

  const byType = new Map();
  for (const r of rows) {
    const entry = byType.get(r.type) || { vehicleType: r.type, washCount: 0, totalRevenue: 0 };
    entry.washCount += 1;
    entry.totalRevenue = round2(entry.totalRevenue + netOfTax(r.price));
    byType.set(r.type, entry);
  }
  return [...byType.values()].map((e) => ({ ...e, averageOrderValue: round2(e.totalRevenue / e.washCount) })).sort((a, b) => b.washCount - a.washCount);
};

// --- technician-throughput -----------------------------------------------------------------
// bir.json's dimension/measure pairing here (BayUtilization by Technician) doesn't quite fit
// a person — utilization is a bay-capacity concept. This app's own substitute: washes handled
// per hour actually worked (from real Shift clock-in/out), the closest real per-technician
// throughput measure this app's data can support.
const technicianThroughput = async ({ weeks = 8 } = {}) => {
  const since = new Date(Date.now() - weeks * 7 * DAY_MS);
  const orders = await db
    .select({ assignedTechnician: washOrders.assignedTechnician, checkedOutAt: washOrders.checkedOutAt })
    .from(washOrders)
    .where(and(eq(washOrders.status, 'completed'), gte(washOrders.checkedOutAt, since), isNotNull(washOrders.assignedTechnician)));

  const emp = await db.select().from(employees);
  const empByUser = new Map(emp.filter((e) => e.user).map((e) => [e.user, e]));
  const shiftRows = await db.select().from(shifts).where(and(gte(shifts.startsAt, since), eq(shifts.status, 'completed')));

  const byTech = new Map();
  for (const o of orders) {
    if (!o.assignedTechnician) continue;
    const week = isoWeekKey(new Date(o.checkedOutAt));
    const key = `${o.assignedTechnician}|${week}`;
    const entry = byTech.get(key) || { userId: o.assignedTechnician, week, washCount: 0 };
    entry.washCount += 1;
    byTech.set(key, entry);
  }

  return [...byTech.values()].map((entry) => {
    const employee = empByUser.get(entry.userId);
    const hoursWorked = shiftRows
      .filter((s) => employee && s.employee === employee._id && isoWeekKey(new Date(s.startsAt)) === entry.week)
      .reduce((sum, s) => sum + (new Date(s.endsAt) - new Date(s.startsAt)) / (60 * 60 * 1000), 0);
    return {
      employeeName: employee?.name || 'Unassigned',
      week: entry.week,
      washCount: entry.washCount,
      hoursWorked: round2(hoursWorked),
      washesPerHour: hoursWorked > 0 ? round2(entry.washCount / hoursWorked) : null,
    };
  }).sort((a, b) => a.week.localeCompare(b.week) || b.washCount - a.washCount);
};

// --- AR Aging --------------------------------------------------------------------------
// Fleet invoices only (pay-per-wash and membership are collected at time of service, per the
// spec's own text). Buckets current/15/30/45+ by days since checkedOutAt, for every
// fleet-invoice order that hasn't been marked collected yet (washOrderController's new
// collectFleetInvoice — see ledgerService.postFleetInvoiceCollection's header comment for why
// this collection event didn't exist before this phase).
const AGE_BUCKETS = [
  { key: 'current', label: 'Current (0-15 days)', max: 15 },
  { key: 'days15', label: '15-30 days', max: 30 },
  { key: 'days30', label: '30-45 days', max: 45 },
  { key: 'days45plus', label: '45+ days', max: Infinity },
];

const arAging = async () => {
  const outstanding = await db
    .select({
      _id: washOrders._id,
      orderNumber: washOrders.orderNumber,
      customer: washOrders.customer,
      checkedOutAt: washOrders.checkedOutAt,
      price: washOrders.price,
    })
    .from(washOrders)
    .where(and(eq(washOrders.paymentMethod, 'fleet-invoice'), eq(washOrders.status, 'completed'), isNull(washOrders.fleetInvoiceCollectedAt)));

  const buckets = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, { ...b, total: 0, count: 0 }]));
  const invoices = outstanding.map((o) => {
    const ageDays = Math.floor((Date.now() - new Date(o.checkedOutAt).getTime()) / DAY_MS);
    const bucket = AGE_BUCKETS.find((b) => ageDays <= b.max);
    buckets[bucket.key].total = round2(buckets[bucket.key].total + Number(o.price));
    buckets[bucket.key].count += 1;
    return { ...o, ageDays, bucket: bucket.key };
  });

  return { buckets: Object.values(buckets), invoices: invoices.sort((a, b) => b.ageDays - a.ageDays), totalOutstanding: round2(invoices.reduce((sum, i) => sum + Number(i.price), 0)) };
};

module.exports = { revenueByBayDaily, membershipMixWeekly, packageTierMargin, aovByVehicleType, technicianThroughput, arAging };
