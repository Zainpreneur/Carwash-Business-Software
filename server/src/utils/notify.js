const { and, eq, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { users, tenantMembers, notifications } = require('../db/schema');
const { getTenantId } = require('../db/tenantDb');

/**
 * Create a notification for every member of the *current business* with one of
 * the given roles, excluding the acting user.
 *
 * Recipients are resolved through the business membership, not the global user
 * table — a manager of one car wash must never see a notification meant for
 * another business.
 */
const notifyRoles = async (roles, { type = 'info', title, message, booking }, excludeUserId) => {
  const tenantId = getTenantId();
  if (!tenantId) return;

  const recipients = await db
    .select({ _id: users._id })
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.user, users._id))
    .where(
      and(
        eq(tenantMembers.tenant, tenantId),
        eq(tenantMembers.status, 'active'),
        inArray(tenantMembers.role, roles),
        eq(users.active, true)
      )
    );

  const rows = recipients
    .filter((r) => r._id !== excludeUserId)
    .map((r) => ({ user: r._id, type, title, message, booking: booking || null }));

  if (rows.length) await db.insert(notifications).values(rows);
};

module.exports = { notifyRoles };
