const express = require('express');
const router = express.Router();
const {
  // Academic Year
  getAcademicYears,
  getAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  getAcademicYearSemesters,

  // Semester
  getSemesters,
  getSemester,
  createSemester,
  updateSemester,
  deleteSemester,
  changeSemesterStatus,
  getCurrentSemester,
  checkOperationsAllowed,
} = require('../controllers/academicCalendarController');
const { protect, authorize } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');

// Academic Year Routes
router
  .route('/academic-years')
  .get(protect, getAcademicYears)
  .post(protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('ACADEMIC_CALENDAR', 'Create Academic Year'), createAcademicYear);

router
  .route('/academic-years/:id')
  .get(protect, getAcademicYear)
  .put(protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('ACADEMIC_CALENDAR', 'Update Academic Year'), updateAcademicYear)
  .delete(protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('ACADEMIC_CALENDAR', 'Delete Academic Year'), deleteAcademicYear);

router.get('/academic-years/:id/semesters', protect, getAcademicYearSemesters);

// Current Semester & Operations (Move ABOVE /semesters/:id)
router.get('/semesters/current', protect, getCurrentSemester);
router.get('/semesters/check-operations', protect, checkOperationsAllowed);

// Semester Routes
router
  .route('/semesters')
  .get(protect, getSemesters)
  .post(protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('ACADEMIC_CALENDAR', 'Create Semester'), createSemester);

router
  .route('/semesters/:id')
  .get(protect, getSemester)
  .put(protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('ACADEMIC_CALENDAR', 'Update Semester'), updateSemester)
  .delete(protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('ACADEMIC_CALENDAR', 'Delete Semester'), deleteSemester);

router.put('/semesters/:id/status', protect, authorize('SUPER_ADMIN', 'REGISTRAR'), auditLogger('ACADEMIC_CALENDAR', 'Change Semester Status'), changeSemesterStatus);

module.exports = router;