const Student = require('../models/Student');
const { generateUniversityLetter } = require('../utils/pdfGenerator');

// @desc    Generate Enrollment Certificate
// @route   GET /api/documents/enrollment-cert/:studentId
// @access  Private (Registrar)
const generateEnrollmentCert = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId)
            .populate('user', 'name')
            .populate('college', 'name')
            .populate('department', 'name');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const data = {
            title: 'Certificate of Enrollment',
            verificationId: `CERT-${student.studentId}-${Date.now().toString().slice(-4)}`,
            body: `This is to certify that ${student.user.name} (Student ID: ${student.studentId}) is a bona fide student of Antigravity University. \n\nHe/She is currently enrolled in the ${student.department.name} department under the ${student.college.name} for the Academic Year ${student.academicYear}. \n\nThis certification is issued upon the request of the aforementioned student for whatever legal purpose it may serve.`
        };

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=enrollment_cert_${student.studentId}.pdf`);

        generateUniversityLetter(res, data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Generate Good Standing Letter
// @route   GET /api/documents/good-standing/:studentId
// @access  Private (Registrar)
const generateGoodStandingLetter = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId)
            .populate('user', 'name')
            .populate('college', 'name');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const data = {
            title: 'Letter of Good Standing',
            verificationId: `LGS-${student.studentId}-${Date.now().toString().slice(-4)}`,
            body: `This is to certify that ${student.user.name} (Student ID: ${student.studentId}) is a student in good standing at Antigravity University. \n\nAs of this date, the student has maintained a satisfactory academic record and has no pending disciplinary actions. \n\nWe highly recommend the student for any academic or professional endeavors.`
        };

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=good_standing_${student.studentId}.pdf`);

        generateUniversityLetter(res, data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateEnrollmentCert,
    generateGoodStandingLetter
};
