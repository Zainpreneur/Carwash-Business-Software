const asyncHandler = require('express-async-handler');
const { getOperatingSnapshot } = require('../agents/opsOrchestrator');
const { ask, getHistory } = require('../agents/strategyAdvisor');
const { generateReport } = require('../agents/systemHealthAgent');

const orchestratorSnapshot = asyncHandler(async (req, res) => res.json(await getOperatingSnapshot()));

const askStrategyAdvisor = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    res.status(400);
    throw new Error('question is required');
  }
  const result = await ask({ question: question.trim(), askedBy: req.user._id });
  res.status(201).json(result);
});

const strategyAdvisorHistory = asyncHandler(async (req, res) => res.json(await getHistory()));

const systemHealthReport = asyncHandler(async (req, res) => res.json(await generateReport()));

module.exports = { orchestratorSnapshot, askStrategyAdvisor, strategyAdvisorHistory, systemHealthReport };
