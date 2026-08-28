const express = require('express');
const { orchestratorSnapshot, askStrategyAdvisor, strategyAdvisorHistory, systemHealthReport } = require('../controllers/agentOpsController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// ops-orchestrator, strategy-advisor, system-health-agent (02-intelligence/ai-agents.md's
// "Orchestrator" and "Advisor agents" clusters) — admin/manager only, the same site-manager/
// owner-level gate as Finance/Simulations.
router.use(protect, authorize('admin', 'manager'));

router.get('/orchestrator-snapshot', orchestratorSnapshot);
router.post('/strategy-advisor/ask', askStrategyAdvisor);
router.get('/strategy-advisor/history', strategyAdvisorHistory);
router.get('/system-health-report', systemHealthReport);

module.exports = router;
