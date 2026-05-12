const Violation = require('../models/Violation');
const Dormitory = require('../models/Dormitory');

// @desc    Get violations for a dormitory
// @route   GET /api/violations
// @access  Private/Dormitory Admin
const getViolations = async (req, res) => {
  try {
    let dormitory;
    if (req.user.role === 'DORMITORY_ADMIN') {
      dormitory = await Dormitory.findOne({ dormitoryAdmin: req.user.id });
    } else if (req.user.role === 'PROCTOR') {
      // Find dorm by campus or assigned building
      dormitory = await Dormitory.findOne({ campus: req.user.campus });
      
      // If still not found, try to find any dormitory in the same campus
      if (!dormitory && req.user.campus) {
          dormitory = await Dormitory.findOne({ campus: req.user.campus });
      }
    }

    if (!dormitory) {
      // If no specific dorm found, return empty list instead of 404 for better UX
      return res.json([]);
    }

    const { status, severity, violationType } = req.query;
    const filter = { dormitory: dormitory._id };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (violationType) filter.violationType = violationType;

    const violations = await Violation.find(filter)
      .populate({
        path: 'student',
        select: 'name email',
      })
      .populate('room', 'roomNumber')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Since 'studentId' is in the Student model, not User model, we need a manual merge or nested population
    // But for now, let's just make sure we return the list.
    res.json(violations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create violation report
// @route   POST /api/violations
// @access  Private/Dormitory Admin/Proctor
const createViolation = async (req, res) => {
  try {
    const { studentId, roomId, violationType, description, severity, evidence, dormitoryId } = req.body;

    let targetDormitoryId = dormitoryId;

    // If no dormitoryId provided, try to find one for the admin
    if (!targetDormitoryId && req.user.role === 'DORMITORY_ADMIN') {
      const dormitory = await Dormitory.findOne({ dormitoryAdmin: req.user.id });
      if (dormitory) targetDormitoryId = dormitory._id;
    }

    if (!targetDormitoryId) {
      return res.status(400).json({ message: 'Dormitory ID is required' });
    }

    const violation = await Violation.create({
      student: studentId,
      dormitory: targetDormitoryId,
      room: roomId,
      violationType,
      description,
      severity: severity || 'MINOR',
      evidence,
      reportedBy: req.user.id,
    });

    const populatedViolation = await Violation.findById(violation._id)
      .populate('student', 'name email studentId')
      .populate('room', 'roomNumber');

    res.status(201).json(populatedViolation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update violation status
// @route   PUT /api/violations/:id
// @access  Private/Dormitory Admin
const updateViolation = async (req, res) => {
  try {
    const { status, responseNotes } = req.body;

    const violation = await Violation.findById(req.params.id);
    if (!violation) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    if (status) {
      violation.status = status;
      if (status === 'RESOLVED') {
        violation.resolvedBy = req.user.id;
        violation.resolvedDate = new Date();
      }
    }
    if (responseNotes) {
      violation.responseNotes = responseNotes;
    }

    await violation.save();

    const updatedViolation = await Violation.findById(violation._id)
      .populate('student', 'name email studentId')
      .populate('room', 'roomNumber')
      .populate('resolvedBy', 'name');

    res.json(updatedViolation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single violation
// @route   GET /api/violations/:id
// @access  Private/Dormitory Admin
const getViolation = async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id)
      .populate('student', 'name email studentId')
      .populate('dormitory', 'name')
      .populate('room', 'roomNumber')
      .populate('resolvedBy', 'name');

    if (!violation) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    res.json(violation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current student's violations
// @route   GET /api/violations/my-violations
// @access  Private/Student
const getMyViolations = async (req, res) => {
  try {
    const violations = await Violation.find({ student: req.user.id })
      .populate('dormitory', 'name')
      .populate('room', 'roomNumber')
      .populate('reportedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(violations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get violations for a specific student (For Dean/Super Admin)
// @route   GET /api/violations/student/:studentId
// @access  Private/Dean/Super Admin
const getViolationsByStudent = async (req, res) => {
  try {
    const violations = await Violation.find({ student: req.params.studentId })
      .populate('dormitory', 'name')
      .populate('room', 'roomNumber')
      .populate('reportedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(violations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getViolations,
  getViolation,
  createViolation,
  updateViolation,
  getMyViolations,
  getViolationsByStudent,
};