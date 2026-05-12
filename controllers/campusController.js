const mongoose = require('mongoose');
const Campus = require('../models/Campus');
const College = require('../models/College');
const Department = require('../models/Department');
const Student = require('../models/Student');
const User = require('../models/User');
const Staff = require('../models/Staff');
const TransferLog = require('../models/TransferLog');

// @desc    Get all campuses
// @route   GET /api/campuses
// @access  Private
const getCampuses = async (req, res) => {
  try {
    const campuses = await Campus.find({})
      .populate('campusAdmin', 'name email')
      .sort({ createdAt: -1 });
    res.json(campuses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single campus
// @route   GET /api/campuses/:id
// @access  Private
const getCampus = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id)
      .populate('campusAdmin', 'name email');

    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    res.json(campus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a campus
// @route   POST /api/campuses
// @access  Private/Super Admin
const createCampus = async (req, res) => {
  const {
    name,
    location,
    description,
    contactInfo,
    status,
    campusAdmin,
    dataIsolationMode,
    establishedYear,
    totalCapacity
  } = req.body;

  try {
    const campusExists = await Campus.findOne({ name });

    if (campusExists) {
      return res.status(400).json({ message: 'Campus already exists' });
    }

    const campus = await Campus.create({
      name,
      location,
      description,
      contactInfo,
      status,
      campusAdmin,
      dataIsolationMode,
      establishedYear,
      totalCapacity,
    });

    const populatedCampus = await Campus.findById(campus._id)
      .populate('campusAdmin', 'name email');

    res.status(201).json(populatedCampus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update campus
// @route   PUT /api/campuses/:id
// @access  Private/Super Admin
const updateCampus = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);

    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    const {
      name,
      location,
      description,
      contactInfo,
      status,
      campusAdmin,
      dataIsolationMode,
      establishedYear,
      totalCapacity
    } = req.body;

    campus.name = name || campus.name;
    campus.location = location || campus.location;
    campus.description = description || campus.description;
    campus.contactInfo = contactInfo || campus.contactInfo;
    campus.status = status || campus.status;
    campus.campusAdmin = campusAdmin || campus.campusAdmin;
    campus.dataIsolationMode = dataIsolationMode || campus.dataIsolationMode;
    campus.establishedYear = establishedYear || campus.establishedYear;
    campus.totalCapacity = totalCapacity || campus.totalCapacity;

    await campus.save();

    const updatedCampus = await Campus.findById(campus._id)
      .populate('campusAdmin', 'name email');

    res.json(updatedCampus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete campus
// @route   DELETE /api/campuses/:id
// @access  Private/Super Admin
const deleteCampus = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);

    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    // Check if campus has colleges
    const collegesCount = await College.countDocuments({ campus: campus._id });
    if (collegesCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete campus with existing colleges. Transfer or remove colleges first.'
      });
    }

    await Campus.findByIdAndDelete(req.params.id);
    res.json({ message: 'Campus deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Activate/Deactivate campus
// @route   PUT /api/campuses/:id/toggle-status
// @access  Private/Super Admin
const toggleCampusStatus = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);

    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    campus.status = campus.status === 'Active' ? 'Inactive' : 'Active';
    await campus.save();

    res.json({
      message: `Campus ${campus.status === 'Active' ? 'activated' : 'deactivated'} successfully`,
      campus
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get campus statistics
// @route   GET /api/campuses/:id/stats
// @access  Private
const getCampusStats = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);

    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    // Get colleges in this campus
    const colleges = await College.find({ campus: campus._id });
    const collegeIds = colleges.map(college => college._id);

    // Get departments in these colleges
    const departments = await Department.find({ college: { $in: collegeIds } });
    const departmentIds = departments.map(d => d._id);

    // Get students in this campus
    const students = await Student.find({
      college: { $in: collegeIds },
      status: 'Active'
    }).countDocuments();

    // Update campus currentEnrollment
    await Campus.findByIdAndUpdate(req.params.id, {
      $set: { currentEnrollment: students }
    });

    // Get active instructors (staff with instructor role in this campus)
    const instructors = await Staff.find({
      department: { $in: departmentIds }
    }).populate('user').populate('department');

    const activeInstructors = instructors.filter(staff =>
      staff.user && staff.user.role === 'INSTRUCTOR'
    );

    res.json({
      campus: campus.name,
      colleges: colleges.length,
      departments: departments.length,
      students: students,
      instructors: activeInstructors.length,
      capacityUtilization: campus.totalCapacity ?
        ((students / campus.totalCapacity) * 100).toFixed(1) : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Transfer student between campuses
// @route   POST /api/campuses/transfer-student
// @access  Private/Super Admin
const transferStudent = async (req, res) => {
  try {
    const { studentId, fromCampusId, toCampusId, toCollegeId, toDepartmentId, reason } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify campuses exist
    const fromCampus = await Campus.findById(fromCampusId);
    const toCampus = await Campus.findById(toCampusId);
    if (!fromCampus || !toCampus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    // Verify college belongs to target campus
    const toCollege = await College.findOne({
      _id: toCollegeId,
      campus: toCampusId
    });
    if (!toCollege) {
      return res.status(400).json({ message: 'Invalid college for target campus' });
    }

    // Verify department belongs to target college
    const toDepartment = await Department.findOne({
      _id: toDepartmentId,
      college: toCollegeId
    });
    if (!toDepartment) {
      return res.status(400).json({ message: 'Invalid department for target college' });
    }

    // Update student
    student.college = toCollegeId;
    student.department = toDepartmentId;
    await student.save();

    // Update campus enrollment counts
    await Campus.findByIdAndUpdate(fromCampusId, {
      $inc: { currentEnrollment: -1 }
    });

    await Campus.findByIdAndUpdate(toCampusId, {
      $inc: { currentEnrollment: 1 }
    });

    // Log transfer
    await TransferLog.create({
      entityType: 'Student',
      entityId: studentId,
      fromCampus: fromCampusId,
      toCampus: toCampusId,
      reason,
      performedBy: req.user._id,
    });

    res.json({ message: 'Student transferred successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Transfer staff between campuses
// @desc    Transfer staff between campuses
// @route   POST /api/campuses/transfer-staff
// @access  Private/Super Admin
const transferStaff = async (req, res) => {
  try {
    const { staffId, fromCampusId, toCampusId, toCollegeId, toDepartmentId, reason } = req.body;

    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Verify campuses exist
    const fromCampus = await Campus.findById(fromCampusId);
    const toCampus = await Campus.findById(toCampusId);
    if (!fromCampus || !toCampus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    // Update staff
    staff.campus = toCampusId;
    staff.college = toCollegeId;
    staff.department = toDepartmentId;
    await staff.save();

    // Log transfer
    await TransferLog.create({
      entityType: 'Staff',
      entityId: staffId,
      fromCampus: fromCampusId,
      toCampus: toCampusId,
      reason,
      performedBy: req.user._id,
    });

    res.json({ message: 'Staff transferred successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get cross-campus statistics
// @route   GET /api/campuses/cross-campus-stats
// @access  Private/Super Admin
const getCrossCampusStats = async (req, res) => {
  try {
    const campuses = await Campus.find({ status: 'Active' })
      .populate('campusAdmin', 'name email');

    const campusStats = [];

    for (const campus of campuses) {
      const colleges = await College.find({ campus: campus._id });
      const collegeIds = colleges.map(college => college._id);

      const departments = await Department.find({ college: { $in: collegeIds } });
      const departmentIds = departments.map(d => d._id);

      const students = await Student.countDocuments({
        college: { $in: collegeIds },
        status: 'Active'
      });

      // Update campus currentEnrollment
      await Campus.findByIdAndUpdate(campus._id, {
        $set: { currentEnrollment: students }
      });

      const instructors = await Staff.countDocuments({
        department: { $in: departmentIds }
      });

      campusStats.push({
        campus: {
          _id: campus._id,
          name: campus.name,
          location: campus.location,
          status: campus.status,
          admin: campus.campusAdmin,
          totalCapacity: campus.totalCapacity || 0,
        },
        stats: {
          colleges: colleges.length,
          departments: departments.length,
          students,
          instructors,
          capacityUtilization: campus.totalCapacity ?
            ((students / campus.totalCapacity) * 100).toFixed(1) : null,
        }
      });
    }

    res.json({
      totalCampuses: campuses.length,
      campusStats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get students by campus
// @route   GET /api/campuses/:id/students
// @access  Private/Super Admin
const getStudentsByCampus = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    // Get colleges in this campus
    const colleges = await College.find({ campus: campus._id });
    const collegeIds = colleges.map(college => college._id);

    // Get students in these colleges
    const students = await Student.find({ college: { $in: collegeIds } })
      .populate('user', 'name')
      .populate('college', 'name')
      .populate('department', 'name');

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get staff by campus
// @route   GET /api/campuses/:id/staff
// @access  Private/Super Admin
const getStaffByCampus = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);
    if (!campus) {
      return res.status(404).json({ message: 'Campus not found' });
    }

    // Get colleges in this campus
    const colleges = await College.find({ campus: campus._id });
    const collegeIds = colleges.map(college => college._id);

    // Get all users with staff-like roles in these colleges
    const staffRoles = ['INSTRUCTOR', 'DEPARTMENT_ADMIN', 'REGISTRAR', 'LIBRARY_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR', 'CLINIC_ADMIN', 'DOCTOR', 'PHARMACIST', 'NURSE'];
    
    const staff = await User.find({ 
      college: { $in: collegeIds },
      role: { $in: staffRoles }
    }).populate('department', 'name');

    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get transfer logs
// @route   GET /api/campuses/transfers/history
// @access  Private/Super Admin
const getTransferLogs = async (req, res) => {
  try {
    const logs = await TransferLog.find()
      .populate('fromCampus', 'name')
      .populate('toCampus', 'name')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    
    // We also want to get the name of the entity (Student/Staff)
    // Since entityId points to different collections based on entityType,
    // we have to do it manually or use a more complex populate.
    const enrichedLogs = await Promise.all(logs.map(async (log) => {
      let entityName = 'Unknown';
      try {
        if (log.entityType === 'Student') {
          const student = await Student.findById(log.entityId).populate('user', 'name');
          entityName = student?.user?.name || 'Unknown Student';
        } else if (log.entityType === 'Staff') {
          // Now using User model for staff transfers
          const user = await User.findById(log.entityId);
          entityName = user?.name || 'Unknown Staff';
        }
      } catch (e) {
        console.error('Error fetching entity name for log:', e);
      }
      
      return {
        ...log.toObject(),
        entityName
      };
    }));

    res.json(enrichedLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCampuses,
  getCampus,
  createCampus,
  updateCampus,
  deleteCampus,
  toggleCampusStatus,
  getCampusStats,
  transferStudent,
  transferStaff,
  getCrossCampusStats,
  getStudentsByCampus,
  getStaffByCampus,
  getTransferLogs,
};
