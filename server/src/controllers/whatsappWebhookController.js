// Inbound WhatsApp Cloud API webhook — wash-concierge's entry point. Mounted with a raw
// body parser in app.js, before the global express.json() middleware, so an optional
// WHATSAPP_APP_SECRET signature check (Meta's X-Hub-Signature-256) sees the exact bytes
// Meta signed, same pattern as the Stripe webhook.
const crypto = require('crypto');
const { handleInboundMessage } = require('../agents/washConcierge');

// GET verification handshake — Meta calls this once when you register the webhook URL in
// the developer console, and must see its own verify token echoed back to accept it.
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(501).send('WHATSAPP_VERIFY_TOKEN is not configured on this server');
  }
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

const isValidSignature = (rawBody, signatureHeader) => {
  if (!process.env.WHATSAPP_APP_SECRET) return true; // no secret configured — nothing to check against
  if (!signatureHeader) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch etc — treat as invalid rather than throwing
  }
};

const receiveMessage = async (req, res) => {
  if (!isValidSignature(req.body, req.headers['x-hub-signature-256'])) {
    return res.status(401).json({ message: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }

  // Always 200 quickly — Meta retries aggressively on non-2xx, and a message-handling bug
  // is ours to fix, not something Meta should hammer us over.
  res.status(200).json({ received: true });

  try {
    const messages = payload?.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of messages) {
      if (msg.type !== 'text') continue; // interactive/media messages are out of scope for now
      await handleInboundMessage({ fromPhone: msg.from, text: msg.text?.body || '' });
    }
  } catch (err) {
    console.error('[whatsapp webhook] handler error:', err.message);
  }
};

module.exports = { verifyWebhook, receiveMessage };
