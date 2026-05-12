const express = require('express');
const router = express.Router();
const { getStaff, createStaff, updateStaff, deleteStaff } = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, getStaff)
  .post(protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'), createStaff);

router
  .route('/:id')
  .put(protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'), updateStaff)
  .delete(protect, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN'), deleteStaff);

module.exports = router;
