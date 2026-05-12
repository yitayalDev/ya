const express = require('express');
const router = express.Router();
const { 
  bookAppointment, 
  getMyAppointments, 
  getClinicAppointments, 
  updateStatus,
  startVideoSession,
  joinVideoSession,
  sendVideoReminder,
  saveSessionNotes,
  endVideoSession,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('STUDENT'), bookAppointment);
router.get('/my', protect, authorize('STUDENT'), getMyAppointments);
router.get('/clinic/:clinicId', protect, authorize('DOCTOR', 'NURSE', 'CLINIC_ADMIN', 'SUPER_ADMIN'), getClinicAppointments);
router.post('/:id/video/start', protect, authorize('DOCTOR', 'NURSE', 'CLINIC_ADMIN', 'SUPER_ADMIN'), startVideoSession);
router.post('/:id/video/join', protect, joinVideoSession);
router.post('/:id/video/reminder', protect, authorize('DOCTOR', 'NURSE', 'CLINIC_ADMIN', 'SUPER_ADMIN'), sendVideoReminder);
router.put('/:id/video/notes', protect, authorize('DOCTOR', 'NURSE', 'CLINIC_ADMIN', 'SUPER_ADMIN'), saveSessionNotes);
router.post('/:id/video/end', protect, authorize('DOCTOR', 'NURSE', 'CLINIC_ADMIN', 'SUPER_ADMIN'), endVideoSession);
router.put('/:id/status', protect, authorize('DOCTOR', 'NURSE', 'CLINIC_ADMIN', 'SUPER_ADMIN'), updateStatus);

module.exports = router;
