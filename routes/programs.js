const express = require('express');
const router = express.Router();
const { getPrograms, createProgram } = require('../controllers/programController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getPrograms);
router.post('/', authorize('COLLEGE_ADMIN', 'SUPER_ADMIN'), createProgram);

module.exports = router;
