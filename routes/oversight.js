const express = require('express');
const router = express.Router();
const { getAcademicOversight } = require('../controllers/oversightController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('COLLEGE_ADMIN', 'SUPER_ADMIN'));

router.get('/', getAcademicOversight);

module.exports = router;
