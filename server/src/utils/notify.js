const { inArray, and, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { users, notifications } = require('../db/schema');

/**
 * Create a notification for every active user with one of the given roles,
 * excluding the acting user. Blueprint events: evt_booking_created,
 * evt_booking_status_changed, evt_booking_completed.
 */
const notifyRoles = async (roles, { type = 'info', title, message, booking }, excludeUserId) => {
  const recipients = await db
    .select({ _id: users._id })
    .from(users)
    .where(and(inArray(users.role, roles), eq(users.active, true)));
  const rows = recipients
    .filter((r) => r._id !== excludeUserId)
    .map((r) => ({ user: r._id, type, title, message, booking: booking || null }));
  if (rows.length) await db.insert(notifications).values(rows);
};

module.exports = { notifyRoles };
