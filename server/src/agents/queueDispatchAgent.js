// queue-dispatch-agent (02-intelligence/ai-agents.md) — "highest-leverage first" per the
// deployment guide's step 6. Its mechanical job (assign each queued vehicle to the next
// open bay respecting tunnel/detail-bay fit) is already deterministic code — a well-suited
// task for a rule, not an LLM (see server/src/utils/bays.js, wired up in Phase 1).
//
// What's genuinely judgment-shaped, per the spec's own guardrail, is the overflow decision:
// "escalates to site-manager if predicted wait exceeds 25 minutes for 3 consecutive
// vehicles (open self-serve overflow or call in an extra bay-attendant)". That's a real
// choice depending on time-of-day, how deep the backup is, and whether it looks transient
// or sustained — not a fixed rule. This module makes that one call.
//
// Guardrail enforced in code, not just the prompt (per ai-agents.md's own framing): the
// model is never given a tool that can mutate WashOrder/ServiceBay state. Its only output is
// a short recommendation string folded into the notification sent to site-manager-equivalent
// roles — a human still acts on it. No key configured -> the same deterministic message this
// app used before this phase, not a blocked request.
const { getAnthropicClient, isAgentsConfigured, AGENT_MODEL } = require('../config/anthropic');
const { recordAgentEvent } = require('../utils/agentMetrics');

const DETERMINISTIC_FALLBACK =
  'Consider opening self-serve overflow or calling in an extra bay-attendant.';

const SYSTEM_PROMPT = `You are queue-dispatch-agent for SplashPoint Express Wash, a 6-bay car wash (4 tunnel-conveyor bays, 2 detail bays).
The wash queue has backed up past guardrail thresholds. Recommend ONE concrete action for the on-duty site manager.
Choose based on the numbers given: a short, transient backup (queue just ticked over, throughput still healthy) usually just needs to be watched; a deep or sustained backup needs a concrete staffing/overflow response.
Respond with 1-2 plain sentences only, addressed to the site manager, no preamble, no markdown. You are making a recommendation only — you cannot take any action yourself.`;

// Returns { text, source }. Never throws — a Claude API error or missing key both fall back
// to the same deterministic message this alert used before agents existed.
const recommendOverflowAction = async ({ queueLength, predictedWaitMinutes, bayCount, timeOfDay }) => {
  if (!isAgentsConfigured()) {
    recordAgentEvent('queue-dispatch-agent', 'deterministic-fallback');
    return { text: DETERMINISTIC_FALLBACK, source: 'deterministic-fallback' };
  }

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Queue length: ${queueLength} vehicles queued.\nPredicted wait: ~${predictedWaitMinutes} minutes.\nOperational bays: ${bayCount}.\nTime: ${timeOfDay}.\n\nWhat should the site manager do right now?`,
        },
      ],
    });
    const text = message.content.find((block) => block.type === 'text')?.text?.trim();
    recordAgentEvent('queue-dispatch-agent', 'ai-agent');
    return { text: text || DETERMINISTIC_FALLBACK, source: 'ai-agent' };
  } catch (err) {
    console.error('[queue-dispatch-agent] Claude call failed, using deterministic fallback:', err.message);
    recordAgentEvent('queue-dispatch-agent', 'deterministic-fallback');
    return { text: DETERMINISTIC_FALLBACK, source: 'deterministic-fallback' };
  }
};

module.exports = { recommendOverflowAction };
