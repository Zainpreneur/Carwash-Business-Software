// Partner API authentication (06-platform/api-webhooks.md: "authMethods: api-key"). A
// completely separate auth path from the staff-facing JWT `protect` middleware — a fleet
// partner's server-to-server integration has no user session, just a long-lived key.
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { apiKeys } = require('../db/schema');

const hashKey = (rawKey) => crypto.createHash('sha256').update(rawKey).digest('hex');

// In-memory per-key counter — "300 requests/min per API key" per the spec. Not distributed
// (this app runs a single server process, no Redis/shared-cache layer), so this resets if the
// process restarts and wouldn't hold up across multiple instances — a documented limitation
// of implementing the spec's own stated limit without adding infrastructure this app doesn't
// otherwise need.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 300;
const windows = new Map(); // keyId -> { count, resetAt }

const checkRateLimit = (keyId) => {
  const now = Date.now();
  const w = windows.get(keyId);
  if (!w || now >= w.resetAt) {
    windows.set(keyId, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  w.count += 1;
  if (w.count > MAX_PER_WINDOW) {
    return Math.ceil((w.resetAt - now) / 1000);
  }
  return null;
};

const authenticateApiKey = asyncHandler(async (req, res, next) => {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) {
    res.status(401);
    throw new Error('Missing X-API-Key header');
  }

  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hashKey(rawKey)));
  if (!key || !key.active) {
    res.status(401);
    throw new Error('Invalid or revoked API key');
  }

  const retryAfter = checkRateLimit(key._id);
  if (retryAfter) {
    res.set('Retry-After', String(retryAfter));
    res.status(429);
    throw new Error('Rate limit exceeded (300 requests/min per key)');
  }

  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys._id, key._id)).catch(() => {});
  req.apiKey = key;
  next();
});

// requireScope('orders-readwrite') — "each scope is constrained exactly like the human role
// it mirrors." fleet-account-readonly is never allowed where only orders-readwrite is
// listed (it has no write access at all), matching the spec's own scope table.
const requireScope = (...scopes) => (req, res, next) => {
  if (!scopes.includes(req.apiKey.scope)) {
    res.status(403);
    throw new Error(`Scope '${req.apiKey.scope}' cannot perform this action`);
  }
  next();
};

module.exports = { authenticateApiKey, requireScope, hashKey };
