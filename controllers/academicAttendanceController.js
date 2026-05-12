const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const Section = require('../models/Section');
const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');

// @desc    Start an attendance session for a section
// @route   POST /api/instructor/attendance/start
// @access  Private (Instructor)
const startAttendanceSession = async (req, res) => {
  try {
    const { sectionId, durationInMinutes = 60, durationMinutes } = req.body;
    // Support both durationInMinutes and durationMinutes for frontend compatibility
    const finalDuration = durationMinutes || durationInMinutes || 60;

    // Verify section exists and instructor is assigned to it
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (section.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to start session for this section' });
    }

    // Check if there's already an active session for this section
    const activeSession = await AttendanceSession.findOne({
      section: sectionId,
      isActive: true,
      endTime: { $gt: new Date() }
    });

    if (activeSession) {
      return res.status(200).json({
        message: 'An active session already exists for this section',
        session: {
          sessionId: activeSession.sessionId,
          qrData: activeSession.getQrData(),
          startTime: activeSession.startTime,
          endTime: activeSession.endTime,
          isActive: activeSession.isActive
        }
      });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + finalDuration * 60000);

    const session = await AttendanceSession.create({
      section: sectionId,
      instructor: req.user._id,
      course: section.course,
      startTime,
      endTime,
      isActive: true
    });

    // Generate QR data using the model method
    const qrData = session.getQrData();

    res.status(201).json({
      message: 'Attendance session started successfully',
      session: {
        sessionId: session.sessionId,
        qrData: qrData,
        startTime: session.startTime,
        endTime: session.endTime,
        isActive: session.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    End an attendance session manually
// @route   POST /api/instructor/attendance/end/:sessionId
// @access  Private (Instructor)
const endAttendanceSession = async (req, res) => {
  try {
    const session = await AttendanceSession.findOne({ sessionId: req.params.sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to end this session' });
    }

    session.isActive = false;
    session.endTime = new Date();
    await session.save();

    res.json({ message: 'Attendance session ended successfully', session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all attendance sessions for a section
// @route   GET /api/instructor/attendance/section/:sectionId
// @access  Private (Instructor)
const getSectionAttendanceSessions = async (req, res) => {
  try {
    const { sectionId } = req.params;

    // Verify instructor assignment
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (section.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const sessions = await AttendanceSession.find({ section: sectionId })
      .sort({ startTime: -1 });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get detailed attendance for a specific session
// @route   GET /api/instructor/attendance/session/:sessionId
// @access  Private (Instructor)
const getSessionAttendance = async (req, res) => {
  try {
    const session = await AttendanceSession.findOne({ sessionId: req.params.sessionId })
      .populate('section', 'sectionName')
      .populate('course', 'code title');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get all enrolled students for this section
    const enrollments = await Enrollment.find({ section: session.section._id })
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email' }
      });

    // Get marked attendance records for this session
    const attendanceRecords = await Attendance.find({ attendanceSession: session._id });

    // Combine data to show all enrolled students and their status
    const attendanceList = enrollments.map(enrollment => {
      const record = attendanceRecords.find(r => r.student.toString() === enrollment.student._id.toString());
      return {
        studentId: enrollment.student.studentId,
        name: enrollment.student.user.name,
        email: enrollment.student.user.email,
        status: record ? record.status : 'ABSENT',
        markedAt: record ? record.markedAt : null
      };
    });

    res.json({
      session,
      attendance: attendanceList
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Scan QR code to mark attendance (Student)
// @route   POST /api/student/attendance/scan
// @access  Private (Student)
const scanAttendance = async (req, res) => {
  try {
    const { sessionId, qrToken } = req.body;
    const userId = req.user._id;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // Find student profile
    const student = await Student.findOne({ user: userId });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Find active session
    const session = await AttendanceSession.findOne({ 
      sessionId, 
      isActive: true 
    });

    if (!session) {
      return res.status(404).json({ message: 'Active attendance session not found' });
    }

    // Verify QR token if provided (for secure QR scanning)
    if (qrToken && session.qrToken !== qrToken) {
      return res.status(403).json({ message: 'Invalid QR code token' });
    }

    // Check if session is still within time bounds
    const now = new Date();
    if (now < session.startTime || now > session.endTime) {
      return res.status(400).json({ message: 'Attendance session is not currently open' });
    }

    // Check if student is enrolled in this section
    const enrollment = await Enrollment.findOne({ 
      student: student._id, 
      section: session.section 
    });

    if (!enrollment) {
      return res.status(403).json({ message: 'You are not enrolled in this section' });
    }

    // Check if attendance already marked
    const existingAttendance = await Attendance.findOne({
      student: student._id,
      attendanceSession: session._id
    });

    if (existingAttendance) {
      return res.status(200).json({
        message: 'Attendance already marked for this session',
        attendance: existingAttendance
      });
    }

    // Mark attendance
    const attendance = await Attendance.create({
      student: student._id,
      attendanceSession: session._id,
      section: session.section,
      course: session.course,
      markedAt: new Date(),
      status: 'PRESENT'
    });

    res.status(201).json({
      message: 'Attendance marked successfully',
      attendance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startAttendanceSession,
  endAttendanceSession,
  getSectionAttendanceSessions,
  getSessionAttendance,
  scanAttendance
};
