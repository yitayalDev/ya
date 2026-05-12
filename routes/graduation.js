const express = require('express');
const router = express.Router();
const {
  getEligibleStudents,
  finalizeGraduation
} = require('../controllers/graduationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('REGISTRAR', 'SUPER_ADMIN'));

router.get('/eligible', getEligibleStudents);
router.post('/finalize', finalizeGraduation);

module.exports = router;
