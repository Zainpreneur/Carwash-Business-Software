const asyncHandler = require('express-async-handler');
const { desc, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { agentConversations, customers } = require('../db/schema');

// Site-manager visibility into wash-concierge's conversations — not a spec'd screen, but
// without it every chat would be invisible to staff except via the escalation notifications
// individual turns fire. admin/manager only, same as the other customer-contact history.
const getConversations = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: agentConversations._id,
      phone: agentConversations.phone,
      customer: { _id: customers._id, name: customers.name },
      role: agentConversations.role,
      content: agentConversations.content,
      toolCalls: agentConversations.toolCalls,
      createdAt: agentConversations.createdAt,
    })
    .from(agentConversations)
    .leftJoin(customers, eq(agentConversations.customer, customers._id))
    .orderBy(desc(agentConversations.createdAt))
    .limit(200);
  res.json(rows);
});

module.exports = { getConversations };
