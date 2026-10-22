const express = require('express');
const {
  getBusinessInfo,
  getPublicServices,
  getAvailability,
  createPublicBooking,
  getBookingStatus,
} = require('../controllers/publicBookingController');

const router = express.Router();

// Public endpoints — no authentication required.
// Customers use these to book a wash from a business's booking page.
router.get('/:slug/info', getBusinessInfo);
router.get('/:slug/services', getPublicServices);
router.get('/:slug/availability', getAvailability);
router.post('/:slug/bookings', createPublicBooking);
router.get('/:slug/booking/:id', getBookingStatus);

module.exports = router;
