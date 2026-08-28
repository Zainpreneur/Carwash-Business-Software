const express = require('express');
const { getAccounts, getEntries, getPnl } = require('../controllers/ledgerController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Financial data — admin/manager only (05-finance/accounting.md's "Financial View" and
// weekly-reconciliation duty are site-manager/owner-level, matching this app's existing
// admin/manager gate on Expenses/Reports).
router.use(protect, authorize('admin', 'manager'));
router.get('/accounts', getAccounts);
router.get('/entries', getEntries);
router.get('/pnl', getPnl);

module.exports = router;
