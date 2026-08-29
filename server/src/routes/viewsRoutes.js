const express = require('express');
const { executiveDigest, sendExecutiveDigest } = require('../controllers/viewsController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// 02-intelligence/views.md's Executive/Owner View — admin/manager can preview it, only admin
// triggers an actual send (matches the "owner"-audience framing).
router.use(protect, authorize('admin', 'manager'));
router.get('/executive', executiveDigest);
router.post('/executive/send', authorize('admin'), sendExecutiveDigest);

module.exports = router;
