const { db } = require('../config/db');
const { auditLogs } = require('../db/schema');

/**
 * Record who did what, inside which business. Audit rows are tenant-scoped by
 * the data layer, so they can never leak into another business's log.
 */
const logAudit = async (req, action, entity, entityId, meta) => {
  try {
    await db.insert(auditLogs).values({
      user: req.user?._id || null,
      action,
      entity: entity || null,
      entityId: entityId || null,
      meta: meta || null,
      ip: req.ip || null,
    });
  } catch (err) {
    // Auditing must never break the request it is recording.
    console.error('[audit] failed to record', action, err.message);
  }
};

module.exports = { logAudit };
