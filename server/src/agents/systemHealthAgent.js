// system-health-agent (02-intelligence/ai-agents.md) — "watches the AI workforce's own
// operating data ... and produces a weekly health report naming what's healthy, what's
// drifting, and a concrete threshold fix per issue." Reasoning pattern: root-cause-5-whys —
// a genuine judgment call (is a rate "off," and if so, why), so this one does call Claude,
// unlike ops-orchestrator/membership-billing-agent/inventory-forecaster.
//
// Trigger is "weekly, Monday 6am"; no scheduler in this app (the recurring documented gap),
// so this runs on demand instead — a site-manager generates the report from the Ops Center
// page whenever they want it, rather than finding it waiting Monday morning.
const { gte } = require('drizzle-orm');
const { db } = require('../config/db');
const { agentMetrics } = require('../db/schema');
const { getAnthropicClient, isAgentsConfigured, AGENT_MODEL } = require('../config/anthropic');

const REPORT_WINDOW_DAYS = 7;

const computeMetrics = async () => {
  const since = new Date(Date.now() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(agentMetrics).where(gte(agentMetrics.createdAt, since));

  const byAgent = new Map();
  for (const r of rows) {
    if (!byAgent.has(r.agentName)) byAgent.set(r.agentName, { total: 0, aiAgent: 0, deterministicFallback: 0, escalated: 0 });
    const stats = byAgent.get(r.agentName);
    stats.total++;
    if (r.source === 'ai-agent') stats.aiAgent++;
    if (r.source === 'deterministic-fallback') stats.deterministicFallback++;
    if (r.escalated) stats.escalated++;
  }

  return Array.from(byAgent.entries()).map(([agentName, s]) => ({
    agentName,
    invocations: s.total,
    aiAgentRate: s.total ? Math.round((s.aiAgent / s.total) * 100) : null,
    fallbackRate: s.total ? Math.round((s.deterministicFallback / s.total) * 100) : null,
    escalationRate: s.total ? Math.round((s.escalated / s.total) * 100) : null,
  }));
};

const DETERMINISTIC_SUMMARY = (metrics) =>
  metrics.length === 0
    ? 'No agent activity in the last 7 days to report on.'
    : metrics.map((m) => `${m.agentName}: ${m.invocations} calls, ${m.fallbackRate ?? 0}% deterministic-fallback, ${m.escalationRate ?? 0}% escalated.`).join(' ');

const SYSTEM_PROMPT = `You are system-health-agent for SplashPoint Express Wash's internal AI workforce. You are given the last 7 days of per-agent call metrics (invocation count, % that ran on a deterministic fallback instead of calling Claude, % that escalated to a human). Produce a short weekly health report: name what's healthy, what's drifting, and — for anything drifting — a concrete threshold or config fix, per the root-cause-5-whys pattern (chain from the symptom to its likely cause before recommending a fix). A high fallback rate usually means ANTHROPIC_API_KEY isn't configured, not that Claude is failing — say so plainly rather than guessing at a model problem. Keep it to 3-5 sentences, plain text, no markdown. Never propose lowering an escalation-confidence threshold as the fix for a high escalation rate — that trades safety for a lower number, which is the wrong fix (per this agent's own guardrail).`;

// Never throws — no key configured or a Claude failure both return the raw computed
// metrics without a narrative, which is still a real, useful report on its own.
const generateReport = async () => {
  const metrics = await computeMetrics();

  if (!isAgentsConfigured()) {
    return { metrics, narrative: null, note: 'ANTHROPIC_API_KEY not configured — showing raw metrics only, no narrative.', windowDays: REPORT_WINDOW_DAYS };
  }

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Last ${REPORT_WINDOW_DAYS} days of agent metrics:\n${JSON.stringify(metrics, null, 2)}` }],
    });
    const narrative = message.content.find((b) => b.type === 'text')?.text?.trim() || DETERMINISTIC_SUMMARY(metrics);
    return { metrics, narrative, note: null, windowDays: REPORT_WINDOW_DAYS };
  } catch (err) {
    console.error('[system-health-agent] Claude call failed, showing raw metrics:', err.message);
    return { metrics, narrative: DETERMINISTIC_SUMMARY(metrics), note: 'Claude call failed — showing a plain summary instead of a full narrative.', windowDays: REPORT_WINDOW_DAYS };
  }
};

module.exports = { generateReport, computeMetrics };
