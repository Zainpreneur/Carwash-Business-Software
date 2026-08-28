const express = require('express');
const asyncHandler = require('express-async-handler');
const { getConversations } = require('../controllers/conciergeController');
const { handleInboundMessage } = require('../agents/washConcierge');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, authorize('admin', 'manager'));
router.get('/conversations', getConversations);

// Lets staff (and this session's own verification) exercise wash-concierge without a real
// WhatsApp number — runs the exact same handleInboundMessage the webhook calls, including
// an actual outbound send attempt if WhatsApp is configured.
router.post(
  '/simulate',
  asyncHandler(async (req, res) => {
    const { fromPhone, text } = req.body;
    if (!fromPhone || !text) {
      res.status(400);
      throw new Error('fromPhone and text are required');
    }
    const result = await handleInboundMessage({ fromPhone, text });
    res.json(result);
  })
);

module.exports = router;
