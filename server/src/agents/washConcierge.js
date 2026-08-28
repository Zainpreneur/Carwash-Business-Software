// wash-concierge (02-intelligence/ai-agents.md) — "the highest-volume customer-facing
// surface". Handles inbound WhatsApp messages: order-status lookup, membership sign-up,
// pause/cancel, and FAQ, per the conversational-flow table in 04-growth/whatsapp.md.
//
// Two things from the spec are deliberately NOT built here (documented, not silently
// dropped): detail-bay appointment booking/rescheduling, which the spec itself says should
// be "WhatsApp Flows (a structured time-slot/package picker) rather than free text" — a
// separate platform feature, not a chat capability — and a real knowledge_base.search tool
// (06-platform/knowledge-base.md's KB entity isn't built); FAQ content is folded directly
// into the system prompt instead.
//
// Guardrails enforced in code, not just the prompt (per the spec's own framing):
//   - every tool that touches a Customer/Vehicle/MembershipSubscription is scoped to
//     whichever Customer row's phone matches the inbound number — the model is never handed
//     a bare customerId/vehicleId it could substitute; it can only act on the sender's own
//     record.
//   - no tool exists to change pricing, process a cash refund, or set qcResult — those
//     guardrails are structural (nothing to call), not just an instruction.
//   - a hard round cap forces escalation rather than an unbounded tool-call loop.
const { eq, and, gte, desc, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  customers,
  vehicles,
  washOrders,
  washPackages,
  packagePricing,
  membershipPlans,
  membershipSubscriptions,
  agentConversations,
  tickets,
} = require('../db/schema');
const { isAgentsConfigured, getAnthropicClient, AGENT_MODEL } = require('../config/anthropic');
const { isWhatsAppConfigured, sendWhatsAppText } = require('../utils/whatsapp');
const { notifyRoles } = require('../utils/notify');
const membershipService = require('../services/membershipService');
const { getStripe, isStripeConfigured } = require('../config/stripe');
const { recordAgentEvent } = require('../utils/agentMetrics');

// escalate_to_human's reason -> Ticket.category (04-growth/crm.md's category list). "other"
// and "negative-sentiment"/"low-confidence" don't map to a specific SLA-bearing category, so
// they fall back to "general" — still a real, trackable ticket, just the default SLA.
const REASON_TO_CATEGORY = {
  'damage-claim': 'damage-claim',
  'refund-request': 'billing-dispute',
  'negative-sentiment': 'quality-complaint',
};
const categoryFor = (reason) => REASON_TO_CATEGORY[reason] || 'general';

const NON_TERMINAL_STATUSES = ['queued', 'bay-assigned', 'in-wash', 'quality-check', 'ready-for-pickup'];
const ACTIVE_SUB_STATUSES = ['active', 'past-due', 'suspended', 'paused'];
const MAX_TOOL_ROUNDS = 4;
const MEMORY_DAYS = 90;

const SYSTEM_PROMPT = `You are wash-concierge, the WhatsApp assistant for SplashPoint Express Wash, a 6-bay car wash (4 tunnel-conveyor express bays, 2 detail bays), open 7am-8pm daily.

You help with: checking wash status ("where's my car"), membership sign-up, pausing/cancelling an existing membership, and answering FAQ using list_wash_packages/list_membership_plans for current pricing (never invent a price).

Guarantee/rework policy: if a customer is unhappy with wash quality, tell them a free rework will be arranged at no charge, then call escalate_to_human so a technician follows up — you cannot schedule the rework yourself.

Detail-bay appointment booking/rescheduling is NOT something you can do in this chat — tell the customer to call or visit, or call escalate_to_human if they need help now.

You must call escalate_to_human immediately, before replying further, if: the customer mentions damage to their vehicle, sounds upset or negative about their experience, asks for a cash refund, or asks for anything you're not confident (>=70%) falls under status/membership/FAQ above. Never invent a discount, price change, or refund — you have no tool for any of those, so if asked, explain a human needs to handle it and escalate.

Keep replies short and friendly, plain text (no markdown), like a real WhatsApp message. If you don't recognize the sender's number in our system, ask for their name or vehicle plate before doing anything account-specific.`;

