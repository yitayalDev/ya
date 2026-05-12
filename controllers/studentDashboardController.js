const Student = require('../models/Student');
const FinalGrade = require('../models/FinalGrade');
const Attendance = require('../models/Attendance');
const BookLoan = require('../models/BookLoan');
const TuitionFee = require('../models/TuitionFee');

// @desc    Get comprehensive student dashboard summary
// @route   GET /api/student/dashboard/summary
// @access  Private (Student)
const getStudentSummary = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id })
            .populate('academicProgram', 'name')
            .populate('college', 'name');

        if (!student) return res.status(404).json({ message: 'Student profile not found' });

        // 1. Academic Stats
        console.log('[DEBUG] Fetching academic stats...');
        const grades = await FinalGrade.find({ student: student._id, status: 'APPROVED' }).populate('course', 'credits');
        let sumCredits = 0;
        let sumPoints = 0;
        grades.forEach(g => {
            const cr = g.course?.credits || 0;
            sumCredits += cr;
            sumPoints += (g.gpaPoint || 0) * cr;
        });
        const gpa = sumCredits > 0 ? (sumPoints / sumCredits).toFixed(2) : '0.00';

        // 2. Library Status
        console.log('[DEBUG] Fetching library stats...');
        let activeLoansCount = 0;
        let loans = [];
        try {
            const activeLoans = await BookLoan.find({ student: student._id, status: 'BORROWED' }).populate('book', 'title');
            activeLoansCount = activeLoans.length;
            loans = activeLoans.map(l => ({ title: l.book?.title || 'Unknown Book', dueDate: l.dueDate }));
        } catch (libErr) {
            console.error('Library fetch error:', libErr.message);
        }

        // 3. Financial Status
        console.log('[DEBUG] Fetching financial stats...');
        let balance = 0;
        let currency = 'USD';
        try {
            if (student.college && student.academicYear) {
                const tuition = await TuitionFee.findOne({ 
                    college: student.college, 
                    academicYear: student.academicYear 
                });
                if (tuition) {
                    balance = tuition.amount || 0;
                    currency = tuition.currency || 'USD';
                }
            }
        } catch (finErr) {
            console.error('Finance fetch error:', finErr.message);
        }

        console.log('[DEBUG] Summary construction complete');
        res.json({
            cumulativeGPA: gpa,
            totalCredits: sumCredits,
            level: student.academicYear || 'N/A',
            program: student.academicProgram?.name || 'N/A',
            academic: {
                gpa,
                totalCredits: sumCredits,
                level: student.academicYear || 'N/A',
                program: student.academicProgram?.name || 'N/A'
            },
            library: {
                activeLoansCount,
                loans
            },
            finance: {
                balance,
                currency,
                status: balance > 0 ? 'PENDING' : 'CLEARED'
            }
        });

    } catch (error) {
        console.error('getStudentSummary Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student profile
// @route   GET /api/student/me
// @access  Private (Student)
const getStudentProfile = async (req, res) => {
    console.log('[CONTROLLER] getStudentProfile called');
    try {
        const student = await Student.findOne({ user: req.user._id })
            .populate('user', 'name email')
            .populate('department', 'name')
            .populate('college', 'name')
            .populate('campus', 'name');

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student enrollments
// @route   GET /api/student/my-enrollments
// @access  Private (Student)
const getMyEnrollments = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) return res.json([]);

        const Enrollment = require('../models/Enrollment');
        const enrollments = await Enrollment.find({ student: student._id })
            .populate('course', 'code title credits')
            .populate('section', 'sectionName classroom schedule')
            .populate('semester', 'name academicYear');
        
        res.json(enrollments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student attendance history
// @route   GET /api/student/attendance/history
// @access  Private (Student)
const getMyAttendanceHistory = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) return res.json({ attendance: [], summary: {} });

        const attendance = await Attendance.find({ student: student._id })
            .populate('section', 'sectionName')
            .populate('course', 'code title')
            .sort({ date: -1 });

        // Calculate summary
        const total = attendance.length;
        const present = attendance.filter(a => a.status === 'Present').length;
        
        res.json({
            attendance,
            summary: {
                totalSessions: total,
                attended: present,
                absent: total - present,
                overallPercentage: total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStudentSummary,
    getStudentProfile,
    getMyEnrollments,
    getMyAttendanceHistory
};
