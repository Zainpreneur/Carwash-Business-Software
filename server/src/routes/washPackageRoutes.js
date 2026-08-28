const express = require('express');
const {
  getWashPackages,
  getWashPackage,
  createWashPackage,
  updateWashPackage,
  deleteWashPackage,
} = require('../controllers/washPackageController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.route('/').get(getWashPackages).post(authorize('admin', 'manager'), createWashPackage);
router
  .route('/:id')
  .get(getWashPackage)
  .put(authorize('admin', 'manager'), updateWashPackage)
  .delete(authorize('admin', 'manager'), deleteWashPackage);

module.exports = router;
