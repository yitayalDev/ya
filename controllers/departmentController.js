const Department = require('../models/Department');
const College = require('../models/College');
const Course = require('../models/Course');
const Student = require('../models/Student');
const FinalGrade = require('../models/FinalGrade');
const Attendance = require('../models/Attendance');
const Staff = require('../models/Staff');

// @desc    Get all departments for a college
// @route   GET /api/departments
// @access  Private (College Admin / Super Admin)
const getDepartments = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'COLLEGE_ADMIN') {
      query = { college: req.user.college };
    } else if (req.query.collegeId) {
      query = { college: req.query.collegeId };
    }

    const departments = await Department.find(query)
      .populate('departmentAdmin', 'name email')
      .populate('college', 'name');
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a department
// @route   POST /api/departments
// @access  Private (College Admin)
const createDepartment = async (req, res) => {
  const { name, description } = req.body;

  try {
    if (req.user.role !== 'COLLEGE_ADMIN') {
      return res.status(403).json({ message: 'Only College Admins can create departments' });
    }

    const department = await Department.create({
      name,
      description,
      college: req.user.college,
    });

    res.status(201).json(department);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a department
// @route   PUT /api/departments/:id
// @access  Private (College Admin)
const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Ensure it's the right college
    if (department.college.toString() !== req.user.college.toString() && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updatedDepartment = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedDepartment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Toggle department active status
// @route   PUT /api/departments/:id/toggle-status
// @access  Private (College Admin)
const toggleDepartmentStatus = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Ensure it's the right college
    if (department.college.toString() !== req.user.college.toString() && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    department.isActive = !department.isActive;
    await department.save();

    res.json({
      message: `Department ${department.isActive ? 'activated' : 'deactivated'} successfully`,
      department
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign department admin
// @route   PUT /api/departments/:id/assign-admin
// @access  Private (College Admin)
const assignDepartmentAdmin = async (req, res) => {
  try {
    const { adminId } = req.body;
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Ensure it's the right college
    if (department.college.toString() !== req.user.college.toString() && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If assigning a new admin, remove them from any other department in this college
    if (adminId) {
      await Department.updateMany(
        { college: department.college, departmentAdmin: adminId, _id: { $ne: department._id } },
        { departmentAdmin: null }
      );
      
      // Update the User document to point to this department
      const User = require('../models/User');
      await User.findByIdAndUpdate(adminId, { department: department._id });
    } else if (department.departmentAdmin) {
      // If unassigning, remove department from User document
      const User = require('../models/User');
      await User.findByIdAndUpdate(department.departmentAdmin, { department: null });
    }

    department.departmentAdmin = adminId || null;
    await department.save();

    const updatedDepartment = await Department.findById(department._id)
      .populate('departmentAdmin', 'name email');

    res.json({
      message: adminId ? 'Department admin assigned successfully' : 'Department admin removed successfully',
      department: updatedDepartment
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private (College Admin)
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Ensure it's the right college
    if (department.college.toString() !== req.user.college.toString() && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if department has courses
    const coursesCount = await Course.countDocuments({ department: department._id });
    if (coursesCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete department with existing courses. Move courses to another department first.'
      });
    }

    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get department analytics
// @route   GET /api/departments/:id/analytics
// @access  Private (College Admin)
const getDepartmentAnalytics = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Ensure it's the right college
    if (req.user.role !== 'SUPER_ADMIN') {
      if (!req.user.college || department.college.toString() !== req.user.college.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    // Get courses in this department
    const courses = await Course.find({ department: department._id });
    const courseIds = courses.map(course => course._id);

    // Get enrollments
    const enrollments = await Student.countDocuments({
      department: department._id,
      status: 'Active'
    });

    // Get final grades for GPA calculation
    const finalGrades = await FinalGrade.find({
      course: { $in: courseIds },
      status: 'APPROVED'
    });

    // Calculate average GPA
    let totalGPA = 0;
    let gradeCount = 0;
    finalGrades.forEach(grade => {
      totalGPA += grade.gpaPoint;
      gradeCount++;
    });
    const averageGPA = gradeCount > 0 ? (totalGPA / gradeCount).toFixed(2) : 0;

    // Calculate pass/fail rate
    const passingGrades = finalGrades.filter(grade => grade.gpaPoint > 0).length;
    const passRate = gradeCount > 0 ? ((passingGrades / gradeCount) * 100).toFixed(1) : 0;

    // Get attendance data
    const attendanceRecords = await Attendance.find({
      course: { $in: courseIds }
    });

    let totalAttendance = 0;
    let presentCount = 0;
    attendanceRecords.forEach(record => {
      totalAttendance++;
      if (record.status === 'PRESENT') presentCount++;
    });
    const attendanceRate = totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(1) : 0;

    res.json({
      department: {
        _id: department._id,
        name: department.name,
      },
      courses: courses.length,
      enrollments,
      averageGPA: parseFloat(averageGPA),
      passRate: parseFloat(passRate),
      attendanceRate: parseFloat(attendanceRate),
      totalGrades: gradeCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get college overview for college admin
// @route   GET /api/departments/college-overview
// @access  Private (College Admin)
const getCollegeOverview = async (req, res) => {
  console.log('DEBUG: getCollegeOverview called');
  console.log('DEBUG: req.query:', req.query);
  console.log('DEBUG: req.user:', { id: req.user._id, role: req.user.role, college: req.user.college });

  try {
    let collegeId = req.user.college;
    if (req.user.role === 'SUPER_ADMIN' && req.query.collegeId) {
      collegeId = req.query.collegeId;
    }

    console.log('DEBUG: Determined collegeId:', collegeId);

    if (!collegeId) {
      return res.status(400).json({ message: 'College ID is required' });
    }

    const college = await College.findById(collegeId)
      .populate('campus', 'name');

    if (!college) {
      console.log('DEBUG: College NOT FOUND in database for ID:', collegeId);
      return res.status(404).json({ message: 'College not found' });
    }
    
    console.log('DEBUG: Found college:', college.name);

    // Get department count
    const departments = await Department.countDocuments({
      college: collegeId,
      isActive: true
    });

    // Get total students
    const students = await Student.countDocuments({
      college: collegeId,
      status: 'Active'
    });

    // Get total courses
    const courses = await Course.countDocuments({
      college: collegeId
    });

    // Get total staff
    const staff = await Staff.countDocuments({
      college: collegeId
    });

    res.json({
      college: {
        _id: college._id,
        name: college.name,
        campus: college.campus?.name,
        location: college.campus?.location,
      },
      stats: {
        departments,
        students,
        courses,
        staff
      }
    });
  } catch (error) {
    console.error('getCollegeOverview error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
  assignDepartmentAdmin,
  deleteDepartment,
  getDepartmentAnalytics,
  getCollegeOverview,
};
