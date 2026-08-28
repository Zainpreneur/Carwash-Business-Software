// strategy-advisor (02-intelligence/ai-agents.md) — "answers open-ended owner questions ...
// with a structured, traceable recommendation instead of a bare opinion." The genuinely
// open-ended one of the two advisor agents (system-health-agent's job is narrower and
// mechanical by comparison) — this is where a real Claude call earns its keep: there's no
// fixed set of questions to enumerate ahead of time.
//
// Grounded in a single injected snapshot of real business data rather than a wash-concierge-
// style tool-use loop — an owner's question ("should we add a bay," "is the premium tier
// worth it") is answered from a point-in-time picture of the business, not by letting the
// model poke at live tables turn by turn; simpler to build and reason about, and there's
// nothing here it would need to *act* on (no tools at all — the guardrail "never commits to
// a lease, hire, price change" is structural: nothing to call).
const { desc, gte } = require('drizzle-orm');
const { db } = require('../config/db');
const { strategyRecommendations } = require('../db/schema');
const { getAnthropicClient, isAgentsConfigured, AGENT_MODEL } = require('../config/anthropic');
const { getBayThroughput, getMembershipEconomics, getCashFlowForecast, getStaffingCapacity } = require('../services/simulationService');
const { recordAgentEvent } = require('../utils/agentMetrics');

const DETERMINISTIC_FALLBACK =
  "strategy-advisor needs ANTHROPIC_API_KEY configured to answer open-ended questions — without it, see the Finance, Simulations, and Reports pages directly for the underlying numbers.";

const REASONING_PATTERNS = ['unit-economics', 'scenario-comparison', 'root-cause-5-whys', 'decision-matrix'];

const SYSTEM_PROMPT = `You are strategy-advisor for SplashPoint Express Wash, a 6-bay car wash (4 tunnel-conveyor bays, 2 detail bays). You answer open-ended owner questions — pricing, capacity, membership economics, marketing spend — with a structured, traceable recommendation, never a bare opinion.

You are given a snapshot of the business's real current numbers below (bay throughput, membership economics, cash flow, staffing) — ground every claim in it, and say explicitly when you don't have enough data to be confident.

Use one of these reasoning patterns and name which one you used: unit-economics (membership plan profitability, marketing spend questions), scenario-comparison (comparing 2+ named options), root-cause-5-whys (chaining from a symptom to its likely cause), decision-matrix (comparing 3+ discrete options).

Structure your answer as:
Pattern: <one of the four patterns>
Confidence: <a percentage>
<2-4 sentences of analysis grounded in the numbers you were given>
Suggested next step: <a cheap, reversible experiment or check — never a firm commitment>

You must NEVER commit to a lease, hire, price change, or equipment purchase — you only recommend, with a stated confidence and a suggested experiment. If a prior recommendation is shown to you below and it's relevant, reference it explicitly rather than silently contradicting it.`;

const parseStructuredAnswer = (text) => {
  const patternMatch = text.match(/Pattern:\s*([a-z0-9-]+)/i);
  const confidenceMatch = text.match(/Confidence:\s*(\d+)/i);
  const pattern = patternMatch && REASONING_PATTERNS.includes(patternMatch[1].toLowerCase()) ? patternMatch[1].toLowerCase() : 'none';
  const confidencePercent = confidenceMatch ? Number(confidenceMatch[1]) : null;
  return { pattern, confidencePercent };
};

// Cheap word-overlap check, not real semantic search — "remembers prior recommendations ...
// so it flags rather than silently contradicts an earlier stance" doesn't need a vector
// store to be useful at this app's scale, just a way to surface an obviously-related past
// question.
const findRelatedPriorRecommendation = async (question) => {
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const prior = await db.select().from(strategyRecommendations).where(gte(strategyRecommendations.createdAt, since)).orderBy(desc(strategyRecommendations.createdAt)).limit(20);
  const questionWords = new Set(question.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  return prior.find((p) => {
    const priorWords = new Set(p.question.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
    const overlap = [...questionWords].filter((w) => priorWords.has(w));
    return overlap.length >= 2;
  });
};

// Entry point. Never throws — a missing key or a Claude API failure both return the
// deterministic fallback message rather than a 500, same posture as every other agent here.
const ask = async ({ question, askedBy }) => {
  if (!isAgentsConfigured()) {
    recordAgentEvent('strategy-advisor', 'deterministic-fallback');
    const [saved] = await db.insert(strategyRecommendations).values({ question, answer: DETERMINISTIC_FALLBACK, pattern: 'none', askedBy }).returning();
    return saved;
  }

  try {
    const [bayThroughput, economics, cashFlow, staffing] = await Promise.all([
      getBayThroughput(),
      getMembershipEconomics(),
      getCashFlowForecast(4),
      getStaffingCapacity(),
    ]);
    const relatedPrior = await findRelatedPriorRecommendation(question);

    const snapshotText = JSON.stringify(
      {
        bayThroughput: bayThroughput.lanes.map((l) => ({ lane: l.lane, effectiveCapacityPerHour: l.effectiveCapacityPerHour, peakDemand: l.peakDemand, structurallyUndersized: l.structurallyUndersized })),
        membershipEconomicsByTier: economics.tiers.map((t) => ({ plan: t.plan.name, monthlyPrice: t.plan.monthlyPrice, breakevenWashesPerMonth: t.breakevenWashesPerMonth, avgWashesPerMonth: t.avgWashesPerMonth, isLosingMoneyOnAverage: t.isLosingMoneyOnAverage, ltv: t.ltv, dataSource: t.washesDataSource })),
        cashFlow4WeekOutlook: cashFlow.weeks,
        staffingGapCount: staffing.gaps.length,
      },
      null,
      2
    );

    const userMessage = relatedPrior
      ? `Business snapshot (real current data):\n${snapshotText}\n\nA related prior recommendation exists from ${new Date(relatedPrior.createdAt).toDateString()} (confidence ${relatedPrior.confidencePercent}%): "${relatedPrior.answer}"\n\nOwner's new question: ${question}`
      : `Business snapshot (real current data):\n${snapshotText}\n\nOwner's question: ${question}`;

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = message.content.find((b) => b.type === 'text')?.text?.trim() || DETERMINISTIC_FALLBACK;
    const { pattern, confidencePercent } = parseStructuredAnswer(text);

    recordAgentEvent('strategy-advisor', 'ai-agent');
    const [saved] = await db.insert(strategyRecommendations).values({ question, answer: text, pattern, confidencePercent, askedBy }).returning();
    return saved;
  } catch (err) {
    console.error('[strategy-advisor] Claude call failed, using deterministic fallback:', err.message);
    recordAgentEvent('strategy-advisor', 'deterministic-fallback');
    const [saved] = await db.insert(strategyRecommendations).values({ question, answer: DETERMINISTIC_FALLBACK, pattern: 'none', askedBy }).returning();
    return saved;
  }
};

const getHistory = async () => db.select().from(strategyRecommendations).orderBy(desc(strategyRecommendations.createdAt)).limit(50);

module.exports = { ask, getHistory };
