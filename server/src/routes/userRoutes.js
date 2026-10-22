const express = require('express');
const { getUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
// Any authenticated user may list staff (needed to assign bookings); only admins manage
// accounts. Updating is allowed for yourself as well — the controller decides what a
// member may change about their own profile.
router.route('/').get(getUsers).post(authorize('admin'), createUser);
router.route('/:id').get(getUser).put(updateUser).delete(authorize('admin'), deleteUser);

module.exports = router;
