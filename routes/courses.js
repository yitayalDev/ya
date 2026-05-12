const express = require('express');
const router = express.Router();
const {
  getCourses,
  createCourse,
  updateCourse,
  toggleCourseStatus,
  deleteCourse,
  getCourseAnalytics,
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, getCourses)
  .post(protect, authorize('COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), createCourse);

router
  .route('/:id')
  .put(protect, authorize('COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), updateCourse)
  .delete(protect, authorize('COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), deleteCourse);

router.put('/:id/toggle-status', protect, authorize('COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), toggleCourseStatus);
router.get('/:id/analytics', protect, authorize('COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), getCourseAnalytics);

module.exports = router;
