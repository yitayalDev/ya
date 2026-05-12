const ReadmissionRequest = require('../models/ReadmissionRequest');
const Student = require('../models/Student');

// @desc    Submit a readmission request
// @route   POST /api/readmission
// @access  Private (Student)
const submitReadmissionRequest = async (req, res) => {
  const { requestedSemester, requestedYear, reason } = req.body;

  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    if (student.status === 'Active') {
      return res.status(400).json({ message: 'You are already active. Readmission is only for inactive students.' });
    }

    const request = await ReadmissionRequest.create({
      student: student._id,
      requestedSemester,
      requestedYear,
      reason
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get student's own readmission requests
// @route   GET /api/readmission/my
// @access  Private (Student)
const getMyReadmissionRequests = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const requests = await ReadmissionRequest.find({ student: student._id })
      .populate('requestedSemester', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all readmission requests for the registrar
// @route   GET /api/readmission
// @access  Private (Registrar)
const getReadmissionRequests = async (req, res) => {
  try {
    const requests = await ReadmissionRequest.find({})
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('requestedSemester', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Process a readmission request
// @route   PUT /api/readmission/:id
// @access  Private (Registrar)
const processReadmissionRequest = async (req, res) => {
  const { status, registrarComment } = req.body;

  try {
    const request = await ReadmissionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = status;
    request.registrarComment = registrarComment;
    request.processedBy = req.user._id;
    request.processedAt = Date.now();

    if (status === 'APPROVED') {
      const student = await Student.findById(request.student);
      student.status = 'Active';
      student.academicYear = request.requestedYear;
      student.currentSemester = request.requestedSemester;
      
      student.statusHistory.push({
        status: 'Active',
        reason: 'Readmission Approved: ' + registrarComment,
        changedBy: req.user._id
      });

      await student.save();
    }

    await request.save();
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  submitReadmissionRequest,
  getMyReadmissionRequests,
  getReadmissionRequests,
  processReadmissionRequest
};
