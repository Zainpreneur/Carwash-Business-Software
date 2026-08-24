const asyncHandler = require('express-async-handler');
const { eq, sql, count, gte, lte, and, desc, asc, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { bookings, bookingServices, customers, expenses, services, vehicles, users } = require('../db/schema');

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const getSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const completedTodayWhere = and(
    eq(bookings.status, 'completed'),
    gte(bookings.scheduledAt, todayStart),
    lte(bookings.scheduledAt, todayEnd)
  );
  const completedMonthWhere = and(
    eq(bookings.status, 'completed'),
    gte(bookings.scheduledAt, monthStart),
    lte(bookings.scheduledAt, monthEnd)
  );

  const [
    [{ total: todayBookings }],
    [{ total: pendingBookings }],
    [{ total: inProgressBookings }],
    todayAgg,
    monthRevenueAgg,
    monthExpenseAgg,
    [{ total: totalCustomers }],
    [{ total: activeServices }],
  ] = await Promise.all([
    db.select({ total: count() }).from(bookings).where(and(gte(bookings.scheduledAt, todayStart), lte(bookings.scheduledAt, todayEnd))),
    db.select({ total: count() }).from(bookings).where(eq(bookings.status, 'pending')),
    db.select({ total: count() }).from(bookings).where(eq(bookings.status, 'in-progress')),
    db
      .select({ revenue: sql`coalesce(sum(${bookings.total}), 0)`.mapWith(Number), bookingsCount: count() })
      .from(bookings)
      .where(completedTodayWhere),
    db
      .select({ revenue: sql`coalesce(sum(${bookings.total}), 0)`.mapWith(Number) })
      .from(bookings)
      .where(completedMonthWhere),
    db
      .select({ amount: sql`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number) })
      .from(expenses)
      .where(and(gte(expenses.date, monthStart), lte(expenses.date, monthEnd))),
    db.select({ total: count() }).from(customers),
    db.select({ total: count() }).from(services).where(eq(services.active, true)),
  ]);

  const todayRevenue = todayAgg[0]?.revenue || 0;
  const monthRevenue = monthRevenueAgg[0]?.revenue || 0;
  const monthExpenses = monthExpenseAgg[0]?.amount || 0;

  res.json({
    todayBookings,
    pendingBookings,
    inProgressBookings,
    todayRevenue,
    todayCompletedCount: todayAgg[0]?.bookingsCount || 0,
    monthRevenue,
    monthExpenses,
    monthProfit: monthRevenue - monthExpenses,
    totalCustomers,
    activeServices,
  });
});

const getRevenueChart = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 14;
  const start = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const results = await db
    .select({
      day: sql`to_char(${bookings.scheduledAt}, 'YYYY-MM-DD')`,
      revenue: sql`coalesce(sum(${bookings.total}), 0)`.mapWith(Number),
      bookingsCount: count(),
    })
    .from(bookings)
    .where(and(eq(bookings.status, 'completed'), gte(bookings.scheduledAt, start)))
    .groupBy(sql`to_char(${bookings.scheduledAt}, 'YYYY-MM-DD')`);

  const map = new Map(results.map((r) => [r.day, r]));
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key);
    series.push({ date: key, revenue: entry?.revenue || 0, bookings: entry?.bookingsCount || 0 });
  }
  res.json(series);
});

const getServiceBreakdown = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;
  const start = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const results = await db
    .select({
      name: bookingServices.name,
      bookingCount: count(),
      revenue: sql`sum(${bookingServices.price})`.mapWith(Number),
    })
    .from(bookingServices)
    .innerJoin(bookings, eq(bookingServices.booking, bookings._id))
    .where(and(eq(bookings.status, 'completed'), gte(bookings.scheduledAt, start)))
    .groupBy(bookingServices.name)
    .orderBy(desc(sql`sum(${bookingServices.price})`))
    .limit(8);

  res.json(
    results.map((r) => ({ name: r.name, count: Number(r.bookingCount), revenue: r.revenue }))
  );
});

const getStatusBreakdown = asyncHandler(async (req, res) => {
  const results = await db
    .select({ status: bookings.status, total: count() })
    .from(bookings)
    .groupBy(bookings.status);
  res.json(results.map((r) => ({ status: r.status, count: Number(r.total) })));
});

const getUpcomingBookings = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: bookings._id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      priority: bookings.priority,
      scheduledAt: bookings.scheduledAt,
      total: bookings.total,
      customer: { _id: customers._id, name: customers.name, phone: customers.phone },
      vehicle: {
        _id: vehicles._id,
        make: vehicles.make,
        model: vehicles.model,
        plateNumber: vehicles.plateNumber,
      },
      assignedStaff: { _id: users._id, name: users.name },
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customer, customers._id))
    .innerJoin(vehicles, eq(bookings.vehicle, vehicles._id))
    .leftJoin(users, eq(bookings.assignedStaff, users._id))
    .where(
      and(
        inArray(bookings.status, ['pending', 'confirmed', 'in-progress']),
        gte(bookings.scheduledAt, startOfDay(new Date()))
      )
    )
    .orderBy(asc(bookings.scheduledAt))
    .limit(8);

  res.json(rows.map((r) => ({ ...r, services: [] })));
});

// Blueprint agent_business_advisor — rule-based insights & recommendations
const getInsights = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const days30 = startOfDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    monthAgg,
    prevMonthAgg,
    expenseAgg,
    prevExpenseAgg,
    topServices,
    [{ total: pendingAging }],
    repeatAgg,
    statusCounts,
    [{ total: totalCustomers }],
  ] = await Promise.all([
    db
      .select({
        revenue: sql`coalesce(sum(${bookings.total}), 0)`.mapWith(Number),
        avgValue: sql`coalesce(avg(${bookings.total}), 0)`.mapWith(Number),
        bookingsCount: count(),
      })
      .from(bookings)
      .where(and(eq(bookings.status, 'completed'), gte(bookings.scheduledAt, monthStart))),
    db
      .select({ revenue: sql`coalesce(sum(${bookings.total}), 0)`.mapWith(Number) })
      .from(bookings)
      .where(and(eq(bookings.status, 'completed'), gte(bookings.scheduledAt, prevStart), lte(bookings.scheduledAt, monthStart))),
    db
      .select({ amount: sql`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number) })
      .from(expenses)
      .where(gte(expenses.date, monthStart)),
    db
      .select({ amount: sql`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number) })
      .from(expenses)
      .where(and(gte(expenses.date, prevStart), lte(expenses.date, monthStart))),
    db
      .select({ name: bookingServices.name, revenue: sql`sum(${bookingServices.price})`.mapWith(Number), bookingCount: count() })
      .from(bookingServices)
      .innerJoin(bookings, eq(bookingServices.booking, bookings._id))
      .where(and(eq(bookings.status, 'completed'), gte(bookings.scheduledAt, days30)))
      .groupBy(bookingServices.name)
      .orderBy(desc(sql`sum(${bookingServices.price})`)),
    db.select({ total: count() }).from(bookings).where(and(eq(bookings.status, 'pending'), lte(bookings.scheduledAt, weekAgo))),
    db
      .select({ repeats: sql`count(*) filter (where ${customers.visitCount} > 1)`.mapWith(Number) })
      .from(customers),
    db.select({ status: bookings.status, total: count() }).from(bookings).groupBy(bookings.status),
    db.select({ total: count() }).from(customers),
  ]);

  const revenue = monthAgg[0]?.revenue || 0;
  const expensesTotal = expenseAgg[0]?.amount || 0;
  const prevRevenue = prevMonthAgg[0]?.revenue || 0;
  const prevExpenses = prevExpenseAgg[0]?.amount || 0;
  const profit = revenue - expensesTotal;
  const repeatRate = totalCustomers ? Math.round(((repeatAgg[0]?.repeats || 0) / totalCustomers) * 100) : 0;
  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, Number(s.total)]));

  const recommendations = [];
  if (pendingAging > 0) {
    recommendations.push(`${pendingAging} pending booking(s) are over a week old — confirm or reschedule them.`);
  }
  if (prevExpenses > 0 && expensesTotal > prevExpenses * 1.2) {
    recommendations.push(
      `Expenses are up ${Math.round(((expensesTotal - prevExpenses) / prevExpenses) * 100)}% vs last month — review the largest entries.`
    );
  }
  if (prevRevenue > 0 && revenue < prevRevenue * 0.8) {
    recommendations.push('Revenue is trending below last month — consider a promotion on lower-demand services.');
  }
  if (repeatRate < 40 && totalCustomers >= 5) {
    recommendations.push(`Only ${repeatRate}% of customers have re-booked — launch a loyalty push or follow-up campaign.`);
  }
  if (topServices.length > 0) {
    recommendations.push(`"${topServices[0].name}" is your top earner in the last 30 days ($${Number(topServices[0].revenue).toFixed(2)}) — keep it stocked and staffed.`);
  }
  if ((statusMap.cancelled || 0) > (statusMap.completed || 0) * 0.25) {
    recommendations.push('Cancellation rate is high — review scheduling conflicts and reminder notifications.');
  }

  res.json({
    summary: {
      revenue,
      expenses: expensesTotal,
      profit,
      avgBookingValue: Math.round((monthAgg[0]?.avgValue || 0) * 100) / 100,
      completedThisMonth: monthAgg[0]?.bookingsCount || 0,
      repeatCustomerRate: repeatRate,
      totalCustomers,
      statusBreakdown: statusMap,
    },
    topServices: topServices.map((t) => ({ name: t.name, revenue: t.revenue, count: Number(t.bookingCount) })),
    recommendations,
  });
});

module.exports = {
  getSummary,
  getRevenueChart,
  getServiceBreakdown,
  getStatusBreakdown,
  getUpcomingBookings,
  getInsights,
};
