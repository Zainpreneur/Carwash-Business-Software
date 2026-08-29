const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { users } = require('../db/schema');
const { getExecutiveDigest, formatDigestText } = require('../services/viewsService');
const { isWhatsAppConfigured, sendWhatsAppText } = require('../utils/whatsapp');
const { notifyRoles } = require('../utils/notify');

const executiveDigest = asyncHandler(async (req, res) => res.json(await getExecutiveDigest()));

// "Medium: whatsapp-digest" — sent on demand (no scheduler) to every admin's phone on file,
// this app's closest real approximation of the spec's "owner." Degrades to an in-app
// notification (same posture as every other WhatsApp send in this app) when not configured
// or an admin has no phone number set, rather than silently doing nothing.
const sendExecutiveDigest = asyncHandler(async (req, res) => {
  const digest = await getExecutiveDigest();
  const text = formatDigestText(digest);
  const owners = await db.select().from(users).where(eq(users.role, 'admin'));

  const results = [];
  for (const owner of owners) {
    if (isWhatsAppConfigured() && owner.phone) {
      await sendWhatsAppText(owner.phone, text);
      results.push({ owner: owner.name, channel: 'whatsapp' });
    } else {
      results.push({ owner: owner.name, channel: 'not_configured' });
    }
  }
  await notifyRoles(['admin'], { type: 'executive_digest_sent', title: 'Daily digest sent', message: text.split('\n').slice(0, 3).join(' · ') }, req.user._id);
  res.json({ digest, deliveries: results });
});

module.exports = { executiveDigest, sendExecutiveDigest };
