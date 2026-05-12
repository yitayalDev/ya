const DormAttendance = require('../models/DormAttendance');
const User = require('../models/User');
const DormBed = require('../models/DormBed');

// @desc    Scan QR at gate to check-in/out
// @route   POST /api/housing/scan-qr
// @access  Private (Student)
const scanQR = async (req, res) => {
  try {
    const { gateId } = req.body;
    const studentId = req.user.id;

    // 1. Resolve student profile and validate assignment
    const Student = require('../models/Student');
    const studentProfile = await Student.findOne({ user: studentId });
    if (!studentProfile) {
      return res.status(403).json({ message: 'Student profile not found' });
    }

    const bed = await DormBed.findOne({ student: studentProfile._id });
    if (!bed) {
      return res.status(403).json({ message: 'Only students assigned to a dormitory can check-in/out' });
    }

    // 2. Determine scan type based on current status
    const student = await User.findById(studentId);
    const lastStatus = student.currentStatus || 'OUTSIDE';
    const newStatus = lastStatus === 'OUTSIDE' ? 'INSIDE' : 'OUTSIDE';
    const scanType = newStatus === 'INSIDE' ? 'CHECK_IN' : 'CHECK_OUT';

    // 3. Record attendance
    const attendance = await DormAttendance.create({
      student: studentId,
      type: scanType,
      gateId,
      method: 'QR',
    });

    // 4. Update student status
    student.currentStatus = newStatus;
    student.lastScanTime = new Date();
    await student.save();

    res.status(200).json({
      message: `Successfully ${scanType === 'CHECK_IN' ? 'checked-in' : 'checked-out'}`,
      status: newStatus,
      time: attendance.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get attendance stats for proctors/admins
// @route   GET /api/housing/attendance-stats/:campusId
const getAttendanceStats = async (req, res) => {
  try {
    const { campusId } = req.params;
    const { buildingId } = req.query;

    let filter = { campus: campusId, role: 'STUDENT' };
    
    // If buildingId is provided, we need to find students in that building via DormBed
    if (buildingId) {
      const blocks = await require('../models/DormBlock').find({ building: buildingId });
      const blockIds = blocks.map(b => b._id);
      
      const floorsInBlocks = await require('../models/DormFloor').find({ block: { $in: blockIds } });
      const floorIds = floorsInBlocks.map(f => f._id);
      
      const rooms = await require('../models/DormRoom').find({ floor: { $in: floorIds } });
      const roomIds = rooms.map(r => r._id);
      
      const beds = await DormBed.find({ room: { $in: roomIds }, isOccupied: true }).populate('student');
      const studentUserIds = beds.map(b => b.student?.user).filter(id => id);
      
      filter._id = { $in: studentUserIds };
    }

    // Count inside/outside
    const insideCount = await User.countDocuments({ ...filter, currentStatus: 'INSIDE' });
    const outsideCount = await User.countDocuments({ ...filter, currentStatus: 'OUTSIDE' });

    // Recent logs
    let logsQuery = DormAttendance.find().populate('student', 'name studentId').sort({ createdAt: -1 });
    
    if (buildingId) {
      logsQuery = logsQuery.where('student').in(filter._id.$in);
    }
    
    const recentLogs = await logsQuery.limit(20);

    res.json({
      insideCount,
      outsideCount,
      recentLogs,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get curfew alerts (Students outside after 10 PM)
// @route   GET /api/housing/curfew-alerts/:campusId
const getCurfewAlerts = async (req, res) => {
  try {
    const { campusId } = req.params;
    const { buildingId } = req.query;
    
    // 1. Find all students assigned to beds
    let bedFilter = { isOccupied: true };
    
    if (buildingId) {
      const blocks = await require('../models/DormBlock').find({ building: buildingId });
      const blockIds = blocks.map(b => b._id);
      const floors = await require('../models/DormFloor').find({ block: { $in: blockIds } });
      const floorIds = floors.map(f => f._id);
      const rooms = await require('../models/DormRoom').find({ floor: { $in: floorIds } });
      const roomIds = rooms.map(r => r._id);
      bedFilter.room = { $in: roomIds };
    }

    const beds = await DormBed.find(bedFilter).populate('student');
    const studentUserIds = beds.map(b => b.student?.user).filter(id => id);
    
    const missingStudents = await User.find({
      _id: { $in: studentUserIds },
      campus: campusId,
      currentStatus: 'OUTSIDE',
      role: 'STUDENT'
    }).select('name studentId email lastScanTime');

    res.json(missingStudents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  scanQR,
  getAttendanceStats,
  getCurfewAlerts,
};