const express = require('express');
const router = express.Router();
const { getSections, createSection, createBulkSections, updateSection, deleteSection } = require('../controllers/sectionController');
const { protect, authorize } = require('../middleware/auth');

router.post('/bulk', protect, authorize('DEPARTMENT_ADMIN'), createBulkSections);

router
  .route('/:id')
  .put(protect, authorize('DEPARTMENT_ADMIN'), updateSection)
  .delete(protect, authorize('DEPARTMENT_ADMIN'), deleteSection);

router
  .route('/')
  .get(protect, getSections)
  .post(protect, authorize('DEPARTMENT_ADMIN'), createSection);

module.exports = router;
