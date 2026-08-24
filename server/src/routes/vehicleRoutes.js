const express = require('express');
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  lookupByPlate,
} = require('../controllers/vehicleController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/plate/:plate', lookupByPlate);
router.route('/').get(getVehicles).post(createVehicle);
router.route('/:id').get(getVehicle).put(updateVehicle).delete(deleteVehicle);

module.exports = router;
