// Append-only audit trail (01-foundation/security.md's "Audit" section). Fire-and-forget from
// every call site, same posture this app already takes with WhatsApp sends and ledger
// postings — a logging failure must never block the real action that triggered it.
const { db } = require('../config/db');
const { auditLogs } = require('../db/schema');

const logAudit = async ({ entity, entityId, action, actorType, actorId, before, after }) => {
  try {
    await db.insert(auditLogs).values({
      entity,
      entityId,
      action,
      actorType,
      actorId: actorId ? String(actorId) : null,
      before: before ?? null,
      after: after ?? null,
    });
  } catch (err) {
    console.error(`[audit] failed to log ${action} on ${entity}:`, err.message);
  }
};

module.exports = { logAudit };
