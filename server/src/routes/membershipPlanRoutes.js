const express = require('express');
const { getPlans, getPlan, createPlan, updatePlan, deletePlan } = require('../controllers/membershipController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { requireFeature } = require('../services/tenantService');

const router = express.Router();

// Membership plans sell washes to end customers — a module that only exists on
// plans that include it.
router.use(protect, requireFeature('memberships'));
router.route('/').get(getPlans).post(authorize('manager'), createPlan);
router
  .route('/:id')
  .get(getPlan)
  .put(authorize('manager'), updatePlan)
  .delete(authorize('manager'), deletePlan);

module.exports = router;
