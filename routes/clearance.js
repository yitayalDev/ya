const express = require('express');
const router = express.Router();
const {
  applyForClearance,
  getMyClearance,
  updateStepStatus,
  getClearanceByStudentId,
  getPendingDeanClearances,
  downloadCertificate
} = require('../controllers/clearanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/apply', applyForClearance);
router.get('/my', getMyClearance);
router.get('/:id/certificate', downloadCertificate);
router.put('/:id/step', updateStepStatus);
router.get('/pending/dean', authorize('SUPER_ADMIN', 'DEAN_OF_STUDENTS'), getPendingDeanClearances);

router.get('/student/:studentId', authorize('SUPER_ADMIN', 'REGISTRAR', 'DEAN_OF_STUDENTS', 'PROCTOR', 'DORMITORY_ADMIN', 'LIBRARY_ADMIN', 'DEPARTMENT_ADMIN'), getClearanceByStudentId);

module.exports = router;
