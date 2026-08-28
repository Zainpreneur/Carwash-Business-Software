const express = require('express');
const { healthScore, patchWeights } = require('../controllers/healthScoreController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// 02-intelligence/analytics.md's business health score — admin/manager can view (matches
// bir.json's targetRoles of site-manager/owner on the underlying KPIs), but "weighting is
// intentionally visible and editable by owner" specifically — admin only, this app's closest
// equivalent to the spec's owner role, same restriction pattern as user management.
router.use(protect, authorize('admin', 'manager'));
router.get('/health-score', healthScore);
router.patch('/health-score/weights', authorize('admin'), patchWeights);

module.exports = router;
