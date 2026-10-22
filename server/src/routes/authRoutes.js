const express = require('express');
const {
  signup,
  register,
  login,
  getMe,
  switchTenant,
  acceptInvite,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Self-serve: create a business and its owner account in one call.
router.post('/signup', signup);
router.post('/login', login);
router.post('/accept-invite', acceptInvite);
router.post('/switch-tenant', protect, switchTenant);

// Adding a staff account to the business you already belong to.
router.post('/register', protect, authorize('admin'), register);

router.get('/me', protect, getMe);

module.exports = router;
