// Ticket SLA table (carwash-compile/04-growth/crm.md). Calendar-time deadlines, not the
// spec's "during operating hours" business-hours-aware version — a documented
// simplification (real business-hours math needs a calendar, which this app doesn't have).
// "general" isn't in the spec's table; 4h/48h is this app's own reasonable default for it.
const SLA_HOURS = {
  'damage-claim': { firstResponse: 1, resolution: 48 },
  'billing-dispute': { firstResponse: 4, resolution: 72 },
  'quality-complaint': { firstResponse: 2, resolution: 24 },
  'membership-question': { firstResponse: 1, resolution: 24 },
  general: { firstResponse: 4, resolution: 48 },
};

const OPEN_STATUSES = ['open', 'in-progress', 'waiting-on-customer'];
const addHours = (date, hours) => new Date(new Date(date).getTime() + hours * 60 * 60 * 1000);

// "SLA-breach risk is a reminder ... before the SLA is actually missed, not after" — at-risk
// means inside the last 25% of the deadline window (minimum 15 minutes), not yet breached.
// Real proactive alerting needs a scheduler this app doesn't run (see automations.js); this
// computes the same signal on every read instead, so the UI is never stale, just not pushed.
const RISK_FRACTION = 0.25;
const MIN_RISK_WINDOW_MINUTES = 15;

// Attaches computed SLA fields to a ticket row — never mutates the DB row, purely derived.
const withSla = (ticket) => {
  const sla = SLA_HOURS[ticket.category] || SLA_HOURS.general;
  const firstResponseDueAt = addHours(ticket.createdAt, sla.firstResponse);
  const resolutionDueAt = addHours(ticket.createdAt, sla.resolution);
  const now = new Date();

  const riskWindowMs = Math.max(sla.firstResponse * 60 * 60 * 1000 * RISK_FRACTION, MIN_RISK_WINDOW_MINUTES * 60 * 1000);
  const firstResponseBreached = !ticket.firstRespondedAt && now > firstResponseDueAt;
  const firstResponseAtRisk =
    !firstResponseBreached && !ticket.firstRespondedAt && firstResponseDueAt - now <= riskWindowMs;

  const isOpen = OPEN_STATUSES.includes(ticket.status);
  const resolutionRiskWindowMs = Math.max(sla.resolution * 60 * 60 * 1000 * RISK_FRACTION, MIN_RISK_WINDOW_MINUTES * 60 * 1000);
  const resolutionBreached = isOpen && now > resolutionDueAt;
  const resolutionAtRisk = isOpen && !resolutionBreached && resolutionDueAt - now <= resolutionRiskWindowMs;

  return {
    ...ticket,
    sla: {
      firstResponseDueAt,
      resolutionDueAt,
      firstResponseBreached,
      firstResponseAtRisk,
      resolutionBreached,
      resolutionAtRisk,
      atRisk: firstResponseAtRisk || resolutionAtRisk,
      breached: firstResponseBreached || resolutionBreached,
    },
  };
};

module.exports = { SLA_HOURS, OPEN_STATUSES, withSla };
