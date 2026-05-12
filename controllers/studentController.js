const Student = require('../models/Student');
const User = require('../models/User');
const College = require('../models/College');
const Course = require('../models/Course');
const Section = require('../models/Section');
const Enrollment = require('../models/Enrollment');
const FinalGrade = require('../models/FinalGrade');
const Clearance = require('../models/Clearance');
const { Semester } = require('../models/AcademicCalendar');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');

// @desc    Register a student manually
// @route   POST /api/students
// @access  Private (Registrar)
const registerStudent = async (req, res) => {
  const {
    studentId, name, email, phone, gender, dateOfBirth,
    collegeId, departmentId, academicYear, admissionYear, password
  } = req.body;

  console.log('Register Student Payload:', req.body);

  try {
    // Validate password
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password is required and must be at least 8 characters' });
    }

    // Find campus from college
    const college = await College.findById(collegeId);
    const campusId = college ? college.campus : null;

    // 1. Create User account first
    const user = await User.create({
      name,
      email,
      password, // Use provided password
      role: 'STUDENT',
      college: collegeId,
      department: departmentId,
      campus: campusId,
    });

    // 2. Create Student profile
    const student = await Student.create({
      user: user._id,
      studentId,
      phone,
      gender,
      dateOfBirth,
      college: collegeId,
      department: departmentId,
      campus: campusId,
      academicYear,
      admissionYear
    });

    const populatedStudent = await Student.findById(student._id)
      .populate('user', 'name email')
      .populate('department', 'name');

    res.status(201).json(populatedStudent);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `The ${field} is already registered. Please use a different one.` });
    }
    res.status(400).json({ message: error.message });
  }
};


