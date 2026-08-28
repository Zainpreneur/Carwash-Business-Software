const express = require('express');
const { washReceipt, membershipAgreement, washPackageComparison } = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// 06-platform/knowledge-base.md's three "generated from" document types — any authenticated
// role can generate one (a cashier prints receipts, any floor staff can hand a customer a
// package comparison), same openness as Tickets/Bookings.
router.use(protect);
router.get('/wash-receipt/:orderId', washReceipt);
router.get('/membership-agreement/:subscriptionId', membershipAgreement);
router.get('/wash-package-comparison', washPackageComparison);

module.exports = router;
