const { AcademicCalendar } = require('../models/AcademicCalendar');

// @desc    Get all calendar entries
// @route   GET /api/calendar
// @access  Public (Everyone needs to see the calendar)
const getCalendars = async (req, res) => {
  try {
    const calendars = await AcademicCalendar.find({}).sort({ registrationStart: -1 });
    res.json(calendars);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current active semester
// @route   GET /api/calendar/current
// @access  Public
const getCurrentSemester = async (req, res) => {
  try {
    const current = await AcademicCalendar.findOne({ isCurrent: true });
    if (!current) {
      return res.status(404).json({ message: 'No active semester found' });
    }
    res.json(current);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create calendar entry
// @route   POST /api/calendar
// @access  Private (Super Admin)
const createCalendar = async (req, res) => {
  try {
    console.log('--- Calendar Creation Start ---');
    console.log('Data received:', JSON.stringify(req.body, null, 2));
    const calendar = await AcademicCalendar.create(req.body);
    console.log('Calendar created successfully!');
    res.status(201).json(calendar);
  } catch (error) {
    console.error('--- Calendar Creation ERROR ---');
    console.error('Error Message:', error.message);
    if (error.errors) {
      console.error('Validation Errors:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
    res.status(400).json({ message: error.message });
  }
};

// @desc    Set current semester
// @route   PUT /api/calendar/:id/set-current
// @access  Private (Super Admin)
const setCurrentSemester = async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findById(req.params.id);
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar entry not found' });
    }
    calendar.isCurrent = true;
    await calendar.save();
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCalendars,
  getCurrentSemester,
  createCalendar,
  setCurrentSemester,
};
