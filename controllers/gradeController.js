const mongoose = require('mongoose');
const Grade = require('../models/Grade');
const GradingComponent = require('../models/GradingComponent');
const FinalGrade = require('../models/FinalGrade');
const GradeAuditLog = require('../models/GradeAuditLog');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const Course = require('../models/Course');
const Staff = require('../models/Staff');
const { convertScoreToGrade, calculateTotalScore, isGradeEditable, isLocked } = require('../utils/gradeCalculator');

// @desc    Get grades for a section (instructor view)
// @route   GET /api/grades/section/:sectionId
// @access  Private (Instructor, Department Admin)
const getGradesBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { componentId } = req.query;

    // Verify section exists and instructor is authorized
    const section = await Section.findById(sectionId).populate('course');
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Check authorization: instructor must own this section OR dept admin from same dept
    if (req.user.role === 'INSTRUCTOR' && !section.instructor.equals(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view grades for this section' });
    }

    if (req.user.role === 'DEPARTMENT_ADMIN') {
      // Verify dept admin belongs to same department
      if (!req.user.department || !req.user.department.equals(section.department)) {
        return res.status(403).json({ message: 'Not authorized for this department' });
      }
    }

     // Get all enrolled students for this specific section AND semester
     const enrollments = await Enrollment.find({ 
       section: sectionId,
       semester: section.semester // Fix: use section.semester instead of section.academicCalendar
     })
       .populate({
         path: 'student',
         populate: {
           path: 'user',
           select: 'name email',
         },
       });

    // Get grading components for this course
    let components = await GradingComponent.find({
      course: section.course._id,
      isActive: true,
    }).sort('sequenceOrder');

    // SELF-HEALING: If no components found, create them from course gradingStructure
    if (components.length === 0 && section.course.gradingStructure && section.course.gradingStructure.length > 0) {
      console.log(`Self-healing: Creating GradingComponents for course ${section.course.code}`);
      const newComponents = [];
      for (let i = 0; i < section.course.gradingStructure.length; i++) {
        const struct = section.course.gradingStructure[i];
        const comp = await GradingComponent.create({
          course: section.course._id,
          name: struct.component,
          weight: struct.weight,
          maxScore: struct.weight, // Set max score equal to weight
          sequenceOrder: i + 1,
          createdBy: req.user._id,
        });
        newComponents.push(comp);
      }
      components = newComponents;
    }

    // Get existing grades for this specific section AND semester
    const filter = { 
      section: sectionId,
      semester: section.semester // Use the section's current semester
    };
    if (componentId) {
      filter.component = componentId;
    }

    const grades = await Grade.find(filter)
      .populate('student')
      .populate('component')
      .populate('gradedBy', 'name email');

    // Get final grades for this specific section AND semester
    const finalGrades = await FinalGrade.find({ 
      section: sectionId,
      semester: section.semester
    });
    const finalGradesMap = {};
    finalGrades.forEach(fg => {
      finalGradesMap[fg.student.toString()] = {
        id: fg._id,
        totalScore: fg.totalScore,
        gradeLetter: fg.gradeLetter,
        status: fg.status
      };
    });

    // Organize grades by student
    const gradesByStudent = {};
    grades.forEach((g) => {
      const studentId = g.student._id.toString();
      if (!gradesByStudent[studentId]) {
        gradesByStudent[studentId] = {};
      }
      gradesByStudent[studentId][g.component.name] = {
        score: g.score,
        gradeId: g._id,
        gradedAt: g.gradedAt,
        gradedBy: g.gradedBy,
        remarks: g.remarks,
        version: g.version,
      };
    });

    // Build response
    const studentsWithGrades = enrollments.map((enrollment) => {
      const studentId = enrollment.student._id.toString();
      const studentGrades = gradesByStudent[studentId] || {};

      const studentData = {
        enrollmentId: enrollment._id,
        studentId: enrollment.student.studentId,
        name: enrollment.student.user?.name || 'Unknown',
        email: enrollment.student.user?.email || '',
        grades: {},
      };

      // Add a grade entry for each component
      components.forEach((comp) => {
        const compGrade = studentGrades[comp.name] || {
          score: null,
          gradeId: null,
          gradedAt: null,
          gradedBy: null,
          remarks: null,
        };

        studentData.grades[comp.name] = {
          score: compGrade.score,
          maxScore: comp.maxScore,
          weight: comp.weight,
          gradeId: compGrade.gradeId,
          gradedAt: compGrade.gradedAt,
          gradedBy: compGrade.gradedBy,
          remarks: compGrade.remarks,
          isEditable: compGrade.gradedAt ? false : true,
        };
      });

      // Add final grade info
      const finalGradeInfo = finalGradesMap[studentId];
      if (finalGradeInfo) {
        studentData.finalGradeId = finalGradeInfo.id;
        studentData.totalScore = finalGradeInfo.totalScore;
        studentData.gradeLetter = finalGradeInfo.gradeLetter;
        studentData.status = finalGradeInfo.status;
      } else {
        studentData.finalGradeId = null;
        studentData.totalScore = null;
        studentData.gradeLetter = null;
        studentData.status = 'DRAFT';
      }

      return studentData;
    });

    res.json({
      section: {
        _id: section._id,
        sectionName: section.sectionName,
        course: section.course,
      },
      components,
      students: studentsWithGrades,
    });
  } catch (error) {
    console.error('getGradesBySection error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save or update a grade (draft)
// @route   POST /api/grades/entry
// @access  Private (Instructor)
const saveGrade = async (req, res) => {
  try {
    const { enrollmentId, componentId, score, remarks } = req.body;

    console.log('saveGrade received:', { enrollmentId, componentId, score, remarks, userId: req.user._id });

    // Validate inputs
    if (!enrollmentId || !componentId || score === undefined) {
      return res.status(400).json({ message: 'Missing required fields: enrollmentId, componentId, score' });
    }

    // Validate enrollmentId format
    if (!enrollmentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid enrollment ID format' });
    }

    const scoreNum = parseFloat(score);
    if (isNaN(scoreNum)) {
      return res.status(400).json({ message: 'Score must be a valid number' });
    }

    // Verify component exists and get its maxScore
    const component = await GradingComponent.findById(componentId);
    if (!component || !component.isActive) {
      return res.status(404).json({ message: 'Grading component not found or inactive' });
    }

    // Validate score range
    if (scoreNum < 0 || scoreNum > component.maxScore) {
      return res.status(400).json({
        message: `Score must be between 0 and ${component.maxScore}`,
      });
    }

    // Find enrollment with populated references
    let enrollment;
    try {
      enrollment = await Enrollment.findById(enrollmentId)
        .populate('student')
        .populate('course')
        .populate('section')
        .populate('semester');
    } catch (dbErr) {
      console.error('DB error finding enrollment:', dbErr.message);
      return res.status(400).json({ message: 'Invalid enrollment ID' });
    }

    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

     // Verify instructor teaches this section
     if (!enrollment.section) {
       return res.status(404).json({ message: 'Section not found' });
     }
     if (!enrollment.section.instructor || !enrollment.section.instructor.equals(req.user._id)) {
       return res.status(403).json({ message: 'Not authorized to grade this section' });
     }

    // Check for existing grade and its status
    let grade = await Grade.findOne({
      student: enrollment.student._id,
      course: enrollment.course._id,
      section: enrollment.section._id,
      semester: enrollment.semester._id, // Filter by current semester
      component: componentId,
    });

    if (grade) {
      // Check if grade is locked
      const finalGrade = await FinalGrade.findOne({
        student: enrollment.student._id,
        course: enrollment.course._id,
        section: enrollment.section._id,
        semester: enrollment.semester._id, // Filter by current semester
      });

      if (finalGrade && isLocked(finalGrade.status)) {
        return res.status(400).json({
          message: 'Cannot modify grade. Final grade is already approved and locked.',
          locked: true,
        });
      }

      if (finalGrade && !isGradeEditable(finalGrade.status)) {
        return res.status(400).json({
          message: `Grade cannot be edited in ${finalGrade.status} status`,
        });
      }

      // Update
      grade.score = scoreNum;
      if (remarks !== undefined) grade.remarks = remarks;
      grade.gradedBy = req.user._id;
      grade.gradedAt = new Date();
      grade.version += 1;
      await grade.save();

      // Audit log
      try {
        await GradeAuditLog.create({
          finalGrade: finalGrade ? finalGrade._id : null,
          user: req.user._id,
          action: 'UPDATE_DRAFT',
          oldValue: { score: grade.score - 1 },
          newValue: { score: scoreNum },
          reason: 'Grade updated',
        });
      } catch (auditErr) {
        console.warn('Audit log failed:', auditErr.message);
      }

      res.json({ message: 'Grade updated successfully', grade });
    } else {
      // Create new grade
      if (!enrollment.semester || !enrollment.semester._id) {
        return res.status(400).json({ message: 'Enrollment has no semester associated.' });
      }

      grade = await Grade.create({
        student: enrollment.student._id,
        course: enrollment.course._id,
        section: enrollment.section._id,
        semester: enrollment.semester._id,
        component: componentId,
        score: scoreNum,
        gradedBy: req.user._id,
        gradedAt: new Date(),
        remarks: remarks || '',
      });

      try {
        await GradeAuditLog.create({
          finalGrade: null,
          user: req.user._id,
          action: 'CREATE_DRAFT',
          newValue: { score: scoreNum, component: componentId },
          reason: 'Initial grade entry',
        });
      } catch (auditErr) {
        console.warn('Audit log failed:', auditErr.message);
      }

      res.status(201).json({ message: 'Grade saved successfully', grade });
    }

    // Trigger Notification for the student
    const { createNotification } = require('./notificationController');
    const studentUser = await User.findById(enrollment.student.user || enrollment.student);
    if (studentUser) {
      await createNotification({
        recipient: studentUser._id,
        title: 'New Grade Posted',
        message: `A new grade has been posted for your course "${enrollment.course.name}" in the "${component.name}" component.`,
        type: 'GRADE',
        priority: 'NORMAL',
        relatedId: grade._id
      });
    }
  } catch (error) {
    console.error('saveGrade error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate grade entry' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get individual grade
// @route   GET /api/grades/:gradeId
// @access  Private (Instructor, Department Admin)
const getGrade = async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.gradeId)
      .populate('student')
      .populate('component')
      .populate('gradedBy', 'name email');

    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }

    // Authorization check
    if (req.user.role === 'INSTRUCTOR') {
      const section = await Section.findById(grade.section);
      if (!section || !section.instructor.equals(req.user._id)) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    res.json(grade);
  } catch (error) {
    console.error('getGrade error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk save grades for a section
// @route   POST /api/grades/bulk
// @access  Private (Instructor)
const bulkSaveGrades = async (req, res) => {
  try {
    const { grades } = req.body; // Array of { studentId, componentId, score, remarks }

    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ message: 'No grades provided' });
    }

    const results = [];
    const errors = [];

    for (const gradeData of grades) {
      try {
        // Check if final grade is locked
        const finalGrade = await FinalGrade.findOne({
          student: gradeData.studentId,
          course: gradeData.courseId,
          section: gradeData.sectionId,
          semester: gradeData.semesterId, // Assuming semesterId is passed or we lookup from enrollment
        });

        if (finalGrade && isLocked(finalGrade.status)) {
          errors.push({
            studentId: gradeData.studentId,
            error: 'Cannot modify grade. Final grade is already approved and locked.',
          });
          continue;
        }

        if (finalGrade && !isGradeEditable(finalGrade.status)) {
          errors.push({
            studentId: gradeData.studentId,
            error: `Grade cannot be edited in ${finalGrade.status} status`,
          });
          continue;
        }
        // Verify component exists
        const component = await GradingComponent.findById(gradeData.componentId);
        if (!component) {
          errors.push({ studentId: gradeData.studentId, error: 'Component not found' });
          continue;
        }

        // Validate score
        if (gradeData.score < 0 || gradeData.score > component.maxScore) {
          errors.push({
            studentId: gradeData.studentId,
            component: component.name,
            error: `Score must be 0-${component.maxScore}`,
          });
          continue;
        }

        // Upsert grade
        const filter = {
          student: gradeData.studentId,
          course: gradeData.courseId,
          section: gradeData.sectionId,
          semester: gradeData.semesterId,
          component: gradeData.componentId,
        };

        const update = {
          $set: {
            score: gradeData.score,
            gradedBy: req.user._id,
            gradedAt: new Date(),
            remarks: gradeData.remarks || '',
          },
          $inc: { version: 1 },
        };

        const options = { upsert: true, new: true };

        const grade = await Grade.findOneAndUpdate(filter, update, options)
          .populate('student')
          .populate('component');

        results.push({ success: true, grade });
      } catch (err) {
        errors.push({ studentId: gradeData.studentId, error: err.message });
      }
    }

    res.json({
      message: 'Bulk grade save completed',
      saved: results.length,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    console.error('bulkSaveGrades error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getGradesBySection,
  saveGrade,
  getGrade,
  bulkSaveGrades,
};
