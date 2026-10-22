const express = require('express');
const {
  getCurrent,
  updateCurrent,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getMembers,
  addMember,
  updateMember,
  removeMember,
  createInvite,
  getInvites,
} = require('../controllers/tenantController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Everything under /api/tenant acts on the business the caller is working in.
router.use(protect);

router
  .route('/current')
  .get(getCurrent)
  .put(authorize('admin'), updateCurrent);

router
  .route('/current/locations')
  .get(getLocations)
  .post(authorize('admin'), createLocation);

router
  .route('/current/locations/:id')
  .put(authorize('admin'), updateLocation)
  .delete(authorize('admin'), deleteLocation);

router
  .route('/current/members')
  .get(getMembers)
  .post(authorize('admin'), addMember);

router
  .route('/current/members/:id')
  .put(authorize('admin'), updateMember)
  .delete(authorize('admin'), removeMember);

router
  .route('/current/invites')
  .get(authorize('admin'), getInvites)
  .post(authorize('admin'), createInvite);

module.exports = router;
