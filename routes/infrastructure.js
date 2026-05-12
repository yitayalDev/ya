const express = require('express');
const router = express.Router();
const {
    getBuildings,
    createBuilding,
    getRoomsByBuilding,
    createRoom
} = require('../controllers/infrastructureController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/buildings', getBuildings);
router.post('/buildings', authorize('SUPER_ADMIN'), createBuilding);
router.get('/rooms/:buildingId', getRoomsByBuilding);
router.post('/rooms', authorize('SUPER_ADMIN'), createRoom);

module.exports = router;
