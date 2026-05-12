const express = require('express');
const router = express.Router();
const { performDegreeAudit } = require('../controllers/degreeAuditController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('REGISTRAR', 'SUPER_ADMIN'));

router.get('/:studentId', performDegreeAudit);

module.exports = router;
