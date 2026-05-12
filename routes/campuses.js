const express = require('express');
const router = express.Router();
const {
  getCampuses,
  getCampus,
  createCampus,
  updateCampus,
  deleteCampus,
  toggleCampusStatus,
  getCampusStats,
  transferStudent,
  transferStaff,
  getCrossCampusStats,
  getStudentsByCampus,
  getStaffByCampus,
  getTransferLogs,
} = require('../controllers/campusController');
const { protect, authorize } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');

// Specific routes first (before /:id)
router.get('/cross-campus/stats', protect, authorize('SUPER_ADMIN'), getCrossCampusStats);

router
  .route('/')
  .get(protect, getCampuses)
  .post(protect, authorize('SUPER_ADMIN'), createCampus);

router.get('/:id/stats', protect, getCampusStats);

// New routes for getting students/staff by campus
router.get('/:id/students', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), getStudentsByCampus);
router.get('/:id/staff', protect, authorize('SUPER_ADMIN'), getStaffByCampus);

router
  .route('/:id')
  .get(protect, getCampus)
  .put(protect, authorize('SUPER_ADMIN'), updateCampus)
  .delete(protect, authorize('SUPER_ADMIN'), deleteCampus);

router.put('/:id/toggle-status', protect, authorize('SUPER_ADMIN'), toggleCampusStatus);

// Transfer endpoints
router.get('/transfers/history', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), getTransferLogs);
router.post('/transfer-student', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('CAMPUS_TRANSFER', 'Student Transfer'), transferStudent);
router.post('/transfer-staff', protect, authorize('SUPER_ADMIN'), auditLogger('CAMPUS_TRANSFER', 'Staff Transfer'), transferStaff);

module.exports = router;
