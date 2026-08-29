const express = require('express');
const { getAuditLog } = require('../controllers/auditLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// 01-foundation/security.md's audit log — admin/manager only, matching this app's existing
// gate on Employee/HR data (the same entities' rows live in here).
router.use(protect, authorize('admin', 'manager'));
router.get('/', getAuditLog);

module.exports = router;
