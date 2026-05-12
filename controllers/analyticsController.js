const Student = require('../models/Student');
const Course = require('../models/Course');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const FinalGrade = require('../models/FinalGrade');
const Attendance = require('../models/Attendance');
const Department = require('../models/Department');
const College = require('../models/College');
const Section = require('../models/Section');
const { AcademicCalendar } = require('../models/AcademicCalendar');
const Campus = require('../models/Campus');
const Library = require('../models/Library');
const Dormitory = require('../models/Dormitory');
const TransferLog = require('../models/TransferLog');
const StudentProfile = require('../models/Student'); // Renamed to avoid confusion if needed
const MedicalVisit = require('../models/MedicalVisit');
const Clinic = require('../models/Clinic');
const Appointment = require('../models/Appointment');
const Violation = require('../models/Violation');

// @desc    Get overview analytics
// @route   GET /api/analytics/overview
// @access  Private (Super Admin)
const getOverviewAnalytics = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({ status: 'Active' });
    const totalCourses = await Course.countDocuments({ isActive: true });
    const totalInstructors = await User.countDocuments({ role: 'INSTRUCTOR' });
    const totalEnrollments = await Enrollment.countDocuments({ status: 'Enrolled' });

    // Students by Campus - using student's campus field directly
    const studentsByCampus = await Student.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: '$campus', count: { $sum: 1 } } },
      { $lookup: { from: 'campus', localField: '_id', foreignField: '_id', as: 'campusData' } },
      { $unwind: { path: '$campusData', preserveNullAndEmptyArrays: true } },
      { $project: { _id: '$_id', name: { $ifNull: ['$campusData.name', 'No Campus Assigned'] }, count: '$count' } }
    ]);

    // Current Semester
    const currentSemester = await AcademicCalendar.findOne({ isCurrent: true });

    res.json({
      overview: {
        totalStudents,
        totalCourses,
        totalInstructors,
        totalEnrollments,
      },
      studentsByCampus,
      currentSemester,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get enrollment analytics
// @route   GET /api/analytics/enrollment
// @access  Private (Super Admin)
const getEnrollmentAnalytics = async (req, res) => {
  try {
    // Enrollment Trends by Semester
    const enrollmentTrends = await Enrollment.aggregate([
      { $lookup: { from: 'sections', localField: 'section', foreignField: '_id', as: 'sectionData' } },
      { $unwind: '$sectionData' },
      { $lookup: { from: 'academiccalendars', localField: 'sectionData.semester', foreignField: '_id', as: 'semesterData' } },
      { $unwind: '$semesterData' },
      { $group: { _id: { semesterName: '$semesterData.name', academicYear: '$semesterData.academicYear' }, count: { $sum: 1 } } },
      { $sort: { '_id.academicYear': 1 } }
    ]);

    // Enrollment by Department
    const enrollmentByDepartment = await Enrollment.aggregate([
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentData' } },
      { $unwind: '$studentData' },
      { $lookup: { from: 'departments', localField: 'studentData.department', foreignField: '_id', as: 'deptData' } },
      { $unwind: '$deptData' },
      { $group: { _id: '$deptData._id', name: { $first: '$deptData.name' }, count: { $sum: 1 } } }
    ]);

    // Course Popularity
    const coursePopularity = await Enrollment.aggregate([
      { $lookup: { from: 'sections', localField: 'section', foreignField: '_id', as: 'sectionData' } },
      { $unwind: '$sectionData' },
      { $lookup: { from: 'courses', localField: 'sectionData.course', foreignField: '_id', as: 'courseData' } },
      { $unwind: '$courseData' },
      { $group: { _id: '$courseData._id', code: { $first: '$courseData.code' }, title: { $first: '$courseData.title' }, enrollments: { $sum: 1 } } },
      { $sort: { enrollments: -1 } },
      { $limit: 10 }
    ]);

    // Section Utilization
    const sectionUtilization = await Section.aggregate([
      { $lookup: { from: 'enrollments', localField: '_id', foreignField: 'section', as: 'enrollments' } },
      { $project: { name: 1, capacity: 1, enrollmentCount: { $size: '$enrollments' } } }
    ]);

    res.json({
      enrollmentTrends,
      enrollmentByDepartment,
      coursePopularity,
      sectionUtilization,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get academic performance analytics
// @route   GET /api/analytics/academic-performance
// @access  Private (Super Admin)
const getAcademicPerformanceAnalytics = async (req, res) => {
  try {
    // GPA by College
    const gpaByCollege = await FinalGrade.aggregate([
      { $match: { status: 'APPROVED' } },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentData' } },
      { $unwind: '$studentData' },
      { $lookup: { from: 'colleges', localField: 'studentData.college', foreignField: '_id', as: 'collegeData' } },
      { $unwind: '$collegeData' },
      { $group: { _id: '$collegeData._id', name: { $first: '$collegeData.name' }, studentCount: { $sum: 1 }, averageGPA: { $avg: '$gpaPoint' } } }
    ]);

    // Grade Distribution
    const gradeDistribution = await FinalGrade.aggregate([
      { $match: { status: 'APPROVED' } },
      { $group: { _id: '$grade', count: { $sum: 1 } } }
    ]);

    // Pass Rate
    const totalGrades = await FinalGrade.countDocuments({ status: 'APPROVED' });
    const passingGrades = await FinalGrade.countDocuments({ status: 'APPROVED', gpaPoint: { $gt: 0 } });
    const passRate = totalGrades > 0 ? (passingGrades / totalGrades) * 100 : 0;

    // Academic Status Distribution
    const academicStatusDistribution = await Student.aggregate([
      { $group: { _id: '$academicStatus', count: { $sum: 1 } } }
    ]);

    res.json({
      gpaByCollege,
      gradeDistribution,
      passRate: parseFloat(passRate.toFixed(1)),
      academicStatusDistribution,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get attendance analytics
// @route   GET /api/analytics/attendance
// @access  Private (Super Admin)
const getAttendanceAnalytics = async (req, res) => {
  try {
    // Overall Attendance Rate
    const totalRecords = await Attendance.countDocuments();
    const presentRecords = await Attendance.countDocuments({ status: 'PRESENT' });
    const overallAttendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;

    // Low Attendance Courses
    const attendanceByCourse = await Attendance.aggregate([
      { $lookup: { from: 'sections', localField: 'section', foreignField: '_id', as: 'sectionData' } },
      { $unwind: '$sectionData' },
      { $lookup: { from: 'courses', localField: 'sectionData.course', foreignField: '_id', as: 'courseData' } },
      { $unwind: '$courseData' },
      { $group: { _id: '$courseData._id', courseCode: { $first: '$courseData.code' }, courseTitle: { $first: '$courseData.title' }, totalRecords: { $sum: 1 }, presentCount: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } } } },
      { $project: { courseCode: 1, courseTitle: 1, totalRecords: 1, presentCount: 1, attendanceRate: { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] } } },
      { $sort: { attendanceRate: 1 } },
      { $limit: 10 }
    ]);

    // Low Attendance Students Count
    const lowAttendanceStudentsCount = await Attendance.aggregate([
      { $group: { _id: '$student', presentCount: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } }, totalRecords: { $sum: 1 } } },
      { $project: { attendanceRate: { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] } } },
      { $match: { attendanceRate: { $lt: 75 } } },
      { $count: 'lowAttendanceCount' }
    ]);

    const studentAttendance = await Attendance.aggregate([
      { $group: { _id: '$student', presentCount: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } }, totalRecords: { $sum: 1 } } },
      { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'studentData' } },
      { $unwind: '$studentData' },
      { $project: { name: '$studentData.name', attendanceRate: { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] } } },
      { $sort: { attendanceRate: 1 } },
      { $limit: 20 }
    ]);

    res.json({
      attendanceByCourse,
      overallAttendanceRate: parseFloat(overallAttendanceRate.toFixed(1)),
      lowAttendanceStudentsCount: lowAttendanceStudentsCount[0]?.lowAttendanceCount || 0,
      studentAttendance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get instructor performance analytics
// @route   GET /api/analytics/instructor-performance
// @access  Private (Super Admin)
const getInstructorPerformanceAnalytics = async (req, res) => {
  try {
    // Courses per Instructor
    const coursesPerInstructor = await Section.aggregate([
      { $lookup: { from: 'users', localField: 'instructor', foreignField: '_id', as: 'instructorData' } },
      { $unwind: '$instructorData' },
      { $group: { _id: '$instructor', name: { $first: '$instructorData.name' }, coursesCount: { $sum: 1 } } },
      { $sort: { coursesCount: -1 } },
      { $limit: 10 }
    ]);

    // Average GPA per Instructor
    const gradesPerInstructor = await FinalGrade.aggregate([
      { $lookup: { from: 'sections', localField: 'section', foreignField: '_id', as: 'sectionData' } },
      { $unwind: '$sectionData' },
      { $lookup: { from: 'users', localField: 'sectionData.instructor', foreignField: '_id', as: 'instructorData' } },
      { $unwind: '$instructorData' },
      { $group: { _id: '$instructor', name: { $first: '$instructorData.name' }, totalGrades: { $sum: 1 }, averageGPA: { $avg: '$gpaPoint' } } },
      { $sort: { averageGPA: -1 } },
      { $limit: 10 }
    ]);

    // Attendance per Instructor (average attendance in their sections)
    const attendancePerInstructor = await Attendance.aggregate([
      { $lookup: { from: 'sections', localField: 'section', foreignField: '_id', as: 'sectionData' } },
      { $unwind: '$sectionData' },
      { $lookup: { from: 'users', localField: 'sectionData.instructor', foreignField: '_id', as: 'instructorData' } },
      { $unwind: '$instructorData' },
      { $group: { _id: '$instructor', name: { $first: '$instructorData.name' }, presentCount: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } }, totalRecords: { $sum: 1 } } },
      { $project: { name: 1, attendanceRate: { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] } } }
    ]);

    res.json({
      coursesPerInstructor,
      gradesPerInstructor,
      attendancePerInstructor,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get department reports
// @route   GET /api/analytics/department-reports
// @access  Private (Super Admin)
const getDepartmentReports = async (req, res) => {
  try {
    // Enrollments per department (via sections → courses → department)
    const deptEnrollmentMap = {};
    const enrollmentsByDept = await Enrollment.aggregate([
      { $lookup: { from: 'sections', localField: 'section', foreignField: '_id', as: 'sectionData' } },
      { $unwind: '$sectionData' },
      { $lookup: { from: 'courses', localField: 'sectionData.course', foreignField: '_id', as: 'courseData' } },
      { $unwind: '$courseData' },
      { $group: { _id: '$courseData.department', totalEnrollments: { $sum: 1 } } }
    ]);
    enrollmentsByDept.forEach(e => {
      if (e._id) deptEnrollmentMap[e._id.toString()] = e.totalEnrollments;
    });

    // Department Performance
    const rawDepts = await Department.aggregate([
      { $lookup: { from: 'courses', localField: '_id', foreignField: 'department', as: 'courses' } },
      { $lookup: { from: 'students', localField: '_id', foreignField: 'department', as: 'students' } },
      { $project: { name: 1, coursesCount: { $size: '$courses' }, studentsCount: { $size: '$students' } } }
    ]);

    const departmentPerformance = rawDepts.map(dept => {
      const totalEnrollments = deptEnrollmentMap[dept._id.toString()] || 0;
      const averageEnrollmentPerCourse = dept.coursesCount > 0
        ? parseFloat((totalEnrollments / dept.coursesCount).toFixed(1))
        : 0;
      return { ...dept, totalEnrollments, averageEnrollmentPerCourse };
    });

    // College Performance
    const collegePerformance = await College.aggregate([
      { $lookup: { from: 'departments', localField: '_id', foreignField: 'college', as: 'departments' } },
      { $lookup: { from: 'students', localField: '_id', foreignField: 'college', as: 'students' } },
      { $project: { name: 1, departmentsCount: { $size: '$departments' }, studentsCount: { $size: '$students' } } }
    ]);

    res.json({
      departmentPerformance,
      collegePerformance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get registrar dashboard analytics
// @route   GET /api/analytics/registrar
// @access  Private (Registrar)
const getRegistrarAnalytics = async (req, res) => {
  try {
    const collegeId = req.user.college;

    // 1. Enrollment by Department
    const deptEnrollment = await Student.aggregate([
      { $match: { college: collegeId } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    const populatedDeptEnrollment = await Department.populate(deptEnrollment, { path: '_id', select: 'name' });

    // 2. Gender Distribution
    const genderDist = await Student.aggregate([
      { $match: { college: collegeId } },
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);

    // 3. Academic Standing Distribution
    const standingDist = await Student.aggregate([
      { $match: { college: collegeId } },
      { $group: { _id: '$academicStatus', count: { $sum: 1 } } }
    ]);

    // 4. Average GPA by Department
    const avgGPA = await Student.aggregate([
      { $match: { college: collegeId, cgpa: { $exists: true } } },
      { $group: { _id: '$department', avgCGPA: { $avg: '$cgpa' } } }
    ]);
    const populatedAvgGPA = await Department.populate(avgGPA, { path: '_id', select: 'name' });

    res.json({
      deptEnrollment: populatedDeptEnrollment.map(d => ({ name: d._id ? d._id.name : 'Unknown', count: d.count })),
      genderDist: genderDist.map(g => ({ label: g._id || 'Not Specified', count: g.count })),
      standingDist: standingDist.map(s => ({ label: s._id || 'Good Standing', count: s.count })),
      avgGPA: populatedAvgGPA.map(d => ({ name: d._id ? d._id.name : 'Unknown', gpa: parseFloat(d.avgCGPA.toFixed(2)) }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Clinic & Health Analytics
// @route   GET /api/analytics/clinic
// @access  Private (Super Admin)
const getClinicAnalytics = async (req, res) => {
  try {
    // 1. Top Diagnoses (Illness Trends)
    const topDiagnoses = await MedicalVisit.aggregate([
      { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // 2. Visit Volume by Clinic
    const clinicVolume = await MedicalVisit.aggregate([
      { $group: { _id: '$clinic', count: { $sum: 1 } } }
    ]);
    const populatedClinicVolume = await Clinic.populate(clinicVolume, { path: '_id', select: 'name' });

    // 3. Appointment Priority Distribution
    const priorityDist = await Appointment.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // 4. Daily Visit Trends (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyTrends = await MedicalVisit.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 5. Secure Video Session Overview
    const totalVideoAppointments = await Appointment.countDocuments({ sessionType: 'VIDEO' });
    const liveVideoSessions = await Appointment.countDocuments({
      sessionType: 'VIDEO',
      'videoSession.status': 'LIVE'
    });
    const scheduledVideoSessions = await Appointment.countDocuments({
      sessionType: 'VIDEO',
      'videoSession.status': 'SCHEDULED'
    });
    const completedVideoSessions = await Appointment.countDocuments({
      sessionType: 'VIDEO',
      'videoSession.status': 'COMPLETED'
    });
    const expiredVideoSessions = await Appointment.countDocuments({
      sessionType: 'VIDEO',
      'videoSession.status': 'EXPIRED'
    });

    const videoStatusDist = await Appointment.aggregate([
      { $match: { sessionType: 'VIDEO' } },
      {
        $group: {
          _id: { $ifNull: ['$videoSession.status', 'SCHEDULED'] },
          count: { $sum: 1 }
        }
      }
    ]);

    const videoByClinic = await Appointment.aggregate([
      { $match: { sessionType: 'VIDEO' } },
      {
        $group: {
          _id: '$clinic',
          total: { $sum: 1 },
          live: {
            $sum: {
              $cond: [{ $eq: ['$videoSession.status', 'LIVE'] }, 1, 0]
            }
          },
          scheduled: {
            $sum: {
              $cond: [{ $eq: ['$videoSession.status', 'SCHEDULED'] }, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$videoSession.status', 'COMPLETED'] }, 1, 0]
            }
          },
          expired: {
            $sum: {
              $cond: [{ $eq: ['$videoSession.status', 'EXPIRED'] }, 1, 0]
            }
          }
        }
      }
    ]);
    const populatedVideoByClinic = await Clinic.populate(videoByClinic, { path: '_id', select: 'name' });

    res.json({
      topDiagnoses: topDiagnoses.map(d => ({ diagnosis: d._id || 'General Checkup', count: d.count })),
      clinicVolume: populatedClinicVolume.map(c => ({
        clinicId: c._id ? c._id._id : null,
        name: c._id ? c._id.name : 'Unknown',
        count: c.count
      })),
      priorityDist: priorityDist.map(p => ({ label: p._id, count: p.count })),
      dailyTrends: dailyTrends.map(t => ({ date: t._id, count: t.count })),
      videoOverview: {
        totalVideoAppointments,
        liveVideoSessions,
        scheduledVideoSessions,
        completedVideoSessions,
        expiredVideoSessions,
      },
      videoStatusDist: videoStatusDist.map(item => ({ label: item._id, count: item.count })),
      videoByClinic: populatedVideoByClinic.map(item => ({
        clinicId: item._id ? item._id._id : null,
        name: item._id ? item._id.name : 'Unknown',
        total: item.total,
        live: item.live,
        scheduled: item.scheduled,
        completed: item.completed,
        expired: item.expired,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Super Admin Dashboard Stats
// @route   GET /api/analytics/super-admin/dashboard
// @access  Private (Super Admin)
const getSuperAdminDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({ status: 'Active' });
    const totalInstructors = await User.countDocuments({ role: 'INSTRUCTOR' });
    const totalStaff = await User.countDocuments({ role: { $in: ['DEPARTMENT_ADMIN', 'REGISTRAR', 'LIBRARY_ADMIN', 'DORMITORY_ADMIN', 'PROCTOR', 'CLINIC_ADMIN', 'DOCTOR', 'PHARMACIST', 'NURSE'] } });
    const totalCampuses = await Campus.countDocuments({ status: 'Active' });
    const totalLibraries = await Library.countDocuments({ isActive: true });
    const totalDormitories = await Dormitory.countDocuments({ isActive: true });

    // Dormitory Occupancy
    const dorms = await Dormitory.find({ isActive: true });
    let totalCapacity = 0;
    let totalOccupancy = 0;
    dorms.forEach(dorm => {
      totalCapacity += dorm.totalCapacity || 0;
      totalOccupancy += dorm.currentOccupancy || 0;
    });
    const occupancyRate = totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0;

    // Recent Transfers (Last 5)
    const recentTransfers = await TransferLog.find()
      .populate('fromCampus', 'name')
      .populate('toCampus', 'name')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Enrich transfers with entity names
    const enrichedTransfers = await Promise.all(recentTransfers.map(async (log) => {
      let entityName = 'Unknown';
      try {
        if (log.entityType === 'Student') {
          const student = await Student.findById(log.entityId).populate('user', 'name');
          entityName = student?.user?.name || 'Unknown Student';
        } else if (log.entityType === 'Staff') {
          const user = await User.findById(log.entityId);
          entityName = user?.name || 'Unknown Staff';
        }
      } catch (e) {}
      return { ...log.toObject(), entityName };
    }));

    // Current Semester
    const currentSemester = await AcademicCalendar.findOne({ isCurrent: true });

    res.json({
      summary: {
        totalStudents,
        totalInstructors,
        totalStaff,
        totalCampuses,
        totalLibraries,
        totalDormitories,
        occupancyRate: parseFloat(occupancyRate.toFixed(1)),
      },
      recentTransfers: enrichedTransfers,
      currentSemester,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Dean of Students Dashboard Analytics
// @route   GET /api/analytics/dean
// @access  Private (Dean/Super Admin)
const getDeanAnalytics = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({ status: 'Active' });
    
    // Live Occupancy (from User model status)
    const insideCount = await User.countDocuments({ role: 'STUDENT', currentStatus: 'INSIDE' });
    const outsideCount = await User.countDocuments({ role: 'STUDENT', currentStatus: 'OUTSIDE' });
    
    // Top Diagnoses (Illness Trends)
    const medicalTrends = await MedicalVisit.aggregate([
      { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    // Active Violations Count
    const activeViolations = await Violation.countDocuments({ status: 'PENDING' });

    res.json({
      totalStudents,
      occupancy: {
        inside: insideCount,
        outside: outsideCount,
      },
      healthTrends: medicalTrends.map(t => ({ diagnosis: t._id || 'Checkup', count: t.count })),
      disciplinary: {
        activeCount: activeViolations,
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOverviewAnalytics,
  getEnrollmentAnalytics,
  getAcademicPerformanceAnalytics,
  getAttendanceAnalytics,
  getInstructorPerformanceAnalytics,
  getDepartmentReports,
  getRegistrarAnalytics,
  getClinicAnalytics,
  getSuperAdminDashboardStats,
  getDeanAnalytics,
};
