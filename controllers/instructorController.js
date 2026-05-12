const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');

// Helper to calculate mode of an array
const getMode = (arr) => {
  if (arr.length === 0) return null;
  const freqMap = {};
  let maxFreq = 0;
  let mode = null;
  for (const val of arr) {
    freqMap[val] = (freqMap[val] || 0) + 1;
    if (freqMap[val] > maxFreq) {
      maxFreq = freqMap[val];
      mode = val;
    }
  }
  return mode;
};

// @desc    Get all sections assigned to logged-in instructor, with enrolled students and overall grade statistics
// @route   GET /api/instructor/my-sections
// @access  Private (Instructor)
const getMySections = async (req, res) => {
  try {
    // Find all sections where this instructor is assigned
    const sections = await Section.find({ instructor: req.user._id })
      .populate('course', 'code title credits')
      .populate({
        path: 'semester',
        select: 'name code academicYear',
        populate: {
          path: 'academicYear',
          select: 'name',
        },
      })
      .sort({ createdAt: -1 });

    // For each section, fetch the enrolled students
    const sectionsWithStudents = await Promise.all(
      sections.map(async (section) => {
        const enrollments = await Enrollment.find({ 
          section: section._id,
          semester: section.semester._id || section.semester // Handle both populated and unpopulated cases
        })
          .populate({
            path: 'student',
            populate: { path: 'user', select: 'name email' },
          })
          .select('totalGrade conversionGrade status student');

        const students = enrollments.map((e) => ({
          enrollmentId: e._id,
          studentId: e.student?.studentId,
          name: e.student?.user?.name || 'Unknown',
          email: e.student?.user?.email || 'N/A',
          status: e.status,
          academicYear: e.student?.academicYear,
          totalGrade: e.totalGrade,
          conversionGrade: e.conversionGrade,
        }));

        return {
          _id: section._id,
          sectionName: section.sectionName,
          classroom: section.classroom,
          capacity: section.capacity,
          enrolledCount: students.length,
          schedule: section.schedule,
          course: section.course,
          semester: section.semester,
          students,
        };
      })
    );

    // Calculate overall statistics across all sections
    let totalGradeSum = 0;
    let totalGradeCount = 0;
    const allConversionGrades = [];

    sectionsWithStudents.forEach((section) => {
      section.students.forEach((student) => {
        if (student.totalGrade !== null && student.totalGrade !== undefined) {
          totalGradeSum += student.totalGrade;
          totalGradeCount++;
        }
        if (student.conversionGrade !== null && student.conversionGrade !== undefined) {
          allConversionGrades.push(student.conversionGrade);
        }
      });
    });

    const overallAverageTotalGrade = totalGradeCount > 0 ? totalGradeSum / totalGradeCount : null;
    const overallConversionGrade = getMode(allConversionGrades);

    res.json({
      sections: sectionsWithStudents,
      overallStatistics: {
        averageTotalGrade: overallAverageTotalGrade,
        conversionGrade: overallConversionGrade,
      },
    });
  } catch (error) {
    console.error('getMySections error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMySections };