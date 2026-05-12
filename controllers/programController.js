const AcademicProgram = require('../models/AcademicProgram');

// @desc    Get all programs in college
// @route   GET /api/programs
// @access  Private (College Admin, Super Admin)
const getPrograms = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'COLLEGE_ADMIN') {
            query.college = req.user.college;
        }
        const programs = await AcademicProgram.find(query).populate('college', 'name');
        res.json(programs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a program
// @route   POST /api/programs
// @access  Private (College Admin)
const createProgram = async (req, res) => {
    const { name, code, durationYears, description } = req.body;
    try {
        console.log('User College in Controller:', req.user.college);
        const program = await AcademicProgram.create({
            name,
            code,
            college: req.user.college,
            durationYears,
            description
        });
        res.status(201).json(program);
    } catch (error) {
        console.error('Program Creation Error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPrograms,
    createProgram
};
