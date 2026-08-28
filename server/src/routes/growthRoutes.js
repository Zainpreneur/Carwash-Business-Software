const express = require('express');
const {
  segmentSummary,
  segmentedCustomers,
  getFleetInquiries,
  createFleetInquiry,
  updateFleetInquiryStatus,
  getReviews,
  createReview,
} = require('../controllers/growthController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Growth cluster (04-growth/marketing.md, 04-growth/social-media.md) — admin/manager only,
// same gate as Finance/Reports/Simulations.
router.use(protect, authorize('admin', 'manager'));

router.get('/segments/summary', segmentSummary);
router.get('/segments/customers', segmentedCustomers);

router.route('/fleet-inquiries').get(getFleetInquiries).post(createFleetInquiry);
router.patch('/fleet-inquiries/:id/status', updateFleetInquiryStatus);

router.route('/reviews').get(getReviews).post(createReview);

module.exports = router;
