const express = require('express');
const router = express.Router();

const { 
  createMedicalVisit, 
  createPrescription, 
  getMedicalHistory,
  checkPrescriptionSafety
} = require('../controllers/consultationController');
const { protect, authorize } = require('../middleware/auth');

router.post('/visit', protect, authorize('DOCTOR'), createMedicalVisit);
router.post('/prescription', protect, authorize('DOCTOR'), createPrescription);
router.post('/check-safety', protect, authorize('DOCTOR'), checkPrescriptionSafety);
router.get('/history/:studentId', protect, getMedicalHistory);

module.exports = router;
