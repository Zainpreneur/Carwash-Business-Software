const asyncHandler = require('express-async-handler');
const {
  getBayThroughput,
  getDemandForecast,
  getStaffingCapacity,
  getMembershipEconomics,
  getPricingScenario,
  getCashFlowForecast,
} = require('../services/simulationService');

const bayThroughput = asyncHandler(async (req, res) => res.json(await getBayThroughput()));
const demandForecast = asyncHandler(async (req, res) => res.json(await getDemandForecast()));
const staffingCapacity = asyncHandler(async (req, res) => res.json(await getStaffingCapacity()));
const membershipEconomics = asyncHandler(async (req, res) => res.json(await getMembershipEconomics()));
const cashFlowForecast = asyncHandler(async (req, res) => res.json(await getCashFlowForecast(Number(req.query.weeks) || 4)));

const pricingScenario = asyncHandler(async (req, res) => {
  const { planId, priceChangePercent, elasticity } = req.body;
  if (!planId || priceChangePercent === undefined) {
    res.status(400);
    throw new Error('planId and priceChangePercent are required');
  }
  try {
    const result = await getPricingScenario({ planId, priceChangePercent: Number(priceChangePercent), elasticity: elasticity !== undefined ? Number(elasticity) : undefined });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500);
    throw err;
  }
});

module.exports = { bayThroughput, demandForecast, staffingCapacity, membershipEconomics, cashFlowForecast, pricingScenario };
