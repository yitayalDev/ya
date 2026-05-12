const express = require('express');
const router = express.Router();
const { getUsers, createUser, getAdmins, createAdmin, getMe, deleteUser, impersonateUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Order matters: specific routes before parameterized routes
router.get('/me', protect, getMe);

router.post('/impersonate/:id', protect, authorize('SUPER_ADMIN'), impersonateUser);

router
  .route('/admins')
  .get(protect, authorize('SUPER_ADMIN'), getAdmins)
  .post(protect, authorize('SUPER_ADMIN'), createAdmin);

router
  .route('/:id')
  .delete(protect, authorize('SUPER_ADMIN'), deleteUser);

router
  .route('/')
  .get(protect, getUsers)
  .post(protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'), createUser);

module.exports = router;
