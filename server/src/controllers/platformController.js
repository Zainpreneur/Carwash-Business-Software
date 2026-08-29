// Admin-facing management for the partner API/webhooks platform (06-platform/api-webhooks.md)
// — issuing/revoking API keys, registering webhook subscribers, and viewing/replaying the
// delivery log. Everything here is admin-only (server/src/routes/platformRoutes.js).
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { apiKeys, webhookSubscriptions, webhookDeliveries, customers } = require('../db/schema');
const { hashKey } = require('../middleware/apiKeyAuth');
const { replayDelivery } = require('../services/webhookService');

const SCOPES = ['orders-readwrite', 'fleet-account-readonly'];
const EVENTS = ['wash-order-ready', 'wash-order-completed', 'membership-cancelled', 'stock-low'];

const getApiKeys = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: apiKeys._id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, scope: apiKeys.scope,
      fleetCustomer: { _id: customers._id, name: customers.name },
      active: apiKeys.active, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .leftJoin(customers, eq(apiKeys.fleetCustomer, customers._id))
    .orderBy(desc(apiKeys.createdAt));
  res.json(rows);
});

// Returns the plaintext key exactly once — never again reconstructible from `keyHash` alone,
// same handling as any real API-key system (GitHub tokens, Stripe secret keys, etc.).
const createApiKey = asyncHandler(async (req, res) => {
  const { name, scope, fleetCustomer } = req.body;
  if (!name || !SCOPES.includes(scope)) {
    res.status(400);
    throw new Error(`name and a valid scope (${SCOPES.join(', ')}) are required`);
  }
  if (scope === 'fleet-account-readonly' && !fleetCustomer) {
    res.status(400);
    throw new Error('fleet-account-readonly keys must be scoped to a fleetCustomer');
  }
  const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const [created] = await db
    .insert(apiKeys)
    .values({
      name,
      scope,
      fleetCustomer: scope === 'fleet-account-readonly' ? fleetCustomer : null,
      keyHash: hashKey(rawKey),
      keyPrefix: rawKey.slice(0, 12),
      createdBy: req.user._id,
    })
    .returning();
  res.status(201).json({ ...created, rawKey });
});

const revokeApiKey = asyncHandler(async (req, res) => {
  const [updated] = await db.update(apiKeys).set({ active: false }).where(eq(apiKeys._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('API key not found');
  }
  res.json(updated);
});

const getWebhookSubscriptions = asyncHandler(async (req, res) => {
  const rows = await db.select().from(webhookSubscriptions).orderBy(desc(webhookSubscriptions.createdAt));
  // The signing secret is write-only from this API's perspective — an admin sets it once at
  // creation and never needs to read it back (the subscriber already has their own copy).
  res.json(rows.map(({ secret, ...rest }) => rest));
});

const createWebhookSubscription = asyncHandler(async (req, res) => {
  const { url, events } = req.body;
  if (!url || !Array.isArray(events) || events.length === 0 || !events.every((e) => EVENTS.includes(e))) {
    res.status(400);
    throw new Error(`url and a non-empty events array (from ${EVENTS.join(', ')}) are required`);
  }
  const secret = crypto.randomBytes(24).toString('hex');
  const [created] = await db.insert(webhookSubscriptions).values({ url, events, secret, createdBy: req.user._id }).returning();
  res.status(201).json({ ...created, secret });
});

const deleteWebhookSubscription = asyncHandler(async (req, res) => {
  const deleted = await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Webhook subscription not found');
  }
  res.json({ message: 'Webhook subscription removed' });
});

const getDeliveries = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: webhookDeliveries._id, eventId: webhookDeliveries.eventId, eventType: webhookDeliveries.eventType,
      subscriptionUrl: webhookSubscriptions.url, status: webhookDeliveries.status, attempts: webhookDeliveries.attempts,
      responseStatus: webhookDeliveries.responseStatus, lastError: webhookDeliveries.lastError, createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookSubscriptions, eq(webhookDeliveries.subscription, webhookSubscriptions._id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(200);
  res.json(rows);
});

const replayWebhookDelivery = asyncHandler(async (req, res) => {
  try {
    await replayDelivery(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400);
    throw err;
  }
});

module.exports = {
  getApiKeys, createApiKey, revokeApiKey,
  getWebhookSubscriptions, createWebhookSubscription, deleteWebhookSubscription,
  getDeliveries, replayWebhookDelivery,
  SCOPES, EVENTS,
};
