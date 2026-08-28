// Lazily-constructed Claude client for the AI agent workforce (02-intelligence/ai-agents.md).
// Undefined until ANTHROPIC_API_KEY is set — this is a real per-token cost once wired up
// (unlike Stripe/WhatsApp, there's no free "test mode"), so every agent call must check
// isAgentsConfigured() and fall back to its existing deterministic logic rather than assume
// the key exists.
let cachedClient = null;

const isAgentsConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const getAnthropicClient = () => {
  if (!isAgentsConfigured()) return null;
  if (!cachedClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
};

const AGENT_MODEL = process.env.ANTHROPIC_AGENT_MODEL || 'claude-sonnet-5';

module.exports = { isAgentsConfigured, getAnthropicClient, AGENT_MODEL };
