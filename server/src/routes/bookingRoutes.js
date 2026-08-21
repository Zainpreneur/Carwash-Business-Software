const express = require('express');
const {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  updateBookingStatus,
  updatePaymentStatus,
  deleteBooking,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.route('/').get(getBookings).post(createBooking);
router.route('/:id').get(getBooking).put(updateBooking).delete(authorize('admin', 'manager'), deleteBooking);
router.patch('/:id/status', updateBookingStatus);
router.patch('/:id/payment', updatePaymentStatus);

module.exports = router;
