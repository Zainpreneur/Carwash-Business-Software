const { eq, and, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { serviceBays, washOrders } = require('../db/schema');

// A bay's "current" occupant is derived from active wash orders, not a stored FK — avoids
// a circular FK between service_bays and wash_orders. Shared by the wash-order controller
// (manual/auto bay assignment) and the bay-down-reroute automation.
const ACTIVE_STATUSES = ['bay-assigned', 'in-wash', 'quality-check', 'ready-for-pickup'];

const findOpenBay = async (laneBayType, { excludeBayId } = {}) => {
  const candidates = await db
    .select()
    .from(serviceBays)
    .where(and(eq(serviceBays.bayType, laneBayType), eq(serviceBays.operationalStatus, 'operational')))
    .orderBy(serviceBays.bayNumber);
  const occupied = await db
    .select({ bay: washOrders.bay })
    .from(washOrders)
    .where(inArray(washOrders.status, ACTIVE_STATUSES));
  const occupiedIds = new Set(occupied.map((o) => o.bay));
  return candidates.find((b) => b._id !== excludeBayId && !occupiedIds.has(b._id));
};

module.exports = { ACTIVE_STATUSES, findOpenBay };
