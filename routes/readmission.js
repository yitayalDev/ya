const express = require('express');
const router = express.Router();
const {
  submitReadmissionRequest,
  getMyReadmissionRequests,
  getReadmissionRequests,
  processReadmissionRequest
} = require('../controllers/readmissionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('STUDENT'), submitReadmissionRequest);
router.get('/my', authorize('STUDENT'), getMyReadmissionRequests);
router.get('/', authorize('REGISTRAR', 'SUPER_ADMIN'), getReadmissionRequests);
router.put('/:id', authorize('REGISTRAR', 'SUPER_ADMIN'), processReadmissionRequest);

module.exports = router;
