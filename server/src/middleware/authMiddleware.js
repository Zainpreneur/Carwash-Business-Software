const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { users } = require('../db/schema');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [user] = await db.select().from(users).where(eq(users._id, decoded.id));
    req.user = user;
    if (!req.user || !req.user.active) {
      res.status(401);
      throw new Error('Not authorized, user not found or inactive');
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token invalid or expired');
  }
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error(`Role '${req.user ? req.user.role : 'guest'}' is not permitted for this action`);
  }
  next();
};

module.exports = { protect, authorize };
