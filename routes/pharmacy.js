const express = require('express');
const router = express.Router();

const { 
  updateStock, 
  getClinicStock, 
  getPendingPrescriptions, 
  dispensePrescription 
} = require('../controllers/pharmacyController');
const { protect, authorize } = require('../middleware/auth');

router.post('/stock', protect, authorize('PHARMACIST', 'SUPER_ADMIN'), updateStock);
router.get('/stock/:clinicId', protect, getClinicStock);
router.get('/prescriptions/:clinicId', protect, authorize('PHARMACIST'), getPendingPrescriptions);
router.put('/dispense/:id', protect, authorize('PHARMACIST'), dispensePrescription);

module.exports = router;
