// review-response-agent (02-intelligence/ai-agents.md) — "auto-thanks simple positive
// reviews with a loyalty-point offer, and opens a Ticket + immediate site-manager alert for
// anything negative or mentioning damage." The Google Business Profile/social-mention
// monitoring itself isn't built (no such API connector); reviews are logged here manually
// (POST /api/growth/reviews) and this handles the response side for real.
//
// Makes NO Claude call, deliberately: the spec's own guardrail — "never auto-responds to a
// review below 4 stars or one mentioning damage/injury/billing... reputational risk means
// autonomy stays conservative here by default" — is exactly the kind of high-stakes,
// binary decision this app keeps out of an LLM's hands elsewhere too (membership-billing-
// agent, inventory-forecaster). A keyword check is coarser than real sentiment
// understanding, but it never has a false "auto-responded" on a review an LLM might read as
// borderline-fine — the conservative failure mode this guardrail asks for.
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { reviews, tickets, customers } = require('../db/schema');
const { notifyRoles } = require('../utils/notify');

const AUTO_RESPOND_MIN_RATING = 4;
const ESCALATION_KEYWORDS = ['damage', 'damaged', 'scratch', 'dent', 'broke', 'broken', 'injury', 'injured', 'hurt', 'bill', 'billing', 'charge', 'charged', 'refund'];

const containsEscalationKeyword = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ESCALATION_KEYWORDS.some((k) => lower.includes(k));
};

const THANK_YOU_TEMPLATE = (customerName) =>
  `Thanks so much for the kind words${customerName ? `, ${customerName}` : ''}! We've added loyalty points to your account as a thank-you — see you next visit!`;

const LOYALTY_POINTS_FOR_REVIEW = 50;

const logReview = async ({ customer, source, rating, text, loggedBy }) => {
  const shouldAutoRespond = rating >= AUTO_RESPOND_MIN_RATING && !containsEscalationKeyword(text);

  if (shouldAutoRespond) {
    let customerName = null;
    if (customer) {
      const [row] = await db.select().from(customers).where(eq(customers._id, customer));
      if (row) {
        customerName = row.name;
        await db.update(customers).set({ loyaltyPoints: row.loyaltyPoints + LOYALTY_POINTS_FOR_REVIEW, updatedAt: new Date() }).where(eq(customers._id, customer));
      }
    }
    const [created] = await db
      .insert(reviews)
      .values({ customer: customer || null, source, rating, text, status: 'auto-responded', response: THANK_YOU_TEMPLATE(customerName), loggedBy })
      .returning();
    return created;
  }

  // Negative or damage/injury/billing-mentioning — never auto-responded, always a real
  // Ticket + immediate alert.
  const [ticket] = await db
    .insert(tickets)
    .values({
      customer: customer || null,
      subject: `${rating}-star review flagged for response`,
      category: containsEscalationKeyword(text) ? 'damage-claim' : 'quality-complaint',
      priority: rating <= 2 ? 'high' : 'normal',
      description: text,
      source: 'in-app',
    })
    .returning();

  const [created] = await db.insert(reviews).values({ customer: customer || null, source, rating, text, status: 'escalated', ticket: ticket._id, loggedBy }).returning();

  await notifyRoles(['admin', 'manager'], {
    type: 'review_escalated',
    title: `${rating}-star review needs a response`,
    message: text ? text.slice(0, 140) : 'No review text provided.',
  });

  return { ...created, ticket };
};

module.exports = { logReview, containsEscalationKeyword, AUTO_RESPOND_MIN_RATING };
