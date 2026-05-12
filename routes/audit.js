const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('REGISTRAR', 'SUPER_ADMIN'));

router.get('/', getAuditLogs);

module.exports = router;
