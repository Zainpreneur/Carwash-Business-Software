const express = require('express');
const {
  getServiceBays,
  createServiceBay,
  updateServiceBay,
  deleteServiceBay,
} = require('../controllers/serviceBayController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.route('/').get(getServiceBays).post(authorize('admin', 'manager'), createServiceBay);
router
  .route('/:id')
  .put(authorize('admin', 'manager'), updateServiceBay)
  .delete(authorize('admin', 'manager'), deleteServiceBay);

module.exports = router;