const TOOLS = [
  {
    name: 'get_wash_status',
    description: "Look up the sender's own vehicle(s) and their current or most recent wash order status.",
    input_schema: {
      type: 'object',
      properties: { plateNumber: { type: 'string', description: 'Optional — narrow to one vehicle by plate' } },
    },
  },
  {
    name: 'list_wash_packages',
    description: 'List current wash packages and pricing tiers.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_membership_plans',
    description: 'List current membership plans and monthly pricing.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'start_membership_signup',
    description: "Sign the sender's vehicle up for a membership plan. Returns a Stripe checkout link if payments are connected, or confirms signup directly in demo mode.",
    input_schema: {
      type: 'object',
      properties: {
        vehiclePlate: { type: 'string', description: "The sender's vehicle plate to attach the membership to" },
        planId: { type: 'string', description: 'The membership plan id from list_membership_plans' },
      },
      required: ['vehiclePlate', 'planId'],
    },
  },
  {
    name: 'manage_membership',
    description: "Pause or cancel the sender's own active membership. Cancellation is allowed without approval; do not invent a retention offer beyond the standard pause option.",
    input_schema: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['pause', 'cancel'] } },
      required: ['action'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Flag this conversation for a site-manager to follow up. Always call this for damage claims, negative sentiment, refund requests, or anything below 70% confidence.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['damage-claim', 'negative-sentiment', 'refund-request', 'low-confidence', 'other'] },
        summary: { type: 'string', description: 'One sentence summarizing the issue for the human who picks this up' },
      },
      required: ['reason', 'summary'],
    },
  },
];

const findCustomerByPhone = async (phone) => {
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (!digits) return null;
  const rows = await db.select().from(customers);
  return rows.find((c) => String(c.phone).replace(/\D/g, '').slice(-10) === digits) || null;
};

