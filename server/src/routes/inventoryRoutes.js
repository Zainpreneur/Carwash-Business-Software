const express = require('express');
const { getSupplies, createSupply, updateSupply, deleteSupply, getAdjustments, createAdjustment } = require('../controllers/supplyController');
const {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  approvePurchaseOrder,
  receivePO,
  closePO,
} = require('../controllers/purchaseOrderController');
const { getForecast, runForecast } = require('../controllers/inventoryForecastController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Inventory data (03-operations/inventory.md) — admin/manager only, matching this app's
// existing gate on Expenses/Finance/HR.
router.use(protect, authorize('admin', 'manager'));

router.route('/supplies').get(getSupplies).post(createSupply);
router.route('/supplies/:id').put(updateSupply).delete(deleteSupply);
router.get('/adjustments', getAdjustments);
router.post('/adjustments', createAdjustment);

router.route('/purchase-orders').get(getPurchaseOrders).post(createPurchaseOrder);
router.get('/purchase-orders/:id', getPurchaseOrder);
router.patch('/purchase-orders/:id/approve', approvePurchaseOrder);
router.patch('/purchase-orders/:id/receive', receivePO);
router.patch('/purchase-orders/:id/close', closePO);

router.get('/forecast', getForecast);
router.post('/forecast/run', runForecast);

module.exports = router;
