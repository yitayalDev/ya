const Student = require('../models/Student');
const FinalGrade = require('../models/FinalGrade');
const Clearance = require('../models/Clearance');

// @desc    Get students eligible for graduation
// @route   GET /api/graduation/eligible
// @access  Private (Registrar)
const getEligibleStudents = async (req, res) => {
  try {
    // 1. Get all active students in their final year (Year 4 for most)
    // For this demo, we'll fetch all students and then check criteria
    const students = await Student.find({ status: 'Active' })
      .populate('user', 'name email')
      .populate('department', 'name');

    const results = [];

    for (const student of students) {
      // 2. Check clearance status
      const clearance = await Clearance.findOne({ student: student._id });
      const isCleared = clearance && clearance.status === 'CLEARED';

      // 3. Check CGPA (Simulated - we'd normally calculate from FinalGrades)
      // For demo, we'll assume they need at least some grades
      const gradesCount = await FinalGrade.countDocuments({ student: student._id });
      
      results.push({
        _id: student._id,
        studentId: student.studentId,
        name: student.user.name,
        department: student.department.name,
        isCleared,
        hasGrades: gradesCount > 0,
        academicYear: student.academicYear
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Finalize batch graduation
// @route   POST /api/graduation/finalize
// @access  Private (Registrar)
const finalizeGraduation = async (req, res) => {
  const { studentIds, graduationDate, degreeTitle } = req.body;

  try {
    const results = await Student.updateMany(
      { _id: { $in: studentIds } },
      { 
        $set: { 
          status: 'Graduated',
          graduationDate: graduationDate || new Date(),
          degreeTitle: degreeTitle || 'Bachelor of Science'
        },
        $push: {
          statusHistory: {
            status: 'Graduated',
            reason: 'Successful completion of all academic requirements',
            date: new Date(),
            changedBy: req.user._id
          }
        }
      }
    );

    res.json({ message: `Successfully graduated ${results.modifiedCount} students`, count: results.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEligibleStudents,
  finalizeGraduation
};
