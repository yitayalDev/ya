const express = require('express');
const router = express.Router();
const {
  getViolations,
  getViolation,
  createViolation,
  updateViolation,
  getMyViolations,
  getViolationsByStudent,
} = require('../controllers/violationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR'), getViolations)
  .post(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR'), createViolation);

router.get('/my-violations', authorize('STUDENT'), getMyViolations);

router.get('/student/:studentId', authorize('SUPER_ADMIN', 'DEAN_OF_STUDENTS'), getViolationsByStudent);

router.route('/:id')
  .get(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR'), getViolation)
  .put(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR'), updateViolation);

module.exports = router;