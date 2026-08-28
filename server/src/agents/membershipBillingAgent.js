// membership-billing-agent (02-intelligence/ai-agents.md) — "runs the monthly membership
// billing cycle, retries failed charges, and manages the past-due/suspension/pause
// lifecycle." Lives in agents/ alongside queue-dispatch-agent and wash-concierge because
// it's the spec's own named agent, but unlike those two it makes NO Claude call: the spec's
// own description of this agent is entirely threshold/state-machine logic (3 failed
// attempts / 7 days unresolved -> suspend, 30 days unresolved -> cancel) with no natural-
// language judgment call anywhere in it — the same automations-vs-agents distinction this
// app has drawn everywhere else (e.g. queue-dispatch-agent's actual bay assignment is
// deterministic code; only its overflow *recommendation* calls Claude). Building an LLM
// call here would be padding, not fidelity to the spec.
//
// Retrying the charge itself is Stripe's own job (Smart Retries), not this app's — this
// module only reacts to the payment_failed/payment_succeeded events Stripe's webhook
// already delivers (server/src/controllers/stripeWebhookController.js) and evaluates the
// state machine documented on membershipSubscriptions in db/schema.js.
const SUSPEND_AFTER_ATTEMPTS = 3;
const SUSPEND_AFTER_DAYS = 7;
const CANCEL_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Pure decision function — given the subscription's state *before* this failure and now,
// returns what it should become. No I/O, easy to unit test without a real webhook.
const evaluateFailedPayment = (subscription, now = new Date()) => {
  const attempts = (subscription.failedPaymentAttempts || 0) + 1;
  const firstFailedAt = subscription.firstFailedAt ? new Date(subscription.firstFailedAt) : now;
  const daysUnresolved = (now - firstFailedAt) / DAY_MS;

  if (subscription.status === 'suspended') {
    if (daysUnresolved >= CANCEL_AFTER_DAYS) {
      return { status: 'cancelled', failedPaymentAttempts: attempts, firstFailedAt };
    }
    return { status: 'suspended', failedPaymentAttempts: attempts, firstFailedAt };
  }

  // "never cancels a membership before 3 failed retry attempts spread over 7 days;
  // suspension (not cancellation) is the automatic outcome of unresolved past-due status."
  if (attempts >= SUSPEND_AFTER_ATTEMPTS || daysUnresolved >= SUSPEND_AFTER_DAYS) {
    return { status: 'suspended', failedPaymentAttempts: attempts, firstFailedAt };
  }
  return { status: 'past-due', failedPaymentAttempts: attempts, firstFailedAt };
};

// A successful charge always fully resolves the delinquency, from whichever status it was
// in (past-due or suspended) — "active (paid manually)" in the spec's own state machine,
// generalized to "active (paid, by any means)" since this fires from the same webhook event
// regardless of whether Stripe's retry or a fresh invoice is what succeeded.
const evaluateSucceededPayment = () => ({ status: 'active', failedPaymentAttempts: 0, firstFailedAt: null });

module.exports = { evaluateFailedPayment, evaluateSucceededPayment, SUSPEND_AFTER_ATTEMPTS, SUSPEND_AFTER_DAYS, CANCEL_AFTER_DAYS };
