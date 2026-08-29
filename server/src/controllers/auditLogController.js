const asyncHandler = require('express-async-handler');
const { eq, desc, and } = require('drizzle-orm');
const { db } = require('../config/db');
const { auditLogs, users } = require('../db/schema');

// 01-foundation/security.md's audit log — read-only by design (append-only means nothing
// here should ever be edited, including via this API). actorId is a bare string (a real
// Users._id for actorType=user, or an agent-name string otherwise — see schema.js's
// comment), so a human actor's name is resolved here rather than via a SQL join.
const getAuditLog = asyncHandler(async (req, res) => {
  const { entity, limit } = req.query;
  const filters = [];
  if (entity) filters.push(eq(auditLogs.entity, entity));

  const rows = await db
    .select()
    .from(auditLogs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit ? Number(limit) : 200);

  const userIds = [...new Set(rows.filter((r) => r.actorType === 'user' && r.actorId).map((r) => r.actorId))];
  const userRows = userIds.length ? await db.select({ _id: users._id, name: users.name }).from(users) : [];
  const nameById = new Map(userRows.filter((u) => userIds.includes(u._id)).map((u) => [u._id, u.name]));

  res.json(
    rows.map((r) => ({
      ...r,
      actorName: r.actorType === 'user' ? nameById.get(r.actorId) || 'Unknown user' : r.actorId || 'System',
    }))
  );
});

module.exports = { getAuditLog };
