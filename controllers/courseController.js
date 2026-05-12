const Course = require('../models/Course');
const GradingComponent = require('../models/GradingComponent');

// @desc    Get all courses (filtered by college/dept)
// @route   GET /api/courses
// @access  Private
const getCourses = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'COLLEGE_ADMIN' || req.user.role === 'REGISTRAR') {
      query = { college: req.user.college };
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      query = { department: req.user.department };
    }

    if (req.query.yearLevel) {
      query.yearLevel = req.query.yearLevel;
    }
    if (req.query.departmentId) {
      query.department = req.query.departmentId;
    }

    const courses = await Course.find(query)
      .populate('department', 'name')
      .populate('college', 'name')
      .populate('leadInstructor', 'name');
    
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a course
// @route   POST /api/courses
// @access  Private (Dept Admin / College Admin)
const createCourse = async (req, res) => {
  const { code, title, credits, yearLevel, semester, description, departmentId, gradingStructure, leadInstructorId, autoEnroll } = req.body;

  try {
    // Validate Grading Structure if provided
    if (gradingStructure && gradingStructure.length > 0) {
      const totalWeight = gradingStructure.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight !== 100) {
        return res.status(400).json({ message: 'Total grading weight must equal 100%' });
      }
    }

    let courseDept = departmentId;
    let courseCollege = req.user.college;

    if (req.user.role === 'DEPARTMENT_ADMIN') {
      courseDept = req.user.department;
    }

    const course = await Course.create({
      code,
      title,
      credits,
      yearLevel: yearLevel || 1,
      semester: semester || 1,
      description,
      department: courseDept,
      college: courseCollege,
      gradingStructure: gradingStructure || [
        { component: 'Final Exam', weight: 40 },
        { component: 'Mid Exam', weight: 30 },
        { component: 'Quizzes', weight: 10 },
        { component: 'Assignments', weight: 20 },
      ],
      leadInstructor: leadInstructorId,
    });

    // Automatically create GradingComponent records for this course
    const actualGrading = gradingStructure || [
      { component: 'Final Exam', weight: 40 },
      { component: 'Mid Exam', weight: 30 },
      { component: 'Quizzes', weight: 10 },
      { component: 'Assignments', weight: 20 },
    ];

    for (let i = 0; i < actualGrading.length; i++) {
      const g = actualGrading[i];
      await GradingComponent.create({
        course: course._id,
        name: g.component,
        weight: g.weight,
        maxScore: g.weight,
        sequenceOrder: i + 1,
        createdBy: req.user._id,
      });
    }

    // --- AUTO ENROLLMENT LOGIC ---
    if (autoEnroll) {
      const { Semester } = require('../models/AcademicCalendar');
      const Section = require('../models/Section');
      const Student = require('../models/Student');
      const Enrollment = require('../models/Enrollment');

      // 1. Find Target Semester (Provided ID or Current)
      const targetSemesterId = req.body.semesterId;
      let targetSemester = null;
      
      if (targetSemesterId) {
        targetSemester = await Semester.findById(targetSemesterId);
      } else {
        targetSemester = await Semester.findOne({ isCurrent: true, status: 'Active' });
      }
      
      if (targetSemester) {
        // 2. Create Section 1
        const section = await Section.create({
          sectionName: 'Section 1',
          course: course._id,
          instructor: leadInstructorId || req.user._id,
          semester: targetSemester._id,
          classroom: 'To Be Assigned',
          capacity: 100,
          department: courseDept,
        });

        // 3. Find matching active students
        const students = await Student.find({
          department: courseDept,
          academicYear: `Year ${course.yearLevel}`,
          status: 'Active',
          college: courseCollege
        });

        if (students.length > 0) {
          // 4. Create Enrollments
          const enrollmentData = students.map(s => ({
            student: s._id,
            section: section._id,
            course: course._id,
            semester: targetSemester._id,
            status: 'Enrolled'
          }));

          await Enrollment.insertMany(enrollmentData);

          // 5. Update enrolledCount
          section.enrolledCount = students.length;
          await section.save();
        }
      }
    }
    
    const populatedCourse = await Course.findById(course._id)
      .populate('department', 'name')
      .populate('college', 'name')
      .populate('leadInstructor', 'name');

    res.status(201).json(populatedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a course
// @route   PUT /api/courses/:id
// @access  Private (Dept Admin)
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Ensure it's the right department
    if (course.department.toString() !== req.user.department.toString() && req.user.role !== 'COLLEGE_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updates = req.body;

    // Validate grading structure if provided
    if (updates.gradingStructure && updates.gradingStructure.length > 0) {
      const totalWeight = updates.gradingStructure.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight !== 100) {
        return res.status(400).json({ message: 'Total grading weight must equal 100%' });
      }
    }

    Object.assign(course, updates);
    await course.save();

    const updatedCourse = await Course.findById(course._id)
      .populate('department', 'name')
      .populate('college', 'name')
      .populate('leadInstructor', 'name')
      .populate('prerequisites', 'code title');

    res.json(updatedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Toggle course active status
// @route   PUT /api/courses/:id/toggle-status
// @access  Private (Dept Admin)
const toggleCourseStatus = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Ensure it's the right department
    if (course.department.toString() !== req.user.department.toString() && req.user.role !== 'COLLEGE_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    course.isActive = !course.isActive;
    await course.save();

    res.json({
      message: `Course ${course.isActive ? 'activated' : 'deactivated'} successfully`,
      course
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a course
// @route   DELETE /api/courses/:id
// @access  Private (Dept Admin)
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Ensure it's the right department
    if (course.department.toString() !== req.user.department.toString() && req.user.role !== 'COLLEGE_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if course has sections
    const sectionsCount = await require('../models/Section').countDocuments({ course: course._id });
    if (sectionsCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete course with existing sections. Delete sections first.'
      });
    }

    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get course analytics
// @route   GET /api/courses/:id/analytics
// @access  Private (Dept Admin)
const getCourseAnalytics = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Ensure it's the right department
    if (course.department.toString() !== req.user.department.toString() && req.user.role !== 'COLLEGE_ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get all sections for this course
    const sections = await require('../models/Section').find({ course: course._id })
      .populate('instructor', 'name');

    // Get enrollment data
    const enrollments = await require('../models/Enrollment').countDocuments({
      course: course._id,
      status: 'ENROLLED'
    });

    // Get final grades for this course
    const finalGrades = await require('../models/FinalGrade').find({
      course: course._id,
      status: 'APPROVED'
    });

    // Calculate pass/fail rate
    let passCount = 0;
    let totalGrades = finalGrades.length;
    finalGrades.forEach(grade => {
      if (grade.gpaPoint > 0) passCount++;
    });
    const passRate = totalGrades > 0 ? ((passCount / totalGrades) * 100).toFixed(1) : 0;

    // Calculate average GPA
    const avgGPA = totalGrades > 0
      ? (finalGrades.reduce((sum, grade) => sum + grade.gpaPoint, 0) / totalGrades).toFixed(2)
      : 0;

    // Section utilization
    const sectionUtilization = sections.map(section => ({
      sectionName: section.sectionName,
      instructor: section.instructor?.name || 'Not Assigned',
      capacity: section.capacity,
      enrolled: 0, // Would need to calculate from enrollments
      utilization: 0, // Would need to calculate from enrollments
    }));

    res.json({
      course: course.title,
      code: course.code,
      sectionsCount: sections.length,
      totalEnrollments: enrollments,
      averageGPA: parseFloat(avgGPA),
      passRate: parseFloat(passRate),
      sections: sectionUtilization,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCourses,
  createCourse,
  updateCourse,
  toggleCourseStatus,
  deleteCourse,
  getCourseAnalytics,
};
