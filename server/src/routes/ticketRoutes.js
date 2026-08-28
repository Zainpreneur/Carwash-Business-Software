const express = require('express');
const {
  getTickets,
  getTicket,
  createTicket,
  updateStatus,
  assignTicket,
  addComment,
} = require('../controllers/ticketController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Any authenticated staff member can raise/work tickets — support isn't admin/manager-only
// the way membership billing is (04-growth/crm.md's support channels are staff-facing).
router.use(protect);
router.route('/').get(getTickets).post(createTicket);
router.route('/:id').get(getTicket);
router.patch('/:id/status', updateStatus);
router.patch('/:id/assign', assignTicket);
router.post('/:id/comments', addComment);

module.exports = router;
