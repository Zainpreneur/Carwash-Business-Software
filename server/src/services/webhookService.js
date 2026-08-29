// Outbound webhooks (06-platform/api-webhooks.md). Every payload is HMAC-signed per-subscriber
// and retried with backoff on delivery failure, matching the spec's own text; "replayable by
// event ID" is what webhookDeliveries is for — eventId stays stable across every attempt for
// one firing, and a stored row can be replayed manually later. Retries here are immediate and
// in-process (a few attempts, short backoff) rather than a durable queue, since this app has
// no job scheduler/worker infrastructure — a subscriber down longer than a couple of seconds
// needs the manual replay endpoint instead of an automatic later retry.
const crypto = require('crypto');
const { eq, and } = require('drizzle-orm');
const { db } = require('../config/db');
const { webhookSubscriptions, webhookDeliveries } = require('../db/schema');

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [500, 1500]; // backoff between attempts 1->2 and 2->3

const sign = (secret, body) => crypto.createHmac('sha256', secret).update(body).digest('hex');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendOnce = async (url, body, signature) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timeout);
  }
};

const deliverToSubscription = async (subscription, eventId, eventType, payload) => {
  const body = JSON.stringify({ eventId, eventType, ...payload });
  const signature = sign(subscription.secret, body);

  let lastError = null;
  let lastStatus = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { ok, status } = await sendOnce(subscription.url, body, signature);
      lastStatus = status;
      if (ok) {
        await db.insert(webhookDeliveries).values({
          eventId, eventType, subscription: subscription._id, payload, status: 'delivered', attempts: attempt, responseStatus: status,
        });
        return;
      }
      lastError = `HTTP ${status}`;
    } catch (err) {
      lastError = err.message;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS[attempt - 1]);
  }
  await db.insert(webhookDeliveries).values({
    eventId, eventType, subscription: subscription._id, payload, status: 'failed', attempts: MAX_ATTEMPTS, responseStatus: lastStatus, lastError,
  });
  console.error(`[webhook] delivery failed after ${MAX_ATTEMPTS} attempts to ${subscription.url}: ${lastError}`);
};

// Fire-and-forget from every call site, same posture as every other side-effect in this app
// (WhatsApp sends, ledger postings) — a subscriber's outage must never block the real
// workflow step that triggered the event.
const fireWebhookEvent = async (eventType, payload) => {
  try {
    const subs = await db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.active, true));
    const eventId = crypto.randomUUID();
    const targets = subs.filter((s) => Array.isArray(s.events) && s.events.includes(eventType));
    await Promise.all(targets.map((s) => deliverToSubscription(s, eventId, eventType, payload)));
  } catch (err) {
    console.error(`[webhook] fireWebhookEvent(${eventType}) failed:`, err.message);
  }
};

const replayDelivery = async (deliveryId) => {
  const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries._id, deliveryId));
  if (!delivery) throw new Error('Delivery not found');
  const [subscription] = await db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions._id, delivery.subscription));
  if (!subscription) throw new Error('Subscription no longer exists');
  await deliverToSubscription(subscription, delivery.eventId, delivery.eventType, delivery.payload);
};

module.exports = { fireWebhookEvent, replayDelivery, sign };
