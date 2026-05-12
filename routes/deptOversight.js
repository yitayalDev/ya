const express = require('express');
const router = express.Router();
const { getDeptOversight } = require('../controllers/deptOversightController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('DEPARTMENT_ADMIN', 'SUPER_ADMIN'));

router.get('/', getDeptOversight);

module.exports = router;
