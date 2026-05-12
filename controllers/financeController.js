const TuitionFee = require('../models/TuitionFee');
const Student = require('../models/Student');
const College = require('../models/College');

// @desc    Get financial overview
// @route   GET /api/finance/overview
// @access  Private (Super Admin)
const getFinancialOverview = async (req, res) => {
    try {
        const fees = await TuitionFee.find({}).populate('college', 'name');
        const students = await Student.find({}).select('college academicYear');

        let totalPotentialRevenue = 0;
        let collegeBreakdown = {};

        // Calculate revenue
        students.forEach(student => {
            const fee = fees.find(f => 
                f.college._id.toString() === student.college.toString() && 
                f.academicYear === student.academicYear
            );
            
            if (fee) {
                totalPotentialRevenue += fee.amount;
                
                const collegeName = fee.college.name;
                if (!collegeBreakdown[collegeName]) {
                    collegeBreakdown[collegeName] = { revenue: 0, count: 0 };
                }
                collegeBreakdown[collegeName].revenue += fee.amount;
                collegeBreakdown[collegeName].count += 1;
            }
        });

        res.json({
            totalPotentialRevenue,
            totalStudents: students.length,
            currency: 'USD',
            collegeBreakdown
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Set tuition fee
// @route   POST /api/finance/fees
// @access  Private (Super Admin)
const setTuitionFee = async (req, res) => {
    const { college, academicYear, amount } = req.body;
    try {
        const fee = await TuitionFee.findOneAndUpdate(
            { college, academicYear },
            { amount },
            { upsert: true, new: true }
        );
        res.json(fee);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getFinancialOverview,
    setTuitionFee
};
