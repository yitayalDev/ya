const express = require('express');
const router = express.Router();
const {
  getDormRequests,
  getDormRequest,
  createDormRequest,
  updateDormRequest,
  getProctorRequests,
  getMyRequests,
} = require('../controllers/dormRequestController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), getDormRequests)
  .post(authorize('STUDENT', 'DORMITORY_ADMIN', 'SUPER_ADMIN', 'PROCTOR'), createDormRequest);

router.get('/proctor', authorize('PROCTOR'), getProctorRequests);
router.get('/my-requests', authorize('STUDENT'), getMyRequests);

router.route('/:id')
  .get(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN', 'STUDENT', 'PROCTOR'), getDormRequest)
  .put(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR'), updateDormRequest);

module.exports = router;