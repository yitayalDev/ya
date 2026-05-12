const User = require('../models/User');
const Student = require('../models/Student');
const Section = require('../models/Section');
const Grade = require('../models/Grade');
const Department = require('../models/Department');

// @desc    Get academic oversight data for college
// @route   GET /api/college/oversight
// @access  Private (College Admin)
const getAcademicOversight = async (req, res) => {
    try {
        const collegeId = req.user.college;

        if (!collegeId) {
            return res.status(400).json({ message: 'User is not assigned to a college' });
        }

        // 1. Get all departments in this college
        const depts = await Department.find({ college: collegeId }).select('_id name');
        const deptIds = depts.map(d => d._id);

        // 2. Get all sections and their instructors in these departments
        const sections = await Section.find({ department: { $in: deptIds } })
            .populate('course', 'title code')
            .populate('instructor', 'name email')
            .populate('department', 'name');

        // 3. Get at-risk students (any grade < 50)
        const atRiskGrades = await Grade.find({ 
            score: { $lt: 50 }
        }).populate({
            path: 'student',
            match: { college: collegeId },
            select: 'name studentId'
        }).populate('course', 'title code');

        const filteredAtRisk = atRiskGrades.filter(g => g.student != null);

        res.json({
            instructionalLoad: sections,
            atRiskStudents: filteredAtRisk,
            departmentStats: depts.length
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAcademicOversight
};
