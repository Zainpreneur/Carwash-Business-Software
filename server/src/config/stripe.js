// Lazily-constructed Stripe client — undefined until STRIPE_SECRET_KEY is set. Every caller
// must check isStripeConfigured (or handle a null getStripe() return) rather than assuming
// the key exists; that's what lets the membership feature degrade to a local-only demo mode
// instead of crashing when no real Stripe account is connected yet.
let cachedClient = null;

const isStripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

const getStripe = () => {
  if (!isStripeConfigured()) return null;
  if (!cachedClient) {
    const Stripe = require('stripe');
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cachedClient;
};

const isWebhookConfigured = () => !!process.env.STRIPE_WEBHOOK_SECRET;

module.exports = { isStripeConfigured, getStripe, isWebhookConfigured };
