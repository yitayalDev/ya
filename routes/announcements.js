const express = require('express');
const router = express.Router();
const {
    createAnnouncement,
    getMyAnnouncements,
    getAllAnnouncements,
    deleteAnnouncement
} = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/my', getMyAnnouncements);

router.post('/', authorize('REGISTRAR', 'SUPER_ADMIN'), createAnnouncement);
router.get('/', authorize('REGISTRAR', 'SUPER_ADMIN'), getAllAnnouncements);
router.delete('/:id', authorize('REGISTRAR', 'SUPER_ADMIN'), deleteAnnouncement);

module.exports = router;
