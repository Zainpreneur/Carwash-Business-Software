const express = require('express');
const {
  getWashOrders,
  getWashOrder,
  createWashOrder,
  assignBay,
  startWash,
  completeWash,
  qualityCheck,
  checkout,
  cancelWashOrder,
  deleteWashOrder,
} = require('../controllers/washOrderController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.route('/').get(getWashOrders).post(createWashOrder);
router.route('/:id').get(getWashOrder).delete(authorize('admin', 'manager'), deleteWashOrder);

// wash-a-vehicle lifecycle transitions
router.patch('/:id/assign-bay', assignBay);
router.patch('/:id/start-wash', startWash);
router.patch('/:id/complete-wash', completeWash);
router.patch('/:id/qc', qualityCheck);
router.patch('/:id/checkout', checkout);
router.patch('/:id/cancel', cancelWashOrder);

module.exports = router;
