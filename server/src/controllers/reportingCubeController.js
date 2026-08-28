const asyncHandler = require('express-async-handler');
const reportingCubeService = require('../services/reportingCubeService');

const revenueByBayDaily = asyncHandler(async (req, res) => res.json(await reportingCubeService.revenueByBayDaily({ days: req.query.days ? Number(req.query.days) : undefined })));
const membershipMixWeekly = asyncHandler(async (req, res) => res.json(await reportingCubeService.membershipMixWeekly({ weeks: req.query.weeks ? Number(req.query.weeks) : undefined })));
const packageTierMargin = asyncHandler(async (req, res) => res.json(await reportingCubeService.packageTierMargin()));
const aovByVehicleType = asyncHandler(async (req, res) => res.json(await reportingCubeService.aovByVehicleType({ days: req.query.days ? Number(req.query.days) : undefined })));
const technicianThroughput = asyncHandler(async (req, res) => res.json(await reportingCubeService.technicianThroughput({ weeks: req.query.weeks ? Number(req.query.weeks) : undefined })));
const arAging = asyncHandler(async (req, res) => res.json(await reportingCubeService.arAging()));

module.exports = { revenueByBayDaily, membershipMixWeekly, packageTierMargin, aovByVehicleType, technicianThroughput, arAging };