// Helper to generate random password
function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#\$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// @desc    Bulk upload students
// @route   POST /api/students/bulk
// @access  Private (Registrar)
const bulkUploadStudents = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a file' });
  }

  const results = [];
  const errors = [];
  let successful = 0;

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Simple validation
        if (!row.studentId || !row.email || !row.name) {
          throw new Error('Missing required fields');
        }

        const password = row.password || generateRandomPassword();

        // Find campus from college
        const college = await College.findById(req.user.college);
        const campusId = college ? college.campus : null;

        // Create User & Student (password hashed by User pre-save hook)
        const user = await User.create({
          name: row.name,
          email: row.email,
          password: password,  // plain text — model hashes it
          role: 'STUDENT',
          college: req.user.college,
          department: row.departmentId,
          campus: campusId
        });

        await Student.create({
          user: user._id,
          studentId: row.studentId,
          college: req.user.college,
          department: row.departmentId,
          campus: campusId,
          academicYear: row.academicYear || 'Year 1',
          admissionYear: row.admissionYear || new Date().getFullYear(),
          gender: row.gender,
          phone: row.phone
        });

        successful++;
        // Include generated password in response for distribution
        results.push({
          studentId: row.studentId,
          email: row.email,
          password: row.password || password // Only return if generated or provided
        });
      } catch (err) {
        errors.push({ row: i + 2, error: err.message });
      }
    }

    if (errors.length > 0) {
      console.error('Bulk Upload Errors:', errors);
    }

    // Clean up file
    fs.unlinkSync(req.file.path);

    res.json({
      message: `${successful} students successfully registered.`,
      successful,
      failed: errors.length,
      errors,
      credentials: results // Return credentials for distribution
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all students for the college
// @route   GET /api/students
// @access  Private (Registrar, College Admin)
const getStudents = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'SUPER_ADMIN') {
      if (req.query.collegeId) {
        query.college = req.query.collegeId;
      }
      if (req.query.departmentId) {
        query.department = req.query.departmentId;
      }
    } else if (req.user.role === 'COLLEGE_ADMIN' || req.user.role === 'REGISTRAR') {
      query.college = req.user.college;
      if (req.query.departmentId) {
        query.department = req.query.departmentId;
      }
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const students = await Student.find(query)
      .populate('user', 'name email')
      .populate('department', 'name')
      .sort({ createdAt: -1 });
      
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const parseYearLevel = (academicYear) => {
  const match = String(academicYear || '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

const parseSemesterNumber = (semesterName) => {
  const match = String(semesterName || '').match(/\d+/);
  if (match) return Number(match[0]);

  const normalized = String(semesterName || '').toLowerCase();
  if (normalized.includes('first') || normalized.includes('one')) return 1;
  if (normalized.includes('second') || normalized.includes('two')) return 2;
  if (normalized.includes('third') || normalized.includes('three')) return 3;
  if (normalized.includes('summer')) return 3;
  return null;
};

const pickAvailableSection = async (courseId, semesterId, preferredSectionName = null, departmentId = null) => {
  const sections = await Section.find({ course: courseId, semester: semesterId }).sort({ sectionName: 1 });
  let bestSection = null;
  let bestCount = Number.MAX_SAFE_INTEGER;

  // 1. Try to place in the preferred section (if they were in "Section 1" before)
  if (preferredSectionName) {
    const preferredSection = sections.find(s => s.sectionName === preferredSectionName);
    if (preferredSection) {
      const enrolledCount = await Enrollment.countDocuments({
        section: preferredSection._id,
        semester: semesterId,
        status: 'Enrolled'
      });
      if (enrolledCount < preferredSection.capacity) {
        return { section: preferredSection, available: true };
      }
    }
  }

  // 2. Fallback: pick the section with the lowest enrollment (load balancing)
  for (const section of sections) {
    const enrolledCount = await Enrollment.countDocuments({
      section: section._id,
      semester: semesterId,
      status: 'Enrolled'
    });

    if (enrolledCount < section.capacity && enrolledCount < bestCount) {
      bestSection = section;
      bestCount = enrolledCount;
    }
  }

  if (bestSection) {
    return { section: bestSection, available: true };
  }

  // 3. AUTO-CREATE SECTION IF NONE AVAILABLE (Auto-Scaling)
  if (departmentId) {
    try {
      // Find any instructor or admin in the department to use as a placeholder
      const User = require('../models/User');
      const dummyInstructor = await User.findOne({ department: departmentId, role: { $in: ['INSTRUCTOR', 'DEPARTMENT_ADMIN'] } });
      
      if (dummyInstructor) {
        const sectionName = preferredSectionName || `Section ${sections.length + 1}`;
        const newSection = await Section.create({
          sectionName,
          course: courseId,
          semester: semesterId,
          instructor: dummyInstructor._id,
          classroom: 'TBA',
          capacity: 50, // Default scalable capacity
          department: departmentId,
          schedule: [{ day: 'Monday', startTime: '08:00', endTime: '10:00' }] // Placeholder schedule
        });
        return { section: newSection, available: true };
      }
    } catch (e) {
      console.error('Auto-create section failed:', e);
    }
  }

  return { section: sections[0] || null, available: false };
};

const verifyCoursePrerequisites = async (studentId, course) => {
  if (!course.prerequisites || course.prerequisites.length === 0) {
    return true;
  }

  const passedPrerequisiteIds = await FinalGrade.distinct('course', {
    student: studentId,
    course: { $in: course.prerequisites },
    status: { $in: ['APPROVED', 'LOCKED'] },
    gradePoint: { $gt: 0 }
  });

  return passedPrerequisiteIds.length === course.prerequisites.length;
};

const enrollStudentsForTargetSemester = async (students, targetSemester, semesterNumber) => {
  const summary = {
    attemptedStudents: students.length,
    createdEnrollments: 0,
    alreadyEnrolled: 0,
    missingSections: 0,
    fullSections: 0,
    missingCoursePlans: 0,
    skippedPrerequisites: 0,
    errors: []
  };

  const courseCache = new Map();

  for (const student of students) {
    const yearLevel = parseYearLevel(student.academicYear);
    if (!yearLevel || !semesterNumber) {
      summary.missingCoursePlans++;
      continue;
    }

    // Try to find what section the student was in previously
    const recentEnrollment = await Enrollment.findOne({ student: student._id })
      .sort({ createdAt: -1 })
      .populate('section');
    const preferredSectionName = recentEnrollment && recentEnrollment.section ? recentEnrollment.section.sectionName : null;

    const cacheKey = `${student.department}-${yearLevel}-${semesterNumber}`;
    let courses = courseCache.get(cacheKey);

    if (!courses) {
      courses = await Course.find({
        department: student.department,
        yearLevel,
        semester: semesterNumber,
        isActive: true
      }).sort({ code: 1 });
      courseCache.set(cacheKey, courses);
    }

    if (courses.length === 0) {
      summary.missingCoursePlans++;
      continue;
    }

    for (const course of courses) {
      try {
        const existingEnrollment = await Enrollment.findOne({
          student: student._id,
          course: course._id,
          semester: targetSemester._id
        });

        if (existingEnrollment) {
          summary.alreadyEnrolled++;
          continue;
        }

        const prerequisitesMet = await verifyCoursePrerequisites(student._id, course);
        if (!prerequisitesMet) {
          summary.skippedPrerequisites++;
          continue;
        }

        const { section, available } = await pickAvailableSection(course._id, targetSemester._id, preferredSectionName, student.department);
        if (!section) {
          summary.missingSections++;
          continue;
        }

        if (!available) {
          summary.fullSections++;
          continue;
        }

        await Enrollment.create({
          student: student._id,
          course: course._id,
          section: section._id,
          semester: targetSemester._id,
          status: 'Enrolled'
        });

        const refreshedCount = await Enrollment.countDocuments({
          section: section._id,
          semester: targetSemester._id,
          status: 'Enrolled'
        });
        section.enrolledCount = refreshedCount;
        await section.save();

        summary.createdEnrollments++;
      } catch (err) {
        if (err.code === 11000) {
          summary.alreadyEnrolled++;
        } else {
          summary.errors.push({
            studentId: student.studentId,
            courseCode: course.code,
            error: err.message
          });
        }
      }
    }
  }

  return summary;
};

// @desc    Bulk promote or transfer students and enroll them in target semester courses
// @route   PUT /api/students/promote
// @access  Private (Registrar)
const promoteStudents = async (req, res) => {
  const { mode = 'year', departmentId, currentYear, targetYear, targetSemesterId } = req.body;

  try {
    let targetSem = null;
    let semesterNumber = null;

    if (targetSemesterId) {
      targetSem = await Semester.findById(targetSemesterId);
      if (!targetSem) {
        return res.status(404).json({ message: 'Target semester not found' });
      }
      if (['Closed', 'Locked'].includes(targetSem.status)) {
        return res.status(400).json({ message: `Cannot enroll students into a ${targetSem.status.toLowerCase()} semester` });
      }
      semesterNumber = parseSemesterNumber(targetSem.name);
      if (!semesterNumber) {
        return res.status(400).json({ message: `Could not determine semester number from "${targetSem.name}"` });
      }
    }

    if (mode === 'year') {
      if (!departmentId || !currentYear || !targetYear) {
        return res.status(400).json({ message: 'Department, current year, and target year are required for year promotion' });
      }

      const students = await Student.find(
        {
          department: departmentId, 
          academicYear: currentYear,
          status: 'Active',
          college: req.user.college
        }
      );

      if (students.length === 0) {
        return res.status(404).json({ message: `No active students found in ${currentYear} for this department` });
      }

      await Student.updateMany(
        { _id: { $in: students.map((student) => student._id) } },
        {
          $set: {
            academicYear: targetYear,
            ...(targetSem ? { currentSemester: targetSem._id } : {})
          }
        }
      );

      const updatedStudents = students.map((student) => {
        student.academicYear = targetYear;
        if (targetSem) student.currentSemester = targetSem._id;
        return student;
      });

      const enrollmentSummary = targetSem
        ? await enrollStudentsForTargetSemester(updatedStudents, targetSem, semesterNumber)
        : null;

      return res.json({
        message: targetSem
          ? `Promoted ${students.length} students from ${currentYear} to ${targetYear} and created ${enrollmentSummary.createdEnrollments} enrollments for ${targetSem.name}`
          : `Successfully promoted ${students.length} students from ${currentYear} to ${targetYear}`,
        count: students.length,
        enrollmentSummary
      });
    } 
    
    if (mode === 'semester') {
      if (!departmentId || !targetSemesterId) {
        return res.status(400).json({ message: 'Department and target semester are required for semester transfer' });
      }

      const students = await Student.find(
        {
          department: departmentId, 
          status: 'Active',
          college: req.user.college
        }
      );

      if (students.length === 0) {
        return res.status(404).json({ message: 'No active students found for this department' });
      }

      await Student.updateMany(
        { _id: { $in: students.map((student) => student._id) } },
        { $set: { currentSemester: targetSem._id } }
      );

      students.forEach((student) => {
        student.currentSemester = targetSem._id;
      });

      const enrollmentSummary = await enrollStudentsForTargetSemester(students, targetSem, semesterNumber);

      return res.json({
        message: `Transferred ${students.length} students to ${targetSem.name} and created ${enrollmentSummary.createdEnrollments} enrollments`,
        count: students.length,
        enrollmentSummary
      });
    }

    return res.status(400).json({ message: 'Invalid promotion mode' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get students at risk (academic status != Good Standing)
// @route   GET /api/students/at-risk
// @access  Private (Registrar)
const getAtRiskStudents = async (req, res) => {
  try {
    const students = await Student.find({ 
      college: req.user.college,
      academicStatus: { $ne: 'Good Standing' } 
    })
    .populate('user', 'name email')
    .populate('department', 'name')
    .sort({ academicStatus: 1 }); // Sort by severity

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Perform degree audit for a student
// @route   GET /api/students/:id/audit
// @access  Private (Registrar)
const getDegreeAudit = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', 'name')
      .populate('department', 'name');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Security Check: If the user is a student, they can only view their own audit
    if (req.user.role === 'STUDENT' && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied. You can only view your own degree audit.' });
    }

    // 1. Get all courses required for this department
    const Course = require('../models/Course');
    const requiredCourses = await Course.find({ 
      department: student.department._id,
      isActive: true 
    });

    // 2. Get student's completed grades
    const completedGrades = await FinalGrade.find({
      student: student._id,
      status: { $in: ['APPROVED', 'LOCKED'] }
    }).populate('course');

    // --- SUBSTITUTION LOGIC ---
    const CourseSubstitution = require('../models/CourseSubstitution');
    const substitutions = await CourseSubstitution.find({ student: student._id, isActive: true });
    
    // Create a map of required course ID -> substituted with course ID
    const subMap = new Map();
    substitutions.forEach(s => subMap.set(s.requiredCourse.toString(), s.substitutedWith.toString()));
    // --------------------------

    // 3. Match completed against required (including substitutions)
    const completedCourseIds = completedGrades.map(g => g.course._id.toString());
    
    const missingCourses = requiredCourses.filter(c => {
      const courseId = c._id.toString();
      // If the course is completed, it's not missing
      if (completedCourseIds.includes(courseId)) return false;
      
      // If there's a substitution and the substitute is completed, it's not missing
      if (subMap.has(courseId)) {
        const substituteId = subMap.get(courseId);
        if (completedCourseIds.includes(substituteId)) return false;
      }
      
      return true;
    });

    const totalRequiredCredits = requiredCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
    const totalEarnedCredits = completedGrades.reduce((sum, g) => sum + (g.credits || 0), 0);

    const audit = {
      student: {
        id: student.studentId,
        name: student.user.name,
        department: student.department.name,
        cgpa: student.cgpa || 0,
      },
      stats: {
        totalRequiredCourses: requiredCourses.length,
        completedCoursesCount: completedGrades.length,
        missingCoursesCount: missingCourses.length,
        totalRequiredCredits,
        totalEarnedCredits,
        completionPercentage: requiredCourses.length > 0 ? Math.round((completedGrades.length / requiredCourses.length) * 100) : 0
      },
      missingCourses: missingCourses.map(c => ({
        code: c.code,
        title: c.title,
        credits: c.credits
      })),
      completedCourses: completedGrades.map(g => ({
        code: g.course.code,
        title: g.course.title,
        grade: g.gradeLetter,
        credits: g.credits
      })),
      isEligibleForGraduation: missingCourses.length === 0 && (student.cgpa || 0) >= 2.0
    };

    res.json(audit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk perform degree audits and clearance checks for a group of students
// @route   GET /api/students/bulk-audit
// @access  Private (Registrar)
const getBulkClearanceAudit = async (req, res) => {
  const { departmentId, academicYear } = req.query;

  try {
    const query = { college: req.user.college };
    if (departmentId) query.department = departmentId;
    if (academicYear) query.academicYear = academicYear;

    const students = await Student.find(query)
      .populate('user', 'name')
      .populate('department', 'name');

    if (students.length === 0) {
      return res.json([]);
    }

    const results = [];
    
    // Get all required courses for these departments once to avoid repeated DB calls
    const departments = [...new Set(students.map(s => s.department._id.toString()))];
    const Course = require('../models/Course');
    const allRequiredCourses = await Course.find({ 
      department: { $in: departments },
      isActive: true 
    });

    for (const student of students) {
      // 1. Academic Audit
      const studentRequired = allRequiredCourses.filter(c => c.department.toString() === student.department._id.toString());
      const completedGrades = await FinalGrade.find({
        student: student._id,
        status: { $in: ['APPROVED', 'LOCKED'] }
      }).populate('course');

      const completedCourseIds = completedGrades.map(g => g.course._id.toString());
      const missingCount = studentRequired.filter(c => !completedCourseIds.includes(c._id.toString())).length;
      
      const totalEarnedCredits = completedGrades.reduce((sum, g) => sum + (g.credits || 0), 0);
      const academicEligible = missingCount === 0 && (student.cgpa || 0) >= 2.0;

      // 2. Administrative Clearance
      const clearance = await Clearance.findOne({ 
        student: student.user._id, 
        type: 'GRADUATION' 
      });

      results.push({
        _id: student._id,
        studentId: student.studentId,
        name: student.user.name,
        department: student.department.name,
        cgpa: student.cgpa || 0,
        credits: totalEarnedCredits,
        missingCourses: missingCount,
        academicEligible,
        clearanceStatus: clearance ? clearance.status : 'NOT_STARTED',
        steps: clearance ? {
          library: clearance.steps.library.status,
          department: clearance.steps.department.status,
          proctor: clearance.steps.proctor.status,
          dean: clearance.steps.dean.status,
          registrar: clearance.steps.registrar.status
        } : null,
        isReadyForGraduation: academicEligible && clearance && clearance.status === 'CLEARED'
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export bulk clearance audit to Excel
// @route   GET /api/students/bulk-audit/export
// @access  Private (Registrar)
const exportBulkAudit = async (req, res) => {
  const { departmentId, academicYear } = req.query;

  try {
    const query = { college: req.user.college };
    if (departmentId) query.department = departmentId;
    if (academicYear) query.academicYear = academicYear;

    const students = await Student.find(query)
      .populate('user', 'name email')
      .populate('department', 'name');

    if (students.length === 0) {
      return res.status(404).json({ message: 'No students found' });
    }

    const Clearance = require('../models/Clearance');
    const xlsx = require('xlsx');

    const data = [];
    
    for (const student of students) {
      const clearance = await Clearance.findOne({ 
        student: student.user._id, 
        type: 'GRADUATION' 
      });

      data.push({
        'Student ID': student.studentId,
        'Name': student.user.name,
        'Email': student.user.email,
        'Department': student.department.name,
        'CGPA': student.cgpa || 0,
        'Clearance Status': clearance ? clearance.status : 'NOT_STARTED',
        'Library': clearance ? clearance.steps.library.status : '-',
        'Department Clearance': clearance ? clearance.steps.department.status : '-',
        'Proctor': clearance ? clearance.steps.proctor.status : '-',
        'Dean': clearance ? clearance.steps.dean.status : '-',
        'Registrar': clearance ? clearance.steps.registrar.status : '-'
      });
    }

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Graduation Audit');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Graduation_Audit.xlsx');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a course substitution for a student
// @route   POST /api/students/:id/substitutions
// @access  Private (Registrar)
const addSubstitution = async (req, res) => {
  const { requiredCourseId, substitutedWithId, reason } = req.body;

  try {
    const CourseSubstitution = require('../models/CourseSubstitution');
    const substitution = await CourseSubstitution.create({
      student: req.params.id,
      requiredCourse: requiredCourseId,
      substitutedWith: substitutedWithId,
      approvedBy: req.user._id,
      reason
    });

    res.status(201).json(substitution);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Substitution already exists for this required course' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get substitutions for a student
// @route   GET /api/students/:id/substitutions
// @access  Private
const getSubstitutions = async (req, res) => {
  try {
    const CourseSubstitution = require('../models/CourseSubstitution');
    const substitutions = await CourseSubstitution.find({ student: req.params.id, isActive: true })
      .populate('requiredCourse', 'code title')
      .populate('substitutedWith', 'code title')
      .populate('approvedBy', 'name');

    res.json(substitutions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update student medical profile
// @route   PUT /api/students/medical-profile
// @access  Private (Student)
const updateMedicalProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.medicalProfile = {
      ...req.body,
      lastUpdated: new Date()
    };

    await student.save();
    res.json(student.medicalProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update student dormitory profile (habits/preferences)
// @route   PUT /api/students/dormitory-profile
// @access  Private (Student)
const updateDormitoryProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const {
      isSmoker,
      sleepHabit,
      studyHabit,
      interests,
      preferredGender
    } = req.body;

    // Validate enum values if provided
    if (sleepHabit && !['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE'].includes(sleepHabit)) {
      return res.status(400).json({ message: 'Invalid sleepHabit' });
    }
    if (studyHabit && !['QUIET', 'SOCIAL', 'FLEXIBLE'].includes(studyHabit)) {
      return res.status(400).json({ message: 'Invalid studyHabit' });
    }
    if (preferredGender && !['MALE', 'FEMALE', 'NONE'].includes(preferredGender)) {
      return res.status(400).json({ message: 'Invalid preferredGender' });
    }

    // Update dormitoryProfile
    student.dormitoryProfile = {
      ...student.dormitoryProfile,
      ...(isSmoker !== undefined && { isSmoker }),
      ...(sleepHabit && { sleepHabit }),
      ...(studyHabit && { studyHabit }),
      ...(interests && { interests }),
      ...(preferredGender && { preferredGender })
    };

    await student.save();

    const updatedStudent = await Student.findById(student._id)
      .populate('user', 'name email')
      .populate('department', 'name');

    res.json(updatedStudent.dormitoryProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update student status
// @route   PATCH /api/students/:id/status
// @access  Private (Registrar)
const updateStudentStatus = async (req, res) => {
  const { status, reason } = req.body;

  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.status = status;
    student.statusHistory.push({
      status,
      reason,
      changedBy: req.user._id,
      date: Date.now()
    });

    await student.save();
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search students by ID or name
// @route   GET /api/students/search
// @access  Private (Registrar)
const searchStudents = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    console.log('[DEBUG] Searching for students with query:', q);

    // 1. Try search by studentId
    let students = await Student.find({
      studentId: { $regex: q, $options: 'i' }
    })
    .populate('user', 'name email')
    .populate('department', 'name')
    .limit(10);

    // 2. If not found by ID, search by User name
    if (students.length === 0) {
      const users = await User.find({
        name: { $regex: q, $options: 'i' },
        role: 'STUDENT'
      }).select('_id');

      const userIds = users.map(u => u._id);
      students = await Student.find({ user: { $in: userIds } })
        .populate('user', 'name email')
        .populate('department', 'name')
        .limit(10);
    }

    res.json(students);
  } catch (error) {
    console.error('searchStudents Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  registerStudent, 
  bulkUploadStudents, 
  getStudents, 
  promoteStudents, 
  getAtRiskStudents,
  getDegreeAudit,
  getBulkClearanceAudit,
  exportBulkAudit,
  addSubstitution,
  getSubstitutions,
  updateMedicalProfile,
  updateDormitoryProfile,
  searchStudents,
  updateStudentStatus
};
