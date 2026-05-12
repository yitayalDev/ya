const express = require('express');
const router = express.Router();
const {
  getOverviewAnalytics,
  getEnrollmentAnalytics,
  getAcademicPerformanceAnalytics,
  getAttendanceAnalytics,
  getInstructorPerformanceAnalytics,
  getDepartmentReports,
  getRegistrarAnalytics,
  getClinicAnalytics,
  getSuperAdminDashboardStats,
  getDeanAnalytics,
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/overview', protect, authorize('SUPER_ADMIN'), getOverviewAnalytics);
router.get('/enrollment', protect, authorize('SUPER_ADMIN'), getEnrollmentAnalytics);
router.get('/academic-performance', protect, authorize('SUPER_ADMIN'), getAcademicPerformanceAnalytics);
router.get('/attendance', protect, authorize('SUPER_ADMIN'), getAttendanceAnalytics);
router.get('/instructor-performance', protect, authorize('SUPER_ADMIN'), getInstructorPerformanceAnalytics);
router.get('/department-reports', protect, authorize('SUPER_ADMIN'), getDepartmentReports);
router.get('/registrar', protect, authorize('REGISTRAR'), getRegistrarAnalytics);
router.get('/clinic', protect, authorize('SUPER_ADMIN'), getClinicAnalytics);
router.get('/super-admin/dashboard', protect, authorize('SUPER_ADMIN'), getSuperAdminDashboardStats);
router.get('/dean', protect, authorize('SUPER_ADMIN', 'DEAN_OF_STUDENTS'), getDeanAnalytics);

module.exports = router;
