const express = require('express');
const router = express.Router();
const {
    getSystemConfig,
    updateSystemConfig,
    triggerBackup,
    getSystemHealth,
    getStorageStats,
    getPublicConfig
} = require('../controllers/systemController');
const { protect, authorize } = require('../middleware/auth');

router.get('/public-config', getPublicConfig);

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/config', getSystemConfig);
router.put('/config', updateSystemConfig);
router.post('/backup', triggerBackup);
router.get('/health', getSystemHealth);
router.get('/storage', getStorageStats);

module.exports = router;
