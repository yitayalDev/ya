const express = require('express');
const router = express.Router();
const {
  getGradesBySection,
  saveGrade,
  getGrade,
  bulkSaveGrades,
} = require('../controllers/gradeController');
const { protect, authorize } = require('../middleware/auth');

// GET /api/grades/section/:sectionId - Get grades for a section
router.get('/section/:sectionId', protect, authorize('INSTRUCTOR', 'DEPARTMENT_ADMIN'), getGradesBySection);

// GET /api/grades/:gradeId - Get single grade
router.get('/:gradeId', protect, authorize('INSTRUCTOR', 'DEPARTMENT_ADMIN'), getGrade);

// POST /api/grades/entry - Save/update a grade (draft)
router.post('/entry', protect, authorize('INSTRUCTOR'), saveGrade);

// POST /api/grades/bulk - Bulk save grades
router.post('/bulk', protect, authorize('INSTRUCTOR'), bulkSaveGrades);

module.exports = router;
