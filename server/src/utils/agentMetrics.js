// system-health-agent's own raw material — "watches the AI workforce's own operating data"
// (02-intelligence/ai-agents.md). Nothing logged agent invocations before this file existed;
// every credential-gated agent now calls recordAgentEvent() once per invocation so the
// health report has something real to compute from. Fire-and-forget by design (same
// posture as notifyRoles elsewhere) — a metrics-logging failure must never break the agent
// call it's instrumenting.
const { db } = require('../config/db');
const { agentMetrics } = require('../db/schema');

const recordAgentEvent = (agentName, source, escalated = false) => {
  db.insert(agentMetrics)
    .values({ agentName, source, escalated })
    .catch((err) => console.error(`[agent-metrics] failed to record ${agentName} event:`, err.message));
};

module.exports = { recordAgentEvent };
