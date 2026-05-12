const mongoose = require('mongoose');
const FinalGrade = require('../models/FinalGrade');
const Grade = require('../models/Grade');
const GradingComponent = require('../models/GradingComponent');
const GradeAuditLog = require('../models/GradeAuditLog');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const { Semester } = require('../models/AcademicCalendar');
const {
  calculateTotalScore,
  convertScoreToGrade,
  getEffectivePolicy,
  calculateAcademicStatus,
  isSubmittable,
  isDepartmentApprovable,
  isRegistrarApprovable,
  isLocked,
  isGradeEditable,
} = require('../utils/gradeCalculator');

// @desc    Calculate and create/update final grade for a student in a section
// @route   POST /api/final-grades/calculate
// @access  Private (Instructor)
const calculateFinalGrade = async (req, res) => {
  try {
    const { studentId, courseId, sectionId, semesterId } = req.body;

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
      section: sectionId,
    });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    // Get course to determine policy context
    const course = await Course.findById(courseId).populate('college');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get effective academic policy
    const policy = await getEffectivePolicy(course.college.campus, course.college._id);

    // Get all component grades for this student in this section
    const grades = await Grade.find({
      student: studentId,
      course: courseId,
      section: sectionId,
    }).populate('component');

    // Get grading components for the course
    const components = await GradingComponent.find({
      course: courseId,
      isActive: true,
    });

    // Calculate total weighted score
    const gradeData = grades.map((g) => ({
      score: g.score,
      weight: g.component.weight,
      maxScore: g.component.maxScore,
      name: g.component.name, // Added for policy matching
    }));

    const totalScore = calculateTotalScore(gradeData, policy);

    // Convert to letter grade and GPA using policy
    const { gradeLetter, gpaPoint } = convertScoreToGrade(totalScore, policy);

    // Find or create final grade
    let finalGrade = await FinalGrade.findOne({
      student: studentId,
      course: courseId,
      section: sectionId,
      semester: semesterId,
    });

    if (finalGrade) {
      // Update existing
      finalGrade.totalScore = totalScore;
      finalGrade.gradeLetter = gradeLetter;
      finalGrade.gpaPoint = gpaPoint;
      // Status remains unchanged unless explicitly changed
      await finalGrade.save();
    } else {
      // Create new final grade in DRAFT status
      finalGrade = await FinalGrade.create({
        student: studentId,
        course: courseId,
        section: sectionId,
        semester: semesterId,
        totalScore,
        gradeLetter,
        gpaPoint,
        status: 'DRAFT',
      });
    }

    res.json({
      message: 'Final grade calculated',
      finalGrade,
      breakdown: {
        totalScore,
        gradeLetter,
        gpaPoint,
        componentCount: grades.length,
      },
    });
  } catch (error) {
    console.error('calculateFinalGrade error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auto-calculate final grades for all students in a section
// @route   POST /api/final-grades/calculate-section/:sectionId
// @access  Private (Instructor)
const calculateSectionGrades = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { semesterId } = req.body;

    // Verify section
    const section = await Section.findById(sectionId).populate({
      path: 'course',
      populate: { path: 'college', populate: 'campus' }
    });
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Verify instructor owns this section
    if (!section.instructor.equals(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get effective academic policy
    const policy = await getEffectivePolicy(
      section.course.college.campus._id,
      section.course.college._id
    );

    // Get all enrolled students for this specific section AND semester
    const enrollments = await Enrollment.find({ 
      section: sectionId,
      semester: semesterId || section.semester
    });
    if (enrollments.length === 0) {
      return res.json({ message: 'No students enrolled', calculated: 0 });
    }

    const results = [];
    const errors = [];

    for (const enrollment of enrollments) {
      try {
        const grades = await Grade.find({
          student: enrollment.student,
          course: section.course,
          section: sectionId,
          semester: semesterId || enrollment.semester,
        }).populate('component');

        const components = await GradingComponent.find({
          course: section.course,
          isActive: true,
        });

        const gradeData = grades
          .filter(g => g.component != null) // Guard: skip if component not populated
          .map((g) => ({
            score: g.score,
            weight: g.component.weight,
            maxScore: g.component.maxScore,
            name: g.component.name, // Added for policy matching
          }));

        const totalScore = calculateTotalScore(gradeData, policy);
        const { gradeLetter, gpaPoint } = convertScoreToGrade(totalScore, policy);

        let finalGrade = await FinalGrade.findOne({
          student: enrollment.student,
          course: section.course,
          section: sectionId,
          semester: semesterId || enrollment.semester,
        });

        if (finalGrade) {
          finalGrade.totalScore = totalScore;
          finalGrade.gradeLetter = gradeLetter;
          finalGrade.gpaPoint = gpaPoint;
          await finalGrade.save();
        } else {
          finalGrade = await FinalGrade.create({
            student: enrollment.student,
            course: section.course,
            section: sectionId,
            semester: semesterId || enrollment.semester,
            totalScore,
            gradeLetter,
            gpaPoint,
            status: 'DRAFT',
          });
        }

        results.push({
          studentId: enrollment.student,
          totalScore,
          gradeLetter,
          gpaPoint,
        });
      } catch (err) {
        errors.push({ student: enrollment.student, error: err.message });
      }
    }

    res.json({
      message: `Calculated grades for ${results.length} students`,
      calculated: results.length,
      errors: errors.length,
      results,
    });
  } catch (error) {
    console.error('calculateSectionGrades error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit grades for a section (Instructor -> Dept Admin)
// @route   POST /api/final-grades/submit-section/:sectionId
// @access  Private (Instructor)
const submitSectionGrades = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { semesterId } = req.body;

    const section = await Section.findById(sectionId).populate({
      path: 'course',
      populate: { path: 'college', populate: 'campus' }
    });
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (!section.instructor.equals(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if grading is allowed for the semester
    const semester = await Semester.findById(semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    if (!['Active', 'Closed'].includes(semester.status)) {
      return res.status(400).json({
        message: `Grade submission is not allowed. Semester status: ${semester.status}. Grading is only allowed for Active or Closed semesters.`
      });
    }

    // Get effective academic policy
    const policy = await getEffectivePolicy(
      section.course.college.campus._id,
      section.course.college._id
    );

    // Get all final grades for this section in DRAFT status
    const draftGrades = await FinalGrade.find({
      section: sectionId,
      semester: semesterId,
      status: 'DRAFT',
    });

    if (draftGrades.length === 0) {
      return res.status(400).json({ message: 'No draft grades found to submit' });
    }

    // Validate all grades have required components
    const components = await GradingComponent.find({
      course: section.course,
      isActive: true,
    });

    const requiredComponents = components.filter((c) => c.isRequired);
    const updatedCount = [];
    const skippedCount = [];

    for (const fg of draftGrades) {
      // Check all required grades are entered
      const studentGrades = await Grade.find({
        student: fg.student,
        course: section.course,
        section: sectionId,
        semester: semesterId,
      }).populate('component');

      const enteredComponentIds = studentGrades.map((g) => g.component._id.toString());
      const missingRequired = requiredComponents.filter(
        (c) => !enteredComponentIds.includes(c._id.toString())
      );

      // Skip students with missing required grades (don't block the whole submission)
      if (missingRequired.length > 0) {
        skippedCount.push({
          student: fg.student,
          missingComponents: missingRequired.map((c) => c.name),
        });
        continue;
      }

      // Recalculate (in case of updates)
      const gradeData = studentGrades.map((g) => ({
        score: g.score,
        weight: g.component.weight,
        maxScore: g.component.maxScore,
      }));
      const totalScore = calculateTotalScore(gradeData);
      const { gradeLetter, gpaPoint } = convertScoreToGrade(totalScore, policy);

      fg.totalScore = totalScore;
      fg.gradeLetter = gradeLetter;
      fg.gpaPoint = gpaPoint;
      fg.status = 'SUBMITTED';
      fg.submittedBy = req.user._id;
      fg.submittedAt = new Date();

      await fg.save();

      // Audit log
      await GradeAuditLog.create({
        finalGrade: fg._id,
        user: req.user._id,
        action: 'SUBMIT',
        oldValue: { status: 'DRAFT' },
        newValue: { status: 'SUBMITTED', totalScore, gradeLetter },
        reason: 'Instructor submitted grades for review',
      });

      updatedCount.push(fg._id);
    }

    if (updatedCount.length === 0 && skippedCount.length > 0) {
      return res.status(400).json({
        message: `Submission failed: ${skippedCount.length} students have missing required grades.`,
        skipped: skippedCount,
      });
    }

    res.json({
      message: `Successfully submitted ${updatedCount.length} grades${skippedCount.length > 0 ? `, but skipped ${skippedCount.length} students with missing grades` : ''}`,
      submittedCount: updatedCount.length,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error('submitSectionGrades error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Department Admin reviews and approves/rejects grades
// @route   PUT /api/final-grades/dept-approval/:finalGradeId
// @access  Private (Department Admin)
const departmentApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, remark } = req.body;
    console.log('departmentApproval called with id:', id, 'approved:', approved);

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ message: 'Approved field is required (true/false)' });
    }

    const finalGrade = await FinalGrade.findById(id);
    if (!finalGrade) {
      return res.status(404).json({ message: 'Final grade not found' });
    }

    // Verify dept admin can only approve from their department
    if (!req.user.department) {
      return res.status(403).json({ message: 'Department assignment not found for this admin' });
    }
    const adminDeptId = req.user.department;

    // Verify the course belongs to admin's department
    const course = await Course.findById(finalGrade.course);
    if (!course || !course.department.equals(adminDeptId)) {
      return res.status(403).json({ message: 'Cannot approve grades outside your department' });
    }

    // Check if grade is in SUBMITTED status
    if (!isDepartmentApprovable(finalGrade.status)) {
      return res.status(400).json({
        message: `Grade is not in submittable state. Current status: ${finalGrade.status}`,
      });
    }

    const oldStatus = finalGrade.status;

    if (approved) {
      finalGrade.status = 'DEPARTMENT_APPROVED';
      finalGrade.departmentApprovedBy = req.user._id;
      finalGrade.departmentApprovedAt = new Date();
      if (remark) finalGrade.departmentRemark = remark;
    } else {
      finalGrade.status = 'REJECTED';
      if (remark) finalGrade.departmentRemark = remark;
    }

    await finalGrade.save();

    // Audit log
    await GradeAuditLog.create({
      finalGrade: id,
      user: req.user._id,
      action: approved ? 'DEPARTMENT_APPROVE' : 'DEPARTMENT_REJECT',
      oldValue: { status: oldStatus },
      newValue: { status: finalGrade.status },
      reason: remark || (approved ? 'Department approved' : 'Department rejected'),
    });

    res.json({
      message: approved ? 'Grade approved by department' : 'Grade rejected by department',
      finalGrade,
    });
  } catch (error) {
    console.error('departmentApproval error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk Department Admin approval
// @route   PUT /api/final-grades/bulk-dept-approval
// @access  Private (Department Admin)
const bulkDepartmentApproval = async (req, res) => {
  try {
    const { gradeIds, remark } = req.body;

    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
      return res.status(400).json({ message: 'gradeIds array is required' });
    }

    if (!req.user.department) {
      return res.status(403).json({ message: 'Department assignment not found' });
    }
    const adminDeptId = req.user.department;

    const results = [];
    const errors = [];

    for (const id of gradeIds) {
      try {
        const finalGrade = await FinalGrade.findById(id).populate('course');
        if (!finalGrade) {
          errors.push({ id, error: 'Grade not found' });
          continue;
        }

        // Verify department
        if (!finalGrade.course.department.equals(adminDeptId)) {
          errors.push({ id, error: 'Not authorized for this department' });
          continue;
        }

        // Check status
        if (!isDepartmentApprovable(finalGrade.status)) {
          errors.push({ id, error: `Invalid status: ${finalGrade.status}` });
          continue;
        }

        const oldStatus = finalGrade.status;
        finalGrade.status = 'DEPARTMENT_APPROVED';
        finalGrade.departmentApprovedBy = req.user._id;
        finalGrade.departmentApprovedAt = new Date();
        if (remark) finalGrade.departmentRemark = remark;

        await finalGrade.save();

        // Audit log
        await GradeAuditLog.create({
          finalGrade: id,
          user: req.user._id,
          action: 'DEPARTMENT_APPROVE',
          oldValue: { status: oldStatus },
          newValue: { status: 'DEPARTMENT_APPROVED' },
          reason: remark || 'Bulk department approved',
        });

        results.push(id);
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }

    res.json({
      message: `Processed bulk approval: ${results.length} succeeded, ${errors.length} failed`,
      successCount: results.length,
      failedCount: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('bulkDepartmentApproval error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Registrar final approval and lock
// @route   PUT /api/final-grades/registrar-approve/:finalGradeId
// @access  Private (REGISTRAR)
const registrarApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { override, remark } = req.body;

    const finalGrade = await FinalGrade.findById(id);
    if (!finalGrade) {
      return res.status(404).json({ message: 'Final grade not found' });
    }

    // Check if grade is ready for registrar approval
    if (!isRegistrarApprovable(finalGrade.status)) {
      return res.status(400).json({
        message: `Grade not ready for registrar approval. Current status: ${finalGrade.status}`,
      });
    }

    const oldStatus = finalGrade.status;

    if (override === true) {
      // Registrar override (rare, with audit)
      finalGrade.status = 'APPROVED';
      finalGrade.lockedBy = req.user._id;
      finalGrade.lockedAt = new Date();
      if (remark) finalGrade.moderationReason = remark;
      finalGrade.isGradeModerationApplied = true;

      await GradeAuditLog.create({
        finalGrade: id,
        user: req.user._id,
        action: 'OVERRIDE',
        oldValue: { status: oldStatus },
        newValue: { status: 'APPROVED', moderation: remark },
        reason: remark || 'Registrar override',
      });
    } else {
      // Normal approval
      finalGrade.status = 'APPROVED';
      finalGrade.approvedBy = req.user._id;
      finalGrade.approvedAt = new Date();

      await GradeAuditLog.create({
        finalGrade: id,
        user: req.user._id,
        action: 'REGISTRAR_APPROVE',
        oldValue: { status: oldStatus },
        newValue: { status: 'APPROVED' },
        reason: remark || 'Final approval by registrar',
      });
    }

    await finalGrade.save();

    res.json({
      message: 'Grade finalized and approved',
      finalGrade,
    });
  } catch (error) {
    console.error('registrarApproval error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk Registrar approval
// @route   PUT /api/final-grades/bulk-registrar-approve
// @access  Private (REGISTRAR)
const bulkRegistrarApproval = async (req, res) => {
  try {
    const { gradeIds, remark } = req.body;
    console.log('bulkRegistrarApproval called with', gradeIds?.length, 'grades');

    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
      return res.status(400).json({ message: 'gradeIds array is required' });
    }

    const results = [];
    const errors = [];

    for (const id of gradeIds) {
      try {
        const finalGrade = await FinalGrade.findById(id);
        if (!finalGrade) {
          errors.push({ id, error: 'Grade not found' });
          continue;
        }

        // Check status
        if (!isRegistrarApprovable(finalGrade.status)) {
          errors.push({ id, error: `Invalid status: ${finalGrade.status}` });
          continue;
        }

        const oldStatus = finalGrade.status;
        finalGrade.status = 'APPROVED';
        finalGrade.approvedBy = req.user._id;
        finalGrade.approvedAt = new Date();

        await finalGrade.save();

        // Audit log
        await GradeAuditLog.create({
          finalGrade: id,
          user: req.user._id,
          action: 'REGISTRAR_APPROVE',
          oldValue: { status: oldStatus },
          newValue: { status: 'APPROVED' },
          reason: remark || 'Bulk final approval by registrar',
        });

        results.push(id);
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }

    res.json({
      message: `Processed bulk registrar approval: ${results.length} succeeded, ${errors.length} failed`,
      successCount: results.length,
      failedCount: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('bulkRegistrarApproval error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get final grades with filters
// @route   GET /api/final-grades
// @access  Private (Instructor, Department Admin, Registrar)
const getFinalGrades = async (req, res) => {
  try {
    const {
      sectionId,
      courseId,
      semesterId,
      status,
      studentId,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    // Role-based filtering
    if (req.user.role === 'INSTRUCTOR') {
      // Instructor can only see their own sections
      const taughtSections = await Section.find({ instructor: req.user._id }).distinct('_id');
      filter.section = { $in: taughtSections };
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      // Dept admin sees only their department's grades
      if (!req.user.department) {
        return res.status(403).json({ message: 'Department assignment not found' });
      }
      const deptCourses = await Course.find({ department: req.user.department }).distinct('_id');
      filter.course = { $in: deptCourses };
    }
    // REGISTRAR sees all

    // Apply query filters
    if (sectionId) filter.section = sectionId;
    if (courseId) filter.course = courseId;
    if (semesterId) filter.semester = semesterId;
    if (status) filter.status = status;
    if (studentId) filter.student = studentId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const finalGrades = await FinalGrade.find(filter)
      .populate({
        path: 'student',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('course', 'code title credits')
      .populate('section', 'sectionName')
      .populate({
        path: 'semester',
        select: 'name code academicYear',
        populate: {
          path: 'academicYear',
          select: 'name',
        },
      })
      .populate('submittedBy', 'name email')
      .populate('departmentApprovedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FinalGrade.countDocuments(filter);

    res.json({
      finalGrades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getFinalGrades error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single final grade
// @route   GET /api/final-grades/:id
// @access  Private (Instructor, Department Admin, Registrar, Student)
const getFinalGrade = async (req, res) => {
  try {
    const finalGrade = await FinalGrade.findById(req.params.id)
      .populate({
        path: 'student',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('course', 'code title credits')
      .populate('section', 'sectionName')
      .populate({
        path: 'semester',
        select: 'name code academicYear',
        populate: {
          path: 'academicYear',
          select: 'name',
        },
      })
      .populate('submittedBy', 'name email')
      .populate('departmentApprovedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('lockedBy', 'name email');

    if (!finalGrade) {
      return res.status(404).json({ message: 'Final grade not found' });
    }

    // Authorization
    if (req.user.role === 'STUDENT') {
      const student = await Student.findOne({ user: req.user._id });
      if (!student || !finalGrade.student.equals(student._id)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      // Students can only see APPROVED or LOCKED grades
      if (!['APPROVED', 'LOCKED'].includes(finalGrade.status)) {
        return res.status(403).json({ message: 'Grade not yet available' });
      }
    } else if (req.user.role === 'INSTRUCTOR') {
      const section = await Section.findById(finalGrade.section);
      if (!section || !section.instructor.equals(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    res.json(finalGrade);
  } catch (error) {
    console.error('getFinalGrade error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get audit logs for a final grade
// @route   GET /api/final-grades/:id/audit
// @access  Private (Department Admin, Registrar)
const getGradeAudit = async (req, res) => {
  try {
    const finalGrade = await FinalGrade.findById(req.params.id);
    if (!finalGrade) {
      return res.status(404).json({ message: 'Final grade not found' });
    }

    const auditLogs = await GradeAuditLog.find({ finalGrade: finalGrade._id })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json(auditLogs);
  } catch (error) {
    console.error('getGradeAudit error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Calculate GPA for a student
// @route   GET /api/final-grades/gpa/:studentId
// @access  Private (Student, Registrar)
const calculateStudentGPA = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semesterId } = req.query;

    // Authorization
    if (req.user.role === 'STUDENT') {
      const student = await Student.findOne({ user: req.user._id });
      if (!student || !student._id.equals(studentId)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    const filter = { 
      student: new mongoose.Types.ObjectId(studentId), 
      status: { $in: ['APPROVED', 'LOCKED'] } 
    };
    
    if (semesterId && semesterId !== 'all') {
      filter.semester = new mongoose.Types.ObjectId(semesterId);
    }

    const finalGrades = await FinalGrade.find(filter)
      .populate('course', 'code title credits');

    if (finalGrades.length === 0) {
      return res.json({ gpa: 0, totalCredits: 0, courses: [] });
    }

    let totalPoints = 0;
    let totalCredits = 0;

    const courses = finalGrades.map((fg) => {
      const credits = fg.course?.credits || 3;
      totalPoints += fg.gpaPoint * credits;
      totalCredits += credits;
      return {
        course: fg.course,
        gradeLetter: fg.gradeLetter,
        gpaPoint: fg.gpaPoint,
        credits,
      };
    });

    const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

    // Get student to update academic status
    const student = await Student.findById(studentId).populate('college');
    if (student) {
      // Get policy for academic status rules
      const policy = await getEffectivePolicy(student.college?.campus, student.college?._id);

      // For now, assume good attendance for GPA calculation
      // TODO: Calculate actual attendance percentage
      const attendancePercentage = 80; // Placeholder

      const academicStatus = calculateAcademicStatus(gpa, attendancePercentage, policy);

      // Update student's academic status
      student.academicStatus = academicStatus;
      await student.save();
    }

    res.json({
      gpa: Math.round(gpa * 100) / 100,
      totalCredits,
      courses,
      academicStatus: student?.academicStatus,
    });
  } catch (error) {
    console.error('calculateStudentGPA error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Additional helper: Get all grades for a student (student dashboard)
 */
const getStudentGrades = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const finalGrades = await FinalGrade.find({
      student: student._id,
      status: { $in: ['APPROVED', 'LOCKED'] },
    })
      .populate('course', 'code title credits')
      .populate('section', 'sectionName')
      .populate({
        path: 'semester',
        select: 'name code academicYear',
        populate: {
          path: 'academicYear',
          select: 'name',
        },
      })
      .sort({ createdAt: -1 });

    res.json(finalGrades);
  } catch (error) {
    console.error('getStudentGrades error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get detailed student transcript data (All semesters, grouped)
// @route   GET /api/final-grades/transcript/:studentId
// @access  Private (Registrar, Student)
const getStudentTranscriptData = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
      .populate('user', 'name')
      .populate('college', 'name code campus')
      .populate('department', 'name');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (req.user.role === 'STUDENT' && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view transcript for another student' });
    }

    const grades = await FinalGrade.find({ 
      student: student._id, 
      status: 'APPROVED' 
    })
    .populate('course', 'code title credits')
    .populate({
      path: 'semester',
      select: 'name academicYear',
      populate: { path: 'academicYear', select: 'name' }
    })
    .sort({ 'semester.academicYear.name': 1, 'semester.name': 1 });

    // Group by academic year and semester for the report
    const academicHistory = {};
    
    let cumulativePoints = 0;
    let cumulativeCredits = 0;

    for (const g of grades) {
      const yearName = g.semester?.academicYear?.name || 'Unknown Year';
      const semesterName = g.semester?.name || 'Unknown Semester';
      
      if (!academicHistory[yearName]) academicHistory[yearName] = {};
      if (!academicHistory[yearName][semesterName]) {
        academicHistory[yearName][semesterName] = {
          grades: [],
          semesterGPA: 0,
          semesterCredits: 0
        };
      }

      const credits = g.course?.credits || 3;
      academicHistory[yearName][semesterName].grades.push({
        courseCode: g.course?.code,
        courseTitle: g.course?.title,
        credits,
        gradeLetter: g.gradeLetter,
        gpaPoint: g.gpaPoint
      });

      academicHistory[yearName][semesterName].semesterCredits += credits;
      cumulativeCredits += credits;
      cumulativePoints += (g.gpaPoint * credits);
    }

    // Calculate GPAs
    for (const year in academicHistory) {
      for (const sem in academicHistory[year]) {
        const s = academicHistory[year][sem];
        let sPoints = s.grades.reduce((sum, g) => sum + (g.gpaPoint * g.credits), 0);
        s.semesterGPA = s.semesterCredits > 0 ? parseFloat((sPoints / s.semesterCredits).toFixed(2)) : 0;
      }
    }

    const cgpa = cumulativeCredits > 0 ? parseFloat((cumulativePoints / cumulativeCredits).toFixed(2)) : 0;

    res.json({
      student: {
        id: student.studentId,
        name: student.user?.name,
        college: student.college?.name,
        department: student.department?.name,
        admissionYear: student.admissionYear
      },
      academicHistory,
      summary: {
        totalCredits: cumulativeCredits,
        cgpa
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// (Duplicate removed - getStudentGrades defined above)

// @desc    Calculate GPA for all students (bulk)
// @route   GET /api/final-grades/bulk-gpa
// @access  Private (Registrar)
const getBulkGPA = async (req, res) => {
  const { departmentId, academicYear, semesterId } = req.query;

  try {
    const studentFilter = { college: req.user.college, status: 'Active' };
    if (departmentId) studentFilter.department = departmentId;
    if (academicYear) studentFilter.academicYear = academicYear;

    const students = await Student.find(studentFilter).populate('user', 'name');
    
    const results = [];

    for (const student of students) {
      const gradeFilter = { student: student._id, status: 'APPROVED' };
      if (semesterId) gradeFilter.semester = semesterId;

      const finalGrades = await FinalGrade.find(gradeFilter).populate('course', 'credits');
      
      let totalPoints = 0;
      let totalCredits = 0;

      for (const fg of finalGrades) {
        const credits = fg.course?.credits || 3;
        totalPoints += fg.gpaPoint * credits;
        totalCredits += credits;
      }

      const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

      results.push({
        studentId: student.studentId,
        name: student.user?.name || 'Unknown',
        department: student.department,
        academicYear: student.academicYear,
        gpa: parseFloat(gpa.toFixed(2)),
        totalCredits,
        courseCount: finalGrades.length
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  calculateFinalGrade,
  calculateSectionGrades,
  submitSectionGrades,
  departmentApproval,
  bulkDepartmentApproval,
  registrarApproval,
  bulkRegistrarApproval,
  getFinalGrades,
  getFinalGrade,
  getGradeAudit,
  calculateStudentGPA,
  getStudentGrades,
  getBulkGPA,
  getStudentTranscriptData,
};
