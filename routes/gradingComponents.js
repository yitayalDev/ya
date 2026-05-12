const express = require('express');
const router = express.Router();
const {
  getComponentsByCourse,
  createComponent,
  updateComponent,
  deleteComponent,
  validateStructure,
} = require('../controllers/gradingComponentController');
const { protect, authorize } = require('../middleware/auth');

// GET /api/grading-components/course/:courseId - Get components for a course
router.get('/course/:courseId', protect, authorize('DEPARTMENT_ADMIN', 'INSTRUCTOR'), getComponentsByCourse);

// POST /api/grading-components - Create component (Dept Admin only)
router.post('/', protect, authorize('DEPARTMENT_ADMIN'), createComponent);

// PUT /api/grading-components/:id - Update component
router.put('/:id', protect, authorize('DEPARTMENT_ADMIN'), updateComponent);

// DELETE /api/grading-components/:id - Delete component
router.delete('/:id', protect, authorize('DEPARTMENT_ADMIN'), deleteComponent);

// POST /api/grading-components/validate/:courseId - Validate structure
router.post('/validate/:courseId', protect, authorize('DEPARTMENT_ADMIN', 'INSTRUCTOR'), validateStructure);

module.exports = router;
