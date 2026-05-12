const Student = require('../models/Student');
const FinalGrade = require('../models/FinalGrade');
const AcademicProgram = require('../models/AcademicProgram');
const Course = require('../models/Course');

// @desc    Perform degree audit for a student
// @route   GET /api/registrar/degree-audit/:studentId
// @access  Private (Registrar, Super Admin)
const performDegreeAudit = async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.studentId })
            .populate('academicProgram', 'name requiredCredits code durationYears')
            .populate('college', 'name')
            .populate('department', 'name')
            .populate('user', 'name email');

        if (!student) return res.status(404).json({ message: 'Student not found' });

        // Get all APPROVED passed grades (gpaPoint > 0 means not F)
        const passedGrades = await FinalGrade.find({
            student: student._id,
            status: 'APPROVED',
            gpaPoint: { $gt: 0 }
        }).populate('course', 'credits title code yearLevel semester');

        // Get ALL approved grades (including F) for GPA calculation
        const allApprovedGrades = await FinalGrade.find({
            student: student._id,
            status: 'APPROVED'
        }).populate('course', 'credits title code');

        // ── 1. Credits earned ──────────────────────────────────────────────
        let totalCreditsEarned = 0;
        const courseHistory = passedGrades.map(g => {
            totalCreditsEarned += g.course?.credits || 0;
            return {
                code: g.course?.code || 'N/A',
                title: g.course?.title || 'Unknown',
                credits: g.course?.credits || 0,
                grade: g.gradeLetter,
                point: g.gpaPoint,
                yearLevel: g.course?.yearLevel,
                semester: g.course?.semester,
            };
        });

        // ── 2. Cumulative GPA ──────────────────────────────────────────────
        let totalGpaPoints = 0;
        let totalGpaCredits = 0;
        allApprovedGrades.forEach(g => {
            const cr = g.course?.credits || 0;
            totalGpaPoints += g.gpaPoint * cr;
            totalGpaCredits += cr;
        });
        const cumulativeGpa = totalGpaCredits > 0
            ? parseFloat((totalGpaPoints / totalGpaCredits).toFixed(2))
            : 0;

        // ── 3. Required course check ───────────────────────────────────────
        // Get all courses for the student's department/program (yearLevel all)
        const requiredCourses = await Course.find({
            department: student.department,
            isActive: true
        }).select('code title credits yearLevel semester');

        const passedCourseCodes = new Set(courseHistory.map(c => c.code));

        const missingCourses = requiredCourses
            .filter(c => !passedCourseCodes.has(c.code))
            .map(c => ({
                code: c.code,
                title: c.title,
                credits: c.credits,
                yearLevel: c.yearLevel,
                semester: c.semester,
            }));

        // ── 4. Eligibility ─────────────────────────────────────────────────
        const required = student.academicProgram?.requiredCredits || 120;
        const minGpa = 2.0; // Institutional minimum
        const progress = (totalCreditsEarned / required) * 100;

        const creditsOk = totalCreditsEarned >= required;
        const gpaOk = cumulativeGpa >= minGpa;
        const coursesOk = missingCourses.length === 0;
        const isEligible = creditsOk && gpaOk && coursesOk;

        // ── 5. Audit checklist ─────────────────────────────────────────────
        const checklist = [
            {
                label: 'Credit Hours Completed',
                passed: creditsOk,
                detail: `${totalCreditsEarned} / ${required} credits earned`,
            },
            {
                label: 'Minimum GPA Requirement',
                passed: gpaOk,
                detail: `Cumulative GPA: ${cumulativeGpa} (minimum: ${minGpa})`,
            },
            {
                label: 'All Required Courses Passed',
                passed: coursesOk,
                detail: coursesOk
                    ? 'All department courses completed'
                    : `${missingCourses.length} course(s) still pending`,
            },
        ];

        res.json({
            studentName: student.user?.name || student.name || 'Unknown Student',
            studentId: student.studentId,
            email: student.user?.email || '',
            program: student.academicProgram?.name || 'Unassigned',
            programCode: student.academicProgram?.code || '',
            college: student.college?.name || '',
            department: student.department?.name || '',
            admissionYear: student.admissionYear,
            academicYear: student.academicYear,
            requiredCredits: required,
            earnedCredits: totalCreditsEarned,
            progress: progress.toFixed(1),
            cumulativeGpa,
            minGpa,
            isEligible,
            checklist,
            courseHistory,
            missingCourses,
            auditDate: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Degree Audit Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    performDegreeAudit
};
