const express = require('express');
const router = express.Router();
const { autoEnroll, getStudentEnrollments, updateEnrollmentSection, manualEnroll, selfEnroll } = require('../controllers/enrollmentController');
const { protect, authorize } = require('../middleware/auth');

router.post('/auto-enroll', protect, authorize('REGISTRAR'), autoEnroll);
router.post('/manual', protect, authorize('REGISTRAR'), manualEnroll);
router.post('/self-enroll', protect, authorize('STUDENT'), selfEnroll);
router.get('/student/:studentId/semester/:semesterId', protect, authorize('REGISTRAR'), getStudentEnrollments);
router.put('/:id/section', protect, authorize('REGISTRAR'), updateEnrollmentSection);

module.exports = router;
