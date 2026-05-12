const express = require('express');
const router = express.Router();
const {
  calculateFinalGrade,
  calculateSectionGrades,
  submitSectionGrades,
  departmentApproval,
  bulkDepartmentApproval,
  registrarApproval,
  bulkRegistrarApproval,
  getFinalGrades,
  getFinalGrade,
  getGradeAudit,
  calculateStudentGPA,
  getStudentGrades,
  getBulkGPA,
  getStudentTranscriptData,
} = require('../controllers/finalGradeController');
const { protect, authorize } = require('../middleware/auth');

// POST /api/final-grades/calculate - Calculate final grade for one student
router.post('/calculate', protect, authorize('INSTRUCTOR'), calculateFinalGrade);

// GET /api/final-grades/my-grades - Student's own grades (MUST be before /:id)
router.get('/my-grades', protect, authorize('STUDENT'), getStudentGrades);

// POST /api/final-grades/calculate-section/:sectionId - Auto-calculate all grades in a section
router.post('/calculate-section/:sectionId', protect, authorize('INSTRUCTOR'), calculateSectionGrades);

// POST /api/final-grades/submit-section/:sectionId - Submit all grades for review
router.post('/submit-section/:sectionId', protect, authorize('INSTRUCTOR'), submitSectionGrades);

// PUT /api/final-grades/dept-approval/:id - Department admin approve/reject
router.put('/dept-approval/:id', protect, authorize('DEPARTMENT_ADMIN'), departmentApproval);

// PUT /api/final-grades/bulk-dept-approval - Bulk approve
router.put('/bulk-dept-approval', protect, authorize('DEPARTMENT_ADMIN'), bulkDepartmentApproval);

// PUT /api/final-grades/registrar-approve/:id - Registrar final approval
router.put('/registrar-approve/:id', protect, authorize('REGISTRAR'), registrarApproval);

// PUT /api/final-grades/bulk-registrar-approve - Bulk approve
router.put('/bulk-registrar-approve', protect, authorize('REGISTRAR'), bulkRegistrarApproval);

// GET /api/final-grades/bulk-gpa - Calculate bulk GPA for all students
router.get('/bulk-gpa', protect, authorize('REGISTRAR'), getBulkGPA);

// GET /api/final-grades/gpa/:studentId - Calculate GPA
router.get('/gpa/:studentId', protect, authorize('STUDENT', 'REGISTRAR'), calculateStudentGPA);

// GET /api/final-grades/transcript/:studentId - Get transcript data
router.get('/transcript/:studentId', protect, authorize('REGISTRAR', 'STUDENT'), getStudentTranscriptData);

// GET /api/final-grades - Get list with filters
router.get('/', protect, authorize('INSTRUCTOR', 'DEPARTMENT_ADMIN', 'REGISTRAR', 'STUDENT'), getFinalGrades);

// GET /api/final-grades/:id - Get single final grade
router.get('/:id', protect, authorize('INSTRUCTOR', 'DEPARTMENT_ADMIN', 'REGISTRAR', 'STUDENT'), getFinalGrade);

// GET /api/final-grades/:id/audit - Get audit logs
router.get('/:id/audit', protect, authorize('DEPARTMENT_ADMIN', 'REGISTRAR'), getGradeAudit);

module.exports = router;
