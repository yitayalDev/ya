const express = require('express');
const router = express.Router();
const { 
  getCalendars, 
  getCurrentSemester, 
  createCalendar, 
  setCurrentSemester 
} = require('../controllers/calendarController');
const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(getCalendars)
  .post(protect, authorize('SUPER_ADMIN'), createCalendar);

router.get('/current', getCurrentSemester);

router.put('/:id/set-current', protect, authorize('SUPER_ADMIN'), setCurrentSemester);

module.exports = router;
