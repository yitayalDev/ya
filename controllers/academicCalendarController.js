const mongoose = require('mongoose');
const { AcademicYear, Semester, AcademicCalendar } = require('../models/AcademicCalendar');
const Section = require('../models/Section');
const RegistrationWindow = require('../models/RegistrationWindow');

// @desc    Get all academic years
// @route   GET /api/academic-years
// @access  Private
const getAcademicYears = async (req, res) => {
  try {
    const academicYears = await AcademicYear.find({})
      .sort({ createdAt: -1 });

    res.json(academicYears);
  } catch (error) {
    console.error('getAcademicYears error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single academic year
// @route   GET /api/academic-years/:id
// @access  Private
const getAcademicYear = async (req, res) => {
  try {
    const academicYear = await AcademicYear.findById(req.params.id);

    if (!academicYear) {
      return res.status(404).json({ message: 'Academic year not found' });
    }

    res.json(academicYear);
  } catch (error) {
    console.error('getAcademicYear error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create academic year
// @route   POST /api/academic-years
// @access  Private/Super Admin
const createAcademicYear = async (req, res) => {
  const { name, startDate, endDate, description } = req.body;

  try {
    const academicYearExists = await AcademicYear.findOne({ name });

    if (academicYearExists) {
      return res.status(400).json({ message: 'Academic year already exists' });
    }

    // Validate date range
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const academicYear = await AcademicYear.create({
      name,
      startDate,
      endDate,
      description,
    });

    res.status(201).json(academicYear);
  } catch (error) {
    console.error('createAcademicYear error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update academic year
// @route   PUT /api/academic-years/:id
// @access  Private/Super Admin
const updateAcademicYear = async (req, res) => {
  try {
    const academicYear = await AcademicYear.findById(req.params.id);

    if (!academicYear) {
      return res.status(404).json({ message: 'Academic year not found' });
    }

    const { name, startDate, endDate, description, status } = req.body;

    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    academicYear.name = name || academicYear.name;
    academicYear.startDate = startDate || academicYear.startDate;
    academicYear.endDate = endDate || academicYear.endDate;
    academicYear.description = description || academicYear.description;
    academicYear.status = status || academicYear.status;

    await academicYear.save();

    res.json(academicYear);
  } catch (error) {
    console.error('updateAcademicYear error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete academic year
// @route   DELETE /api/academic-years/:id
// @access  Private/Super Admin
const deleteAcademicYear = async (req, res) => {
  try {
    const academicYear = await AcademicYear.findById(req.params.id);

    if (!academicYear) {
      return res.status(404).json({ message: 'Academic year not found' });
    }

    // Check if academic year has semesters
    const semesters = await Semester.find({ academicYear: academicYear._id });
    
    if (semesters.length > 0) {
      // Check if all semesters are empty and can be safely removed
      for (const semester of semesters) {
        const sectionsCount = await Section.countDocuments({ semester: semester._id });
        if (sectionsCount > 0) {
          return res.status(400).json({
            message: `Cannot delete academic year. ${semester.name} has active course sections.`
          });
        }
      }
      
      // All semesters are empty, delete them first
      await Semester.deleteMany({ academicYear: academicYear._id });
    }

    await AcademicYear.findByIdAndDelete(req.params.id);
    res.json({ message: 'Academic year and its empty semesters deleted successfully' });
  } catch (error) {
    console.error('deleteAcademicYear error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get semesters for an academic year
// @route   GET /api/academic-years/:id/semesters
// @access  Private
const getAcademicYearSemesters = async (req, res) => {
  try {
    const semesters = await Semester.find({ academicYear: req.params.id })
      .populate('academicYear', 'name')
      .sort({ startDate: 1 });

    res.json(semesters);
  } catch (error) {
    console.error('getAcademicYearSemesters error:', error);
    res.status(500).json({ message: error.message });
  }
};

// SEMESTER MANAGEMENT

// @desc    Get all semesters
// @route   GET /api/semesters
// @access  Private
const getSemesters = async (req, res) => {
  try {
    const { academicYear, status } = req.query;
    const filter = {};

    if (academicYear) filter.academicYear = academicYear;
    if (status) filter.status = status;

    const semesters = await Semester.find(filter)
      .populate('academicYear', 'name')
      .sort({ startDate: 1 });

    res.json(semesters);
  } catch (error) {
    console.error('getSemesters error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single semester
// @route   GET /api/semesters/:id
// @access  Private
const getSemester = async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id)
      .populate('academicYear', 'name startDate endDate');

    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    res.json(semester);
  } catch (error) {
    console.error('getSemester error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create semester
// @route   POST /api/semesters
// @access  Private/Super Admin
const createSemester = async (req, res) => {
  const {
    name,
    academicYear,
    startDate,
    endDate,
    registrationStart,
    registrationEnd,
    addDropDeadline,
    examStart,
    examEnd,
    description
  } = req.body;

  try {
    // Validate academic year exists
    const yearExists = await AcademicYear.findById(academicYear);
    if (!yearExists) {
      return res.status(400).json({ message: 'Academic year not found' });
    }

    // Validate date ranges
    const semesterStart = new Date(startDate);
    const semesterEnd = new Date(endDate);
    const yearStart = new Date(yearExists.startDate);
    const yearEnd = new Date(yearExists.endDate);

    if (semesterStart >= semesterEnd) {
      return res.status(400).json({ message: 'Semester end date must be after start date' });
    }

    if (semesterStart < yearStart || semesterEnd > yearEnd) {
      return res.status(400).json({ message: 'Semester dates must be within academic year range' });
    }

    const semester = await Semester.create({
      name,
      academicYear,
      startDate,
      endDate,
      registrationStart,
      registrationEnd,
      addDropDeadline,
      examStart,
      examEnd,
      description,
    });

    const populatedSemester = await Semester.findById(semester._id)
      .populate('academicYear', 'name');

    res.status(201).json(populatedSemester);
  } catch (error) {
    console.error('createSemester error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Semester code already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update semester
// @route   PUT /api/semesters/:id
// @access  Private/Super Admin
const updateSemester = async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id);

    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    // Prevent updates if semester is locked
    if (semester.status === 'Locked') {
      return res.status(400).json({ message: 'Cannot update a locked semester' });
    }

    const updates = req.body;

    // Validate date ranges if dates are being updated
    if (updates.startDate && updates.endDate) {
      if (new Date(updates.startDate) >= new Date(updates.endDate)) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
    }

    Object.assign(semester, updates);
    await semester.save();

    const updatedSemester = await Semester.findById(semester._id)
      .populate('academicYear', 'name');

    res.json(updatedSemester);
  } catch (error) {
    console.error('updateSemester error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete semester
// @route   DELETE /api/semesters/:id
// @access  Private/Super Admin
const deleteSemester = async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id);

    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    // Check for dependent data (Sections are the primary blocker)
    const sectionsCount = await Section.countDocuments({ semester: semester._id });
    if (sectionsCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete semester. There are course sections already scheduled for this term.'
      });
    }

    // Check for registration windows
    const regWindowsCount = await RegistrationWindow.countDocuments({ semester: semester._id });
    if (regWindowsCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete semester. There are registration windows configured for this term.'
      });
    }

    await Semester.findByIdAndDelete(req.params.id);
    res.json({ message: 'Semester deleted successfully' });
  } catch (error) {
    console.error('deleteSemester error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change semester status
// @route   PUT /api/semesters/:id/status
// @access  Private/Super Admin
const changeSemesterStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Upcoming', 'Active', 'Closed', 'Locked'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const semester = await Semester.findById(req.params.id);

    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    // Validate status transitions
    const currentStatus = semester.status;
    const allowedTransitions = {
      'Upcoming': ['Active'],
      'Active': ['Closed'],
      'Closed': ['Locked', 'Active'], // Allow Reopening
      'Locked': ['Closed', 'Active']  // Allow Unlocking
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from ${currentStatus} to ${status}`
      });
    }

    // If activating, ensure no other semester is current
    if (status === 'Active') {
      await Semester.updateMany(
        { _id: { $ne: semester._id } },
        { isCurrent: false }
      );
      semester.isCurrent = true;
    } else if (currentStatus === 'Active') {
      semester.isCurrent = false;
    }

    semester.status = status;
    await semester.save();

    const updatedSemester = await Semester.findById(semester._id)
      .populate('academicYear', 'name');

    res.json({
      message: `Semester ${semester.name} status changed to ${status}`,
      semester: updatedSemester
    });
  } catch (error) {
    console.error('changeSemesterStatus error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current active semester
// @route   GET /api/semesters/current
// @access  Private
const getCurrentSemester = async (req, res) => {
  try {
    const currentSemester = await Semester.findOne({ isCurrent: true })
      .populate('academicYear', 'name startDate endDate');

    if (!currentSemester) {
      return res.status(200).json(null); // Return null instead of 404 to prevent frontend errors
    }

    res.json(currentSemester);
  } catch (error) {
    console.error('getCurrentSemester error:', error);
    // Return null on error to prevent crashes (handles missing collections, etc.)
    res.status(200).json(null);
  }
};

// @desc    Check if operations are allowed for current semester
// @route   GET /api/semesters/check-operations
// @access  Private
const checkOperationsAllowed = async (req, res) => {
  try {
    const currentSemester = await Semester.findOne({ isCurrent: true });

    if (!currentSemester) {
      return res.json({
        enrollment: false,
        attendance: false,
        grading: false,
        message: 'No active semester configured'
      });
    }

    const status = currentSemester.status;
    const operationsAllowed = {
      enrollment: status === 'Active',
      attendance: status === 'Active',
      grading: ['Active', 'Closed'].includes(status),
      message: getStatusMessage(status, currentSemester.name)
    };

    res.json(operationsAllowed);
  } catch (error) {
    console.error('checkOperationsAllowed error:', error);
    // Return default values on error (handles missing collections, etc.)
    res.status(200).json({
      enrollment: false,
      attendance: false,
      grading: false,
      message: 'Unable to check semester status - database may be initializing'
    });
  }
};

function getStatusMessage(status, semesterName) {
  switch (status) {
    case 'Upcoming':
      return `${semesterName} is upcoming. Academic operations will be available soon.`;
    case 'Active':
      return `${semesterName} is active. All academic operations are enabled.`;
    case 'Closed':
      return `${semesterName} is closed. Grading is still allowed but enrollment and attendance are disabled.`;
    case 'Locked':
      return `${semesterName} is locked. No further changes are allowed.`;
    default:
      return `Unknown semester status.`;
  }
}

module.exports = {
  // Academic Year
  getAcademicYears,
  getAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  getAcademicYearSemesters,

  // Semester
  getSemesters,
  getSemester,
  createSemester,
  updateSemester,
  deleteSemester,
  changeSemesterStatus,
  getCurrentSemester,
  checkOperationsAllowed,
};