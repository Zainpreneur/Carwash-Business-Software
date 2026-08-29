const express = require('express');
const {
  getApiKeys, createApiKey, revokeApiKey,
  getWebhookSubscriptions, createWebhookSubscription, deleteWebhookSubscription,
  getDeliveries, replayWebhookDelivery,
} = require('../controllers/platformController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// 06-platform/api-webhooks.md's own developer-experience note: "manually issued keys are
// enough" at this scale — admin only, no self-serve portal.
router.use(protect, authorize('admin'));
router.route('/api-keys').get(getApiKeys).post(createApiKey);
router.patch('/api-keys/:id/revoke', revokeApiKey);
router.route('/webhook-subscriptions').get(getWebhookSubscriptions).post(createWebhookSubscription);
router.delete('/webhook-subscriptions/:id', deleteWebhookSubscription);
router.get('/webhook-deliveries', getDeliveries);
router.post('/webhook-deliveries/:id/replay', replayWebhookDelivery);

module.exports = router;
