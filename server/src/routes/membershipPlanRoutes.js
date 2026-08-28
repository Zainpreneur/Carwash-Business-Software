const express = require('express');
const { getPlans, getPlan, createPlan, updatePlan, deletePlan } = require('../controllers/membershipController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.route('/').get(getPlans).post(authorize('admin', 'manager'), createPlan);
router
  .route('/:id')
  .get(getPlan)
  .put(authorize('admin', 'manager'), updatePlan)
  .delete(authorize('admin', 'manager'), deletePlan);

module.exports = router;
