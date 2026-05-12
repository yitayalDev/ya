const RegistrationWindow = require('../models/RegistrationWindow');

// @desc    Get all registration windows for a semester
// @route   GET /api/registration-windows/:semesterId
// @access  Private
const getRegistrationWindows = async (req, res) => {
  try {
    const windows = await RegistrationWindow.find({ semester: req.params.semesterId })
      .sort({ startDate: 1 });
    res.json(windows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a registration window
// @route   POST /api/registration-windows
// @access  Private (Registrar)
const createRegistrationWindow = async (req, res) => {
  const { semester, academicYear, startDate, endDate } = req.body;

  try {
    const window = await RegistrationWindow.create({
      semester,
      academicYear,
      startDate,
      endDate
    });
    res.status(201).json(window);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a registration window
// @route   PUT /api/registration-windows/:id
// @access  Private (Registrar)
const updateRegistrationWindow = async (req, res) => {
  try {
    const window = await RegistrationWindow.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(window);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a registration window
// @route   DELETE /api/registration-windows/:id
// @access  Private (Registrar)
const deleteRegistrationWindow = async (req, res) => {
  try {
    await RegistrationWindow.findByIdAndDelete(req.params.id);
    res.json({ message: 'Registration window deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getRegistrationWindows,
  createRegistrationWindow,
  updateRegistrationWindow,
  deleteRegistrationWindow
};
