const asyncHandler = require('express-async-handler');
const { generateWashReceipt, generateMembershipAgreement, generateWashPackageComparison } = require('../services/documentService');

const washReceipt = asyncHandler(async (req, res) => {
  let doc;
  try {
    doc = await generateWashReceipt(req.params.orderId);
  } catch (err) {
    res.status(400);
    throw err;
  }
  if (!doc) {
    res.status(404);
    throw new Error('Wash order not found');
  }
  res.json(doc);
});

const membershipAgreement = asyncHandler(async (req, res) => {
  const doc = await generateMembershipAgreement(req.params.subscriptionId);
  if (!doc) {
    res.status(404);
    throw new Error('Membership subscription not found');
  }
  res.json(doc);
});

const washPackageComparison = asyncHandler(async (req, res) => res.json(await generateWashPackageComparison()));

module.exports = { washReceipt, membershipAgreement, washPackageComparison };