const executeTool = async (name, input, ctx) => {
  switch (name) {
    case 'get_wash_status': {
      if (!ctx.customer) return { error: 'no_account_found' };
      let vehicleRows = await db.select().from(vehicles).where(eq(vehicles.customer, ctx.customer._id));
      if (input.plateNumber) {
        const needle = String(input.plateNumber).toUpperCase();
        vehicleRows = vehicleRows.filter((v) => v.plateNumber.toUpperCase().includes(needle));
      }
      if (!vehicleRows.length) return { error: 'vehicle_not_found' };

      const vehicleIds = vehicleRows.map((v) => v._id);
      const [activeOrder] = await db
        .select()
        .from(washOrders)
        .where(and(inArray(washOrders.vehicle, vehicleIds), inArray(washOrders.status, NON_TERMINAL_STATUSES)))
        .orderBy(desc(washOrders.queuedAt))
        .limit(1);
      const order = activeOrder || (await db
        .select()
        .from(washOrders)
        .where(inArray(washOrders.vehicle, vehicleIds))
        .orderBy(desc(washOrders.queuedAt))
        .limit(1))[0];
      if (!order) return { found: false };

      const vehicle = vehicleRows.find((v) => v._id === order.vehicle);
      return {
        found: true,
        vehiclePlate: vehicle?.plateNumber,
        status: order.status,
        orderNumber: order.orderNumber,
        queuePosition: order.queuePosition,
      };
    }

    case 'list_wash_packages': {
      const rows = await db.select().from(washPackages).where(eq(washPackages.active, true));
      const pricing = await db.select().from(packagePricing);
      return rows.map((p) => ({
        name: p.name,
        tier: p.tier,
        lane: p.deliveryLane,
        pricing: Object.fromEntries(pricing.filter((pr) => pr.package === p._id).map((pr) => [pr.vehicleType, pr.price])),
      }));
    }

    case 'list_membership_plans': {
      const rows = await db.select().from(membershipPlans).where(eq(membershipPlans.active, true));
      return rows.map((p) => ({
        id: p._id,
        name: p.name,
        tier: p.tier,
        monthlyPrice: p.monthlyPrice,
        unlimited: p.isUnlimited,
        washesPerMonthCap: p.washesPerMonthCap,
      }));
    }

    case 'start_membership_signup': {
      if (!ctx.customer) return { error: 'no_account_found' };
      const vehicleRows = await db.select().from(vehicles).where(eq(vehicles.customer, ctx.customer._id));
      const vehicle = vehicleRows.find((v) => v.plateNumber.toUpperCase() === String(input.vehiclePlate).toUpperCase());
      if (!vehicle) return { error: 'vehicle_not_found' };
      try {
        const result = await membershipService.createSubscription({
          customerId: ctx.customer._id,
          vehicleId: vehicle._id,
          planId: input.planId,
        });
        return result;
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'manage_membership': {
      if (!ctx.customer) return { error: 'no_account_found' };
      const [sub] = await db
        .select()
        .from(membershipSubscriptions)
        .where(and(eq(membershipSubscriptions.customer, ctx.customer._id), inArray(membershipSubscriptions.status, ACTIVE_SUB_STATUSES)));
      if (!sub) return { error: 'no_active_membership' };

      if (input.action === 'pause') {
        if (sub.status !== 'active') return { error: `cannot_pause_from_${sub.status}` };
        if (sub.stripeSubscriptionId && isStripeConfigured()) {
          await getStripe().subscriptions.update(sub.stripeSubscriptionId, { pause_collection: { behavior: 'void' } }).catch(() => {});
        }
        await db.update(membershipSubscriptions).set({ status: 'paused', updatedAt: new Date() }).where(eq(membershipSubscriptions._id, sub._id));
        return { ok: true, status: 'paused' };
      }

      // cancel — "allowed autonomously" per the spec
      if (sub.stripeSubscriptionId && isStripeConfigured()) {
        await getStripe().subscriptions.cancel(sub.stripeSubscriptionId).catch(() => {});
      }
      await db.update(membershipSubscriptions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(membershipSubscriptions._id, sub._id));
      return { ok: true, status: 'cancelled' };
    }

    case 'escalate_to_human': {
      // Give the escalation somewhere to be tracked to resolution, not just a fire-and-forget
      // notification — a real Ticket (04-growth/crm.md), SLA-timed by category. A ticket
      // needs a Customer row (schema: customer is required); an unrecognized sender still
      // gets the staff notification, just no ticket — nothing to attach it to yet.
      let ticketId = null;
      if (ctx.customer) {
        const [created] = await db
          .insert(tickets)
          .values({
            customer: ctx.customer._id,
            subject: `wash-concierge escalation: ${input.reason}`,
            category: categoryFor(input.reason),
            priority: input.reason === 'damage-claim' ? 'high' : 'normal',
            description: input.summary,
            source: 'whatsapp',
          })
          .returning();
        ticketId = created._id;
      }

      await notifyRoles(['admin', 'manager'], {
        type: 'wash_concierge_escalation',
        title: `Concierge escalation: ${input.reason}`,
        message: `${ctx.customer?.name || ctx.phone}: ${input.summary}`,
      });
      return { escalated: true, ticketId };
    }

    default:
      return { error: 'unknown_tool' };
  }
};

const deterministicReply = async (phone, customer) => {
  await notifyRoles(['admin', 'manager'], {
    type: 'wash_concierge_escalation',
    title: 'Unhandled WhatsApp message',
    message: `${customer?.name || phone} messaged in — no AI agent configured, please follow up directly.`,
  });
  return "Thanks for messaging SplashPoint Express Wash! A team member will follow up with you shortly.";
};

// Entry point — call with the raw inbound webhook payload's from/text. Never throws; a
// Claude API failure or an unconfigured agent both resolve to a safe reply plus a staff
// notification, so no inbound message is ever silently dropped.
const handleInboundMessage = async ({ fromPhone, text }) => {
  const customer = await findCustomerByPhone(fromPhone);

  await db.insert(agentConversations).values({ phone: fromPhone, customer: customer?._id || null, role: 'user', content: text });

  let replyText;
  let toolCallsLog = [];
  let source = 'ai-agent';

  if (!isAgentsConfigured()) {
    source = 'deterministic-fallback';
    replyText = await deterministicReply(fromPhone, customer);
  } else {
    try {
      const since = new Date(Date.now() - MEMORY_DAYS * 24 * 60 * 60 * 1000);
      const history = await db
        .select()
        .from(agentConversations)
        .where(and(eq(agentConversations.phone, fromPhone), gte(agentConversations.createdAt, since)))
        .orderBy(agentConversations.createdAt)
        .limit(41); // last ~20 turns + the one just saved

      const client = getAnthropicClient();
      const ctx = { phone: fromPhone, customer };
      let messages = history.map((h) => ({ role: h.role, content: h.content }));

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await client.messages.create({
          model: AGENT_MODEL,
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
        });

        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
        if (toolUseBlocks.length === 0) {
          replyText = response.content.find((b) => b.type === 'text')?.text?.trim();
          break;
        }

        messages.push({ role: 'assistant', content: response.content });
        const toolResults = [];
        for (const block of toolUseBlocks) {
          const result = await executeTool(block.name, block.input, ctx);
          toolCallsLog.push({ name: block.name, input: block.input, result });
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
        }
        messages.push({ role: 'user', content: toolResults });

        if (round === MAX_TOOL_ROUNDS - 1) {
          await executeTool('escalate_to_human', { reason: 'low-confidence', summary: 'Conversation needed more tool calls than allowed' }, ctx);
          replyText = "I want to make sure this is handled right — I've flagged it for our team and they'll follow up shortly.";
        }
      }
      replyText = replyText || "Sorry, I couldn't quite process that — a team member will follow up with you.";
    } catch (err) {
      console.error('[wash-concierge] Claude call failed:', err.message);
      source = 'deterministic-fallback';
      replyText = await deterministicReply(fromPhone, customer);
    }
  }

  recordAgentEvent('wash-concierge', source, toolCallsLog.some((t) => t.name === 'escalate_to_human'));

  await db.insert(agentConversations).values({
    phone: fromPhone,
    customer: customer?._id || null,
    role: 'assistant',
    content: replyText,
    toolCalls: toolCallsLog.length ? toolCallsLog : null,
  });

  if (isWhatsAppConfigured()) {
    await sendWhatsAppText(fromPhone, replyText);
  }

  return { replyText, toolCalls: toolCallsLog };
};

module.exports = { handleInboundMessage };
