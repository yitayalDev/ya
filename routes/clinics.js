const express = require('express');
const router = express.Router();
const { 
  createClinic, 
  getClinics, 
  addStaff, 
  getClinicStaff,
  updateOperatingHours
} = require('../controllers/clinicController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('SUPER_ADMIN'), createClinic);
router.get('/', protect, getClinics);
router.post('/:id/staff', protect, authorize('SUPER_ADMIN', 'CLINIC_ADMIN'), addStaff);
router.get('/:id/staff', protect, getClinicStaff);
router.put('/:id/operating-hours', protect, authorize('SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR'), updateOperatingHours);

module.exports = router;
