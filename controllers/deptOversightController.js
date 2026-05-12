const Section = require('../models/Section');
const Grade = require('../models/Grade');
const User = require('../models/User');
const AcademicRoom = require('../models/AcademicRoom');

// @desc    Get departmental oversight data
// @route   GET /api/department/oversight
// @access  Private (Dept Admin)
const getDeptOversight = async (req, res) => {
    try {
        const deptId = req.user.department;

        // 1. Get Instructor Workload
        const instructors = await User.find({ department: deptId, role: 'INSTRUCTOR' }).select('name email');
        const workload = await Promise.all(instructors.map(async (inst) => {
            const count = await Section.countDocuments({ instructor: inst._id });
            return {
                id: inst._id,
                name: inst.name,
                sections: count
            };
        }));

        // 2. Get Pending Grade Submissions (Sections without any grades)
        // In a real system, we'd check if all students have grades
        const sections = await Section.find({ department: deptId }).populate('course', 'title code').populate('instructor', 'name');
        
        const compliance = await Promise.all(sections.map(async (s) => {
            const gradeCount = await Grade.countDocuments({ section: s._id });
            return {
                sectionId: s._id,
                course: s.course.title,
                code: s.course.code,
                instructor: s.instructor.name,
                hasGrades: gradeCount > 0,
                gradeCount
            };
        }));

        const nonCompliant = compliance.filter(c => !c.hasGrades);

        res.json({
            workload,
            lateGrades: nonCompliant,
            totalSections: sections.length
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDeptOversight
};
