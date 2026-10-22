const express = require('express');
const {
  listTenants,
  getTenant,
  updateTenant,
  createTenantForCustomer,
  stats,
  plans,
} = require('../controllers/platformController');
const { protect, platformOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// The SaaS operator's console. Guarded by the platform role — a car wash
// business owner can never reach these endpoints.
router.use(protect, platformOnly);

router.get('/stats', stats);
router.get('/plans', plans);
router.route('/tenants').get(listTenants).post(createTenantForCustomer);
router.route('/tenants/:id').get(getTenant).put(updateTenant);

module.exports = router;
