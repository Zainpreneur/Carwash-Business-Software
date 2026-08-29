// ABAC helper (01-foundation/security.md): "fleet-account-manager: Read/update on Customer
// and Invoice, read-only on WashOrder - scoped to the fleet segment." This app's login role
// is still the 3-tier admin/manager/staff (README's own documented RBAC gap — the spec's
// full 7-role breakdown isn't a primary-role migration this app has made), but a staff
// login's actual operational position already lives on the linked Employee row
// (`Employee.position`, set in the HR phase). This is how a controller checks "is this
// specific staff member a fleet-account-manager" without touching the primary role model —
// an additive scoping rule on top of the existing 'staff' role, not a replacement for it.
const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { employees } = require('../db/schema');

const getEmployeePosition = async (userId) => {
  if (!userId) return null;
  const [employee] = await db.select({ position: employees.position }).from(employees).where(eq(employees.user, userId));
  return employee?.position || null;
};

// Route guard for the "read-only on WashOrder" half of the fleet-account-manager scope —
// applied only to the mutating WashOrder routes, never GET. Any other position (or a staff
// member with no linked Employee row at all) passes through unaffected.
const denyFleetAccountManagerWrite = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'staff') return next();
  const position = await getEmployeePosition(req.user._id);
  if (position === 'fleet-account-manager') {
    res.status(403);
    throw new Error('fleet-account-manager has read-only access to wash orders');
  }
  next();
});

module.exports = { getEmployeePosition, denyFleetAccountManagerWrite };
