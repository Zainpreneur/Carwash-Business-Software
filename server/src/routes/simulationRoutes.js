const express = require('express');
const {
  bayThroughput,
  demandForecast,
  staffingCapacity,
  membershipEconomics,
  cashFlowForecast,
  pricingScenario,
} = require('../controllers/simulationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Simulation & forecasting (02-intelligence/simulation.md) — admin/manager only, same gate
// as Finance/Reports (these feed the Financial/Operations Views, not a floor-staff surface).
router.use(protect, authorize('admin', 'manager'));

router.get('/bay-throughput', bayThroughput);
router.get('/demand-forecast', demandForecast);
router.get('/staffing-capacity', staffingCapacity);
router.get('/membership-economics', membershipEconomics);
router.get('/cash-flow-forecast', cashFlowForecast);
router.post('/pricing-scenario', pricingScenario);

module.exports = router;
