const express = require('express');
const router = express.Router();
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  assignStudent,
  removeStudent,
  deleteRoom,
} = require('../controllers/roomController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), getRooms)
  .post(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), createRoom);

router.route('/:id')
  .get(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), getRoom)
  .put(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), updateRoom)
  .delete(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), deleteRoom);

router.route('/:id/assign')
  .post(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), assignStudent);

router.route('/:id/remove')
  .post(authorize('SUPER_ADMIN', 'DORMITORY_ADMIN'), removeStudent);

module.exports = router;