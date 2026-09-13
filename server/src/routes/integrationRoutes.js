const express = require('express');
const { isStripeConfigured, isWebhookConfigured } = require('../config/stripe');
const { isWhatsAppConfigured } = require('../utils/whatsapp');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Lets the UI show real connection state instead of silently pretending Stripe/WhatsApp
// are working when no credentials are configured.
router.get('/status', protect, (req, res) => {
  res.json({
    stripe: { configured: isStripeConfigured(), webhookConfigured: isWebhookConfigured() },
    whatsapp: { configured: isWhatsAppConfigured() },
  });
});

module.exports = router;
