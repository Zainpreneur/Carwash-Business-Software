const asyncHandler = require('express-async-handler');
const { computeRecommendations, createPurchaseOrdersFromRecommendations } = require('../agents/inventoryForecasterAgent');

// Preview only — doesn't create anything, lets the /inventory UI show what the forecaster
// would do before committing to it.
const getForecast = asyncHandler(async (req, res) => {
  const recommendations = await computeRecommendations();
  res.json(
    recommendations.map((r) => ({
      supply: { _id: r.supply._id, name: r.supply.name, quantityOnHand: r.supply.quantityOnHand, unit: r.supply.unit },
      dailyConsumption: r.dailyConsumption,
      sevenDaySupply: r.sevenDaySupply,
      recommendedQuantity: r.recommendedQuantity,
      estimatedCost: r.estimatedCost,
    }))
  );
});

// "Nightly schedule" per the spec — this app has no scheduler, so it runs when a
// site-manager clicks "Run forecast now" instead.
const runForecast = asyncHandler(async (req, res) => {
  const created = await createPurchaseOrdersFromRecommendations(req.user._id);
  res.status(201).json(created);
});

module.exports = { getForecast, runForecast };
