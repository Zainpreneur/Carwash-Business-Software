// WhatsApp Business Platform Cloud API direct integration (04-growth/whatsapp.md's own
// platform-setup choice: "cost-sensitive, simple-setup default" for a single-location
// business). Degrades to a clear not_configured result — never throws — when
// WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID aren't set, so callers (utils/automations.js,
// agents/washConcierge.js) can always log the outcome regardless of whether a real account
// is connected.
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

const isWhatsAppConfigured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

const sendWhatsAppPayload = async (body) => {
  if (!isWhatsAppConfigured()) {
    return { status: 'not_configured' };
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'failed', error: data?.error?.message || `WhatsApp API returned ${res.status}` };
    }
    return { status: 'sent', messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
};

// params is an ordered object — WhatsApp template body parameters are positional, so the
// caller's key order must match the approved template's {{1}}, {{2}}, ... slots. Used for
// automation-triggered sends (wash-ready, membership-welcome, dunning) — these can fire
// outside Meta's 24-hour customer-session window, which only a pre-approved template may do.
const sendWhatsAppTemplate = (toPhone, templateName, params = {}) =>
  sendWhatsAppPayload({
    messaging_product: 'whatsapp',
    to: String(toPhone).replace(/[^\d+]/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: Object.values(params)
            .filter((v) => v !== undefined && v !== null)
            .map((v) => ({ type: 'text', text: String(v) })),
        },
      ],
    },
  });

// Free-form text — only valid as a reply within Meta's 24-hour window after the customer's
// last inbound message, which is exactly wash-concierge's situation (always replying to a
// message just received). Never used for an automation-initiated send; those use a template.
const sendWhatsAppText = (toPhone, text) =>
  sendWhatsAppPayload({
    messaging_product: 'whatsapp',
    to: String(toPhone).replace(/[^\d+]/g, ''),
    type: 'text',
    text: { body: text },
  });

module.exports = { isWhatsAppConfigured, sendWhatsAppTemplate, sendWhatsAppText };
