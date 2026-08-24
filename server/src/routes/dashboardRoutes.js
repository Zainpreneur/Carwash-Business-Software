const express = require('express');
const {
  getSummary,
  getRevenueChart,
  getServiceBreakdown,
  getStatusBreakdown,
  getUpcomingBookings,
  getInsights,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/summary', getSummary);
router.get('/revenue-chart', getRevenueChart);
router.get('/service-breakdown', getServiceBreakdown);
router.get('/status-breakdown', getStatusBreakdown);
router.get('/upcoming-bookings', getUpcomingBookings);
router.get('/insights', getInsights);

module.exports = router;
