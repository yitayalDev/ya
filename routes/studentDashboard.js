const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
    getStudentSummary, 
    getStudentProfile, 
    getMyEnrollments, 
    getMyAttendanceHistory,
    getSectionMaterials
} = require('../controllers/studentDashboardController');
const { getSectionMaterials: getMaterials } = require('../controllers/materialController');
const { scanAttendance } = require('../controllers/academicAttendanceController');

console.log('>>> STUDENT DASHBOARD ROUTER INITIALIZED <<<');

router.use(protect);
router.use(authorize('STUDENT', 'SUPER_ADMIN'));

// Order: specific to generic
router.get('/me', (req, res, next) => {
    console.log(`[ROUTE MATCH] /api/student/me hit by ${req.user.email}`);
    next();
}, getStudentProfile);

router.get('/my-enrollments', getMyEnrollments);
router.get('/attendance/history', getMyAttendanceHistory);
router.get('/dashboard/summary', getStudentSummary);
router.get('/materials/section/:sectionId', getMaterials);
router.post('/attendance/scan', scanAttendance);

module.exports = router;
