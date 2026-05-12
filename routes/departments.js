const express = require('express');
const router = express.Router();
const {
  getDepartments,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
  assignDepartmentAdmin,
  deleteDepartment,
  getDepartmentAnalytics,
  getCollegeOverview,
} = require('../controllers/departmentController');
const { getDeptStats } = require('../controllers/deptStatsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/college-overview', protect, authorize('COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'), getCollegeOverview);
router.get('/stats', protect, authorize('DEPARTMENT_ADMIN'), getDeptStats);

router
  .route('/')
  .get(protect, getDepartments)
  .post(protect, authorize('COLLEGE_ADMIN'), createDepartment);

router
  .route('/:id')
  .put(protect, authorize('COLLEGE_ADMIN'), updateDepartment)
  .delete(protect, authorize('COLLEGE_ADMIN'), deleteDepartment);

router.put('/:id/toggle-status', protect, authorize('COLLEGE_ADMIN'), toggleDepartmentStatus);
router.put('/:id/assign-admin', protect, authorize('COLLEGE_ADMIN'), assignDepartmentAdmin);
router.get('/:id/analytics', protect, authorize('COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'), getDepartmentAnalytics);

module.exports = router;
