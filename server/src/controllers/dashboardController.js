const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');
const Service = require('../models/Service');

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

  const [
    todayBookings,
    pendingBookings,
    inProgressBookings,
    completedTodayAgg,
    monthRevenueAgg,
    monthExpenseAgg,
    totalCustomers,
    activeServices,
  ] = await Promise.all([
    Booking.countDocuments({ scheduledAt: { $gte: todayStart, $lte: todayEnd } }),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'in-progress' }),
    Booking.aggregate([
      { $match: { status: 'completed', scheduledAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { status: 'completed', scheduledAt: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Customer.countDocuments(),
    Service.countDocuments({ active: true }),
  ]);

  res.json({
    todayBookings,
    pendingBookings,
    inProgressBookings,
    todayRevenue: completedTodayAgg[0]?.total || 0,
    todayCompletedCount: completedTodayAgg[0]?.count || 0,
    monthRevenue: monthRevenueAgg[0]?.total || 0,
    monthExpenses: monthExpenseAgg[0]?.total || 0,
    monthProfit: (monthRevenueAgg[0]?.total || 0) - (monthExpenseAgg[0]?.total || 0),
    totalCustomers,
    activeServices,
  });
});

const getRevenueChart = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 14;
  const start = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const results = await Booking.aggregate([
    { $match: { status: 'completed', scheduledAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' } },
        revenue: { $sum: '$total' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const map = new Map(results.map((r) => [r._id, r]));
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key);
    series.push({ date: key, revenue: entry?.revenue || 0, bookings: entry?.bookings || 0 });
  }
  res.json(series);
});

const getServiceBreakdown = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;
  const start = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const results = await Booking.aggregate([
    { $match: { status: 'completed', scheduledAt: { $gte: start } } },
    { $unwind: '$services' },
    {
      $group: {
        _id: '$services.name',
        count: { $sum: 1 },
        revenue: { $sum: '$services.price' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 8 },
  ]);

  res.json(results.map((r) => ({ name: r._id, count: r.count, revenue: r.revenue })));
});

const getStatusBreakdown = asyncHandler(async (req, res) => {
  const results = await Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json(results.map((r) => ({ status: r._id, count: r.count })));
});

const getUpcomingBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({
    status: { $in: ['pending', 'confirmed', 'in-progress'] },
    scheduledAt: { $gte: startOfDay(new Date()) },
  })
    .sort({ scheduledAt: 1 })
    .limit(8)
    .populate('customer', 'name phone')
    .populate('vehicle', 'make model plateNumber')
    .populate('assignedStaff', 'name');
  res.json(bookings);
});

module.exports = {
  getSummary,
  getRevenueChart,
  getServiceBreakdown,
  getStatusBreakdown,
  getUpcomingBookings,
};
