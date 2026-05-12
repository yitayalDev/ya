const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');
const Section = require('../models/Section');
const Course = require('../models/Course');
const { Semester } = require('../models/AcademicCalendar');
const FinalGrade = require('../models/FinalGrade');

/**
 * Checks if a student has passed all prerequisites for a course
 */
const verifyPrerequisites = async (studentId, courseId) => {
  const course = await Course.findById(courseId).populate('prerequisites');
  if (!course || !course.prerequisites || course.prerequisites.length === 0) {
    return { met: true, missing: [] };
  }

  const missing = [];
  for (const prereq of course.prerequisites) {
    // Check if student has an APPROVED or LOCKED grade that is NOT 'F' (gradePoint > 0)
    const grade = await FinalGrade.findOne({
      student: studentId,
      course: prereq._id,
      status: { $in: ['APPROVED', 'LOCKED'] },
      gradePoint: { $gt: 0 }
    });

    if (!grade) {
      missing.push(`${prereq.code} - ${prereq.title}`);
    }
  }

  return {
    met: missing.length === 0,
    missing
  };
};

// @desc    Auto-enroll students using Round Robin algorithm
// @route   POST /api/enrollment/auto-enroll
// @access  Private (Registrar)
const autoEnroll = async (req, res) => {
  const { departmentId, academicYear, courseIds, semesterId } = req.body;

  try {
    // Check if enrollment is allowed for the current semester
    const semester = await Semester.findById(semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    if (semester.status !== 'Active') {
      return res.status(400).json({
        message: `Enrollment is not allowed. Semester status: ${semester.status}. Only Active semesters allow enrollment.`
      });
    }

    // 1. Find all students matching criteria
    const students = await Student.find({
      department: departmentId,
      academicYear: academicYear,
      status: 'Active'
    });

    if (students.length === 0) {
      return res.status(404).json({ message: 'No active students found for this criteria' });
    }

    const enrollmentResults = [];

    // 2. Process each course
    for (const courseId of courseIds) {
      // Find all sections for this course in the current semester
      const sections = await Section.find({
        course: courseId,
        semester: semesterId
      }).sort({ sectionName: 1 });

      if (sections.length === 0) {
        enrollmentResults.push({ courseId, status: 'Failed', reason: 'No sections found' });
        continue;
      }

      // 3. Distribute students using Round Robin
      let enrolledCount = 0;
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        
        // --- PREREQUISITE CHECK ---
        const prereqResult = await verifyPrerequisites(student._id, courseId);
        if (!prereqResult.met) {
          continue; // Skip this student for this course
        }
        // ---------------------------

        // Pick section based on Round Robin (i % sections.length)
        // We try sections one by one if the preferred one is full
        let assigned = false;
        for (let attempt = 0; attempt < sections.length; attempt++) {
          const sectionIdx = (i + attempt) % sections.length;
          const section = sections[sectionIdx];

          // Check current enrollment count for this section ONLY for this semester
          const currentCount = await Enrollment.countDocuments({ 
            section: section._id,
            semester: semesterId 
          });
          
          if (currentCount < section.capacity) {
            try {
              await Enrollment.create({
                student: student._id,
                section: section._id,
                course: courseId,
                semester: semesterId
              });
              assigned = true;
              enrolledCount++;
              break;
            } catch (err) {
              // Likely already enrolled (duplicate index)
              if (err.code === 11000) {
                assigned = true; // Already assigned, move on
                break;
              }
            }
          }
        }
      }

      enrollmentResults.push({ 
        courseId, 
        status: 'Success', 
        enrolled: enrolledCount, 
        totalStudents: students.length 
      });
    }

    res.json({
      message: 'Auto-enrollment process completed',
      results: enrollmentResults
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all enrollments for a student in a semester
// @route   GET /api/enrollment/student/:studentId/semester/:semesterId
// @access  Private (Registrar)
const getStudentEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      student: req.params.studentId,
      semester: req.params.semesterId
    }).populate('course', 'title code').populate('section', 'sectionName');
    
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update enrollment section manually
// @route   PUT /api/enrollment/:id/section
// @access  Private (Registrar)
const updateEnrollmentSection = async (req, res) => {
  const { sectionId } = req.body;

  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    const newSection = await Section.findById(sectionId);
    if (!newSection) {
      return res.status(404).json({ message: 'New section not found' });
    }

    // Check capacity for the specific semester
    const currentCount = await Enrollment.countDocuments({ 
      section: sectionId,
      semester: enrollment.semester // Use the enrollment's semester
    });
    if (currentCount >= newSection.capacity) {
      return res.status(400).json({ message: 'Target section is already at full capacity' });
    }

    enrollment.section = sectionId;
    await enrollment.save();

    res.json({ message: 'Section updated successfully', enrollment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manually enroll a student (with prerequisite check)
// @route   POST /api/enrollment/manual
// @access  Private (Registrar)
const manualEnroll = async (req, res) => {
  const { studentId, sectionId, courseId, semesterId } = req.body;

  try {
    // 1. Prerequisite check
    const prereqResult = await verifyPrerequisites(studentId, courseId);
    if (!prereqResult.met) {
      return res.status(400).json({ 
        message: 'Prerequisite requirement not met', 
        missing: prereqResult.missing 
      });
    }

    // 2. Capacity check
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }
    
    const currentCount = await Enrollment.countDocuments({ 
      section: sectionId,
      semester: semesterId 
    });
    if (currentCount >= section.capacity) {
      return res.status(400).json({ message: 'Section is full' });
    }

    // 3. Create enrollment
    const enrollment = await Enrollment.create({
      student: studentId,
      section: sectionId,
      course: courseId,
      semester: semesterId,
      status: 'Enrolled'
    });

    // 4. Update section count
    section.enrolledCount = currentCount + 1;
    await section.save();

    res.status(201).json(enrollment);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Student is already enrolled in this course for this semester' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Self-enroll a student (called by students)
// @route   POST /api/enrollment/self-enroll
// @access  Private (Student)
const selfEnroll = async (req, res) => {
  const { sectionId, courseId, semesterId } = req.body;

  try {
    // 1. Find the student document for this user
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const studentId = student._id;

    // 1.5 Verify Semester Registration Period
    const semester = await Semester.findById(semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }
    
    if (semester.status !== 'Active') {
      return res.status(400).json({ message: 'Registration is closed. Semester is not Active.' });
    }

    const now = new Date();
    if (semester.registrationStart && now < new Date(semester.registrationStart)) {
      return res.status(400).json({ message: 'Registration has not started yet for this semester.' });
    }
    if (semester.registrationEnd && now > new Date(semester.registrationEnd)) {
      return res.status(400).json({ message: 'Registration deadline has passed. Registration is now closed.' });
    }

    // --- STAGGERED WINDOW CHECK ---
    const RegistrationWindow = require('../models/RegistrationWindow');
    const specificWindow = await RegistrationWindow.findOne({
      semester: semesterId,
      academicYear: { $in: [student.academicYear, 'All'] },
      isActive: true
    });

    if (specificWindow) {
      if (now < new Date(specificWindow.startDate)) {
        return res.status(400).json({ 
          message: `Registration for ${student.academicYear} starts on ${new Date(specificWindow.startDate).toLocaleString()}` 
        });
      }
      if (now > new Date(specificWindow.endDate)) {
        return res.status(400).json({ 
          message: `Registration for ${student.academicYear} closed on ${new Date(specificWindow.endDate).toLocaleString()}` 
        });
      }
    }
    // ------------------------------

    // 2. Prerequisite check
    const prereqResult = await verifyPrerequisites(studentId, courseId);
    if (!prereqResult.met) {
      return res.status(400).json({ 
        message: 'Prerequisite requirement not met', 
        missing: prereqResult.missing 
      });
    }

    // 3. Capacity check
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }
    
    const currentCount = await Enrollment.countDocuments({ 
      section: sectionId,
      semester: semesterId 
    });
    if (currentCount >= section.capacity) {
      return res.status(400).json({ message: 'Section is full' });
    }

    // 4. Create enrollment
    const enrollment = await Enrollment.create({
      student: studentId,
      section: sectionId,
      course: courseId,
      semester: semesterId,
      status: 'Enrolled'
    });

    // 5. Update section count
    section.enrolledCount = currentCount + 1;
    await section.save();

    res.status(201).json(enrollment);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You are already enrolled in this course for this semester' });
    }
    res.status(500).json({ message: error.message });
  }
};

module.exports = { autoEnroll, getStudentEnrollments, updateEnrollmentSection, manualEnroll, selfEnroll };
