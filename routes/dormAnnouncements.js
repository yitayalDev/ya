const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getMyAnnouncements,
} = require('../controllers/dormAnnouncementController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('DORMITORY_ADMIN', 'PROCTOR', 'SUPER_ADMIN'), createAnnouncement);
router.get('/my-announcements', authorize('STUDENT'), getMyAnnouncements);

module.exports = router;
