// ops-orchestrator (02-intelligence/ai-agents.md) — "holds the day's operating picture...
// and routes work to the right specialist rather than each agent polling blind." Makes NO
// Claude call: its own guardrail — "never overrides a specialist's guardrail ... routing
// only, no independent transactional authority" — describes a
// deterministic aggregation-and-routing job, not a judgment call, the same reasoning that
// kept membership-billing-agent and inventory-forecaster LLM-free.
//
// Real trigger is "every 5 minutes during operating hours"; this app has no scheduler (the
// same documented gap as -3d/-2h reminders and proactive SLA alerts), so this runs on
// demand via GET /api/agent-ops/orchestrator-snapshot instead — a site-manager opens the Ops
// Center page and gets the same picture a 5-minute tick would have produced.
const { eq, and, gte, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { washOrders, serviceBays, notifications, tickets } = require('../db/schema');
const { getStaffingCapacity } = require('../services/simulationService');
const { OPEN_STATUSES: OPEN_TICKET_STATUSES } = require('../utils/tickets');

const NON_TERMINAL_WASH_STATUSES = ['queued', 'bay-assigned', 'in-wash', 'quality-check', 'ready-for-pickup'];

const getOperatingSnapshot = async () => {
  const activeOrders = await db.select().from(washOrders).where(inArray(washOrders.status, NON_TERMINAL_WASH_STATUSES));
  const queueDepth = activeOrders.filter((o) => o.status === 'queued').length;

  const bays = await db.select().from(serviceBays);
  const bayStatus = { operational: 0, degraded: 0, down: 0, retired: 0 };
  for (const b of bays) bayStatus[b.operationalStatus] = (bayStatus[b.operationalStatus] || 0) + 1;

  const now = new Date();
  const staffing = await getStaffingCapacity();
  const currentGap = staffing.gaps.find((g) => g.dayOfWeek === now.getUTCDay() && g.hour === now.getUTCHours());

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentEscalations = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.read, false), gte(notifications.createdAt, since24h)));
  const escalationTypes = ['wash_concierge_escalation', 'membership_suspended', 'membership_cancelled_nonpayment', 'ticket_created', 'leave_requested'];
  const openEscalations = recentEscalations.filter((n) => escalationTypes.includes(n.type));

  const openTickets = await db.select().from(tickets).where(inArray(tickets.status, OPEN_TICKET_STATUSES));

  // Deterministic routing — names which specialist/automation already owns each condition,
  // per the orchestrator's own "routes work to the right specialist" job description.
  const routedItems = [];
  if (queueDepth > 8) routedItems.push({ condition: `Queue depth ${queueDepth} vehicles`, routedTo: 'queue-dispatch-agent (queue-wait-alert)' });
  if (bayStatus.down > 0) routedItems.push({ condition: `${bayStatus.down} bay(s) down`, routedTo: 'bay-down-reroute automation' });
  if (currentGap) routedItems.push({ condition: 'Understaffed for the current hour', routedTo: 'site-manager (staffing-capacity-simulator flagged this)' });
  if (openEscalations.length > 0) routedItems.push({ condition: `${openEscalations.length} unread escalation(s) in the last 24h`, routedTo: 'site-manager review' });
  if (openTickets.length > 0) routedItems.push({ condition: `${openTickets.length} open support ticket(s)`, routedTo: 'assigned staff / Support queue' });

  return {
    queueDepth,
    activeOrderCount: activeOrders.length,
    bayStatus,
    currentStaffingGap: currentGap || null,
    openEscalationCount: openEscalations.length,
    openTicketCount: openTickets.length,
    routedItems,
    allClear: routedItems.length === 0,
    generatedAt: now,
  };
};

module.exports = { getOperatingSnapshot };
