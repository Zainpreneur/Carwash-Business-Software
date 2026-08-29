const express = require('express');
const {
  getWashOrders, createWashOrder, getCustomers, createCustomer, getMembershipSubscriptions, getStock,
} = require('../controllers/v1Controller');
const { authenticateApiKey, requireScope } = require('../middleware/apiKeyAuth');

const router = express.Router();

// 06-platform/api-webhooks.md's partner API — "URL-prefixed /v1/... breaking changes ship as
// /v2/ with /v1/ kept live at least 6 months" (mounted at /api/v1 in app.js). API-key auth
// only, never the staff JWT — see apiKeyAuth.js.
router.use(authenticateApiKey);

router.route('/wash-orders').get(getWashOrders).post(requireScope('orders-readwrite'), createWashOrder);
router.route('/customers').get(getCustomers).post(requireScope('orders-readwrite'), createCustomer);
router.get('/membership-subscriptions', getMembershipSubscriptions);
router.get('/stock', getStock);

module.exports = router;
