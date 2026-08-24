const express = require('express');
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.route('/').get(getServices).post(authorize('admin', 'manager'), createService);
router
  .route('/:id')
  .get(getService)
  .put(authorize('admin', 'manager'), updateService)
  .delete(authorize('admin', 'manager'), deleteService);

module.exports = router;
