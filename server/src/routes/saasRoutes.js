const express = require('express');
const { listPlans } = require('../services/plans');

const router = express.Router();

/**
 * Public plan catalogue — used by the signup page to show what a business can
 * buy. No authentication: this is marketing information.
 */
router.get('/plans', async (req, res) => {
  res.json(await listPlans());
});

module.exports = router;
