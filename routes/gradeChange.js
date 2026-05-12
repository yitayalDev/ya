const express = require('express');
const router = express.Router();
const {
  submitGradeChangeRequest,
  submitStudentGradeAppeal,
  getMyGradeChangeRequests,
  getGradeChangeRequests,
  processGradeChangeRequest
} = require('../controllers/gradeChangeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/appeal', authorize('STUDENT'), submitStudentGradeAppeal);
router.get('/my', authorize('STUDENT'), getMyGradeChangeRequests);
router.post('/', authorize('INSTRUCTOR'), submitGradeChangeRequest);
router.get('/', authorize('REGISTRAR', 'SUPER_ADMIN'), getGradeChangeRequests);
router.put('/:id', authorize('REGISTRAR', 'SUPER_ADMIN'), processGradeChangeRequest);

module.exports = router;
