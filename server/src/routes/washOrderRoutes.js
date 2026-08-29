const express = require('express');
const {
  getWashOrders,
  getCheckoutStats,
  getCustomerMessages,
  getWashOrder,
  createWashOrder,
  assignBay,
  startWash,
  completeWash,
  qualityCheck,
  checkout,
  collectFleetInvoice,
  cancelWashOrder,
  deleteWashOrder,
} = require('../controllers/washOrderController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { denyFleetAccountManagerWrite } = require('../utils/employeeScope');

const router = express.Router();

router.use(protect);
// ABAC (01-foundation/security.md): "fleet-account-manager ... read-only on WashOrder" — a
// staff login whose linked Employee.position is fleet-account-manager is blocked from every
// mutating route below, while every GET stays open (further scoped to the fleet segment
// inside getWashOrders itself). Any other staff position, or a staff user with no linked
// Employee row, is unaffected.
router.route('/').get(getWashOrders).post(denyFleetAccountManagerWrite, createWashOrder);
// Must be registered before /:id or Express would swallow these as an :id lookup.
router.get('/checkout-stats', getCheckoutStats);
router.get('/customer-messages', authorize('admin', 'manager'), getCustomerMessages);
router.route('/:id').get(getWashOrder).delete(authorize('admin', 'manager'), deleteWashOrder);

// wash-a-vehicle lifecycle transitions
router.patch('/:id/assign-bay', denyFleetAccountManagerWrite, assignBay);
router.patch('/:id/start-wash', denyFleetAccountManagerWrite, startWash);
router.patch('/:id/complete-wash', denyFleetAccountManagerWrite, completeWash);
router.patch('/:id/qc', denyFleetAccountManagerWrite, qualityCheck);
router.patch('/:id/checkout', denyFleetAccountManagerWrite, checkout);
router.patch('/:id/collect-fleet-invoice', authorize('admin', 'manager'), collectFleetInvoice);
router.patch('/:id/cancel', denyFleetAccountManagerWrite, cancelWashOrder);

module.exports = router;
