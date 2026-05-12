const express = require('express');
const router = express.Router();
const { broadcastAlert, getAlertHistory } = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.post('/broadcast', broadcastAlert);
router.get('/', getAlertHistory);

module.exports = router;
