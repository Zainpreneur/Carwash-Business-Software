const express = require('express');
const {
  getSubscriptions,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  markPaidManually,
  cancelSubscription,
} = require('../controllers/membershipController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.route('/').get(getSubscriptions).post(createSubscription);
router.patch('/:id/pause', pauseSubscription);
router.patch('/:id/resume', resumeSubscription);
router.patch('/:id/mark-paid', markPaidManually);
router.patch('/:id/cancel', cancelSubscription);

module.exports = router;
