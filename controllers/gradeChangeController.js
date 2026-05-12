const GradeChangeRequest = require('../models/GradeChangeRequest');
const FinalGrade = require('../models/FinalGrade');
const Student = require('../models/Student');

// @desc    Submit a grade change request
// @route   POST /api/grade-change
// @access  Private (Instructor)
const submitGradeChangeRequest = async (req, res) => {
  const { originalGradeId, newScore, newGrade, reason } = req.body;

  try {
    const originalGrade = await FinalGrade.findById(originalGradeId);
    if (!originalGrade) {
      return res.status(404).json({ message: 'Original grade not found' });
    }

    // Ensure only the instructor who gave the grade can request a change
    if (originalGrade.submittedBy && originalGrade.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to request change for this grade' });
    }

    const request = await GradeChangeRequest.create({
      originalGrade: originalGradeId,
      student: originalGrade.student,
      course: originalGrade.course,
      oldScore: originalGrade.totalScore,
      oldGrade: originalGrade.gradeLetter,
      newScore,
      newGrade,
      reason,
      requestedBy: req.user._id
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit a grade appeal as a student
// @route   POST /api/grade-change/appeal
// @access  Private (Student)
const submitStudentGradeAppeal = async (req, res) => {
  const { courseCode, requestedGrade, reason } = req.body;
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    // Try to find course and existing grade
    const Course = require('../models/Course');
    const course = await Course.findOne({ code: new RegExp('^' + courseCode + '$', 'i') });
    
    let originalGrade = null;
    let oldScore = null;
    let oldGrade = null;

    if (course) {
      originalGrade = await FinalGrade.findOne({ student: student._id, course: course._id });
      if (originalGrade) {
        oldScore = originalGrade.totalScore;
        oldGrade = originalGrade.gradeLetter;
      }
    }

    const request = await GradeChangeRequest.create({
      type: 'APPEAL',
      student: student._id,
      course: course ? course._id : undefined,
      originalGrade: originalGrade ? originalGrade._id : undefined,
      oldScore,
      oldGrade,
      newGrade: requestedGrade,
      newScore: 0, // Placeholder as student only specifies grade letter usually
      reason: `[Student Appeal] ${reason}`,
      requestedBy: req.user._id
    });
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my own grade appeal requests (student)
// @route   GET /api/grade-change/my
// @access  Private (Student)
const getMyGradeChangeRequests = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.json([]);
    const requests = await GradeChangeRequest.find({ student: student._id })
      .populate('course', 'code title')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all grade change requests
// @route   GET /api/grade-change
// @access  Private (Registrar)
const getGradeChangeRequests = async (req, res) => {
  try {
    const requests = await GradeChangeRequest.find({})
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('course', 'code title')
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Process a grade change request
// @route   PUT /api/grade-change/:id
// @access  Private (Registrar)
const processGradeChangeRequest = async (req, res) => {
  const { status, registrarComment } = req.body;

  try {
    const request = await GradeChangeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = status;
    request.registrarComment = registrarComment;
    request.approvedBy = req.user._id;
    request.processedAt = Date.now();

    if (status === 'APPROVED' && request.originalGrade) {
      const grade = await FinalGrade.findById(request.originalGrade);
      if (grade) {
        if (request.newScore) grade.totalScore = request.newScore;
        grade.gradeLetter = request.newGrade;

        // Recalculate GPA point based on the new grade letter
        const gpaScale = {
          'A+': 4.0, 'A': 4.0, 'A-': 3.7,
          'B+': 3.3, 'B': 3.0, 'B-': 2.7,
          'C+': 2.3, 'C': 2.0,
          'D': 1.0,
          'F': 0.0
        };
        grade.gpaPoint = gpaScale[request.newGrade] ?? 0.0;

        await grade.save();
      }
    }

    await request.save();
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  submitGradeChangeRequest,
  submitStudentGradeAppeal,
  getMyGradeChangeRequests,
  getGradeChangeRequests,
  processGradeChangeRequest
};
