const express = require('express');
const router = express.Router();
const { 
  getColleges, 
  createCollege, 
  updateCollege, 
  deleteCollege 
} = require('../controllers/collegeController');
const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, getColleges)
  .post(protect, authorize('SUPER_ADMIN'), createCollege);

router
  .route('/:id')
  .put(protect, authorize('SUPER_ADMIN'), updateCollege)
  .delete(protect, authorize('SUPER_ADMIN'), deleteCollege);

module.exports = router;
