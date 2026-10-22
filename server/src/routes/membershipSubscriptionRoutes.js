const express = require('express');
const {
  getSubscriptions,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  markPaidManually,
  cancelSubscription,
} = require('../controllers/membershipController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { requireFeature } = require('../services/tenantService');

const router = express.Router();

// Membership subscriptions belong to the membership module, so they follow
// the same plan gate.
router.use(protect, requireFeature('memberships'));
router.route('/').get(getSubscriptions).post(authorize('staff'), createSubscription);
router.patch('/:id/pause', authorize('manager'), pauseSubscription);
router.patch('/:id/resume', authorize('manager'), resumeSubscription);
router.patch('/:id/mark-paid', authorize('manager'), markPaidManually);
router.patch('/:id/cancel', authorize('manager'), cancelSubscription);

module.exports = router;
