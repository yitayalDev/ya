const DocumentVerification = require('../models/DocumentVerification');
const Student = require('../models/Student');
const crypto = require('crypto');

// @desc    Register a document for verification
// @route   POST /api/verify/issue
// @access  Private (Registrar)
const issueDocument = async (req, res) => {
  const { documentType, studentId, metadata } = req.body;

  try {
    const student = await Student.findOne({ studentId }).populate('user', 'name');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (req.user.role === 'STUDENT' && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to issue document for another student' });
    }

    // Generate a unique 12-character verification code
    const verificationCode = crypto.randomBytes(6).toString('hex').toUpperCase();

    const verification = await DocumentVerification.create({
      verificationCode,
      documentType,
      student: student._id,
      studentId: student.studentId,
      studentName: student.user.name,
      issuedBy: req.user._id,
      metadata
    });

    res.status(201).json(verification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify a document by code
// @route   GET /api/verify/:code
// @access  Public
const verifyDocument = async (req, res) => {
  try {
    const verification = await DocumentVerification.findOne({ 
      verificationCode: req.params.code.toUpperCase(),
      isActive: true
    }).populate('issuedBy', 'name');

    if (!verification) {
      return res.status(404).json({ 
        verified: false,
        message: 'Invalid or expired verification code' 
      });
    }

    res.json({
      verified: true,
      documentDetails: {
        type: verification.documentType,
        studentName: verification.studentName,
        studentId: verification.studentId,
        issuedAt: verification.issuedAt,
        issuedBy: verification.issuedBy.name,
        verificationCode: verification.verificationCode
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { issueDocument, verifyDocument };
