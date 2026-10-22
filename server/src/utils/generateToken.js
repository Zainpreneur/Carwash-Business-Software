const jwt = require('jsonwebtoken');

/**
 * Issue a session token. `tenantId` is the business the user is currently
 * working in — it is a *hint* only: every request re-checks the membership
 * server-side, so a stale or tampered claim can never widen access.
 */
const generateToken = (id, tenantId) =>
  jwt.sign({ id, ...(tenantId ? { tid: tenantId } : {}) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports = generateToken;
