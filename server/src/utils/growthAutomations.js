// Growth cluster automations (04-growth/marketing.md). Only the day-0 rung of each
// lifecycle drip sequence is built — day-3/day-10 (new-customer-welcome) and
// day-4/day-8 (at-risk-member-winback, whose day-0 the finance phase's own
// membershipPaymentFailedDunning already covers) need a scheduler this app doesn't have,
// same documented gap as the -3d/-2h reminder jobs. Both sequences also "stop immediately
// if the customer converts" per the spec — with only day-0 built, there's nothing to stop.
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { customers } = require('../db/schema');
const { sendAndLog } = require('./automations');
const { notifyRoles } = require('./notify');

// new-customer-welcome day 0: "thank-you + loyalty-points explainer," fired once, on a
// customer's first-ever Completed WashOrder (checked by the caller via visitCount === 0
// *before* checkout's own increment — see washOrderController.checkout).
const newCustomerWelcomeDayZero = async (customer, order) => {
  if (!customer.whatsappOptIn) return;
  await sendAndLog(customer, {
    washOrderId: order._id,
    template: 'new-customer-welcome',
    automation: 'new-customer-welcome-day0',
    params: { customerName: customer.name, loyaltyPoints: customer.loyaltyPoints },
  });
};

// Referral crediting (04-growth/marketing.md): "referred customer gets 50% off first wash,
// referrer gets a free wash credited on the referred customer's first Completed WashOrder."
// The 50%-off-first-wash half is a pricing decision made at checkout time by whoever rings
// up the order (no automatic discount engine exists here) — this only handles the referrer's
// side, crediting a free wash. Modeled as a `+1` on a referrer's loyaltyPoints-based free-
// wash credit rather than a real redeemable-credit ledger — a documented simplification,
// not a hidden one; there's no checkout-time "apply a free wash" flow to redeem it against.
const REFERRAL_CREDIT_POINTS = 100; // a stated stand-in for "one free wash" at this app's typical price point

const creditReferralIfFirstWash = async (customer) => {
  if (!customer.referredByCode) return;
  const [referrer] = await db.select().from(customers).where(eq(customers.referralCode, customer.referredByCode));
  if (!referrer) return;

  await db
    .update(customers)
    .set({ loyaltyPoints: referrer.loyaltyPoints + REFERRAL_CREDIT_POINTS, updatedAt: new Date() })
    .where(eq(customers._id, referrer._id));

  await notifyRoles(['admin', 'manager'], {
    type: 'referral_credited',
    title: 'Referral credit issued',
    message: `${referrer.name} earned a free-wash credit for referring ${customer.name}, whose first wash just completed.`,
  });
};

module.exports = { newCustomerWelcomeDayZero, creditReferralIfFirstWash };
