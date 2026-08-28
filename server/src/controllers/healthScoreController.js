const asyncHandler = require('express-async-handler');
const { getBusinessHealthScore, updateWeights } = require('../services/healthScoreService');

const healthScore = asyncHandler(async (req, res) => res.json(await getBusinessHealthScore()));

const patchWeights = asyncHandler(async (req, res) => {
  try {
    const updated = await updateWeights(req.body, req.user._id);
    res.json(updated);
  } catch (err) {
    res.status(400);
    throw err;
  }
});

module.exports = { healthScore, patchWeights };
