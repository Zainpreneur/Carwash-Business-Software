const express = require('express');
const { healthScore, patchWeights } = require('../controllers/healthScoreController');
const {
  revenueByBayDaily, membershipMixWeekly, packageTierMargin, aovByVehicleType, technicianThroughput, arAging,
} = require('../controllers/reportingCubeController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// 02-intelligence/analytics.md's business health score — admin/manager can view (matches
// bir.json's targetRoles of site-manager/owner on the underlying KPIs), but "weighting is
// intentionally visible and editable by owner" specifically — admin only, this app's closest
// equivalent to the spec's owner role, same restriction pattern as user management.
router.use(protect, authorize('admin', 'manager'));
router.get('/health-score', healthScore);
router.patch('/health-score/weights', authorize('admin'), patchWeights);

// The reporting cube's six named reports (five built — equipment-uptime-by-asset needs a
// real Asset entity this app doesn't have, see reportingCubeService.js's header comment).
router.get('/reports/revenue-by-bay-daily', revenueByBayDaily);
router.get('/reports/membership-mix-weekly', membershipMixWeekly);
router.get('/reports/package-tier-margin', packageTierMargin);
router.get('/reports/aov-by-vehicle-type', aovByVehicleType);
router.get('/reports/technician-throughput', technicianThroughput);
router.get('/reports/ar-aging', arAging);

module.exports = router;
