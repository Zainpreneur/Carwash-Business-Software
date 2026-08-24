const asyncHandler = require('express-async-handler');
const { eq, desc, and, count } = require('drizzle-orm');
const { db } = require('../config/db');
const { notifications, bookings } = require('../db/schema');

const getNotifications = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: notifications._id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      booking: { _id: bookings._id, bookingNumber: bookings.bookingNumber },
    })
    .from(notifications)
    .leftJoin(bookings, eq(notifications.booking, bookings._id))
    .where(eq(notifications.user, req.user._id))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  res.json(rows);
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const [{ total }] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.user, req.user._id), eq(notifications.read, false)));
  res.json({ count: Number(total) });
});

const markRead = asyncHandler(async (req, res) => {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications._id, req.params.id), eq(notifications.user, req.user._id)));
  res.json({ message: 'Marked as read' });
});

const markAllRead = asyncHandler(async (req, res) => {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.user, req.user._id));
  res.json({ message: 'All marked as read' });
});

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
