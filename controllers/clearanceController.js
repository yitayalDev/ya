const PDFDocument = require('pdfkit');
const Clearance = require('../models/Clearance');
const Student = require('../models/Student');
const User = require('../models/User');
const BookLoan = require('../models/BookLoan');
const Violation = require('../models/Violation');
const FinalGrade = require('../models/FinalGrade');
const mongoose = require('mongoose');

// @desc    Apply for clearance
// @route   POST /api/clearance/apply
// @access  Private (Student)
const applyForClearance = async (req, res) => {
  try {
    const { type } = req.body;

    // Check if student profile exists
    const studentProfile = await Student.findOne({ user: req.user.id });
    if (!studentProfile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Check if clearance already exists
    const existing = await Clearance.findOne({
      student: req.user.id,
      status: 'IN_PROGRESS'
    });

    if (existing) {
      return res.status(400).json({ message: 'You already have an active clearance request' });
    }

    // --- Automated Checks ---
    
    // 1. Library Check: Auto-approve if no active loans
    const activeLoans = await BookLoan.countDocuments({
      student: studentProfile._id,
      status: { $ne: 'Returned' }
    });
    
    const libraryStatus = activeLoans === 0 ? 'APPROVED' : 'PENDING';
    const libraryRemarks = activeLoans === 0 ? 'Auto-approved: No active book loans found.' : 'Pending: Active book loans detected.';

    // 2. Dormitory Check: Auto-approve if no assigned building
    const user = await User.findById(req.user.id);
    const hasDorm = !!user.assignedBuilding;
    const dormStatus = !hasDorm ? 'APPROVED' : 'PENDING';
    const dormRemarks = !hasDorm ? 'Auto-approved: No dormitory assignment found.' : 'Pending: Dormitory vacancy and key return required.';

    // 3. Department Check: Auto-approve if all final grades are finalized
    const pendingGrades = await FinalGrade.countDocuments({
      student: studentProfile._id,
      status: { $nin: ['APPROVED', 'LOCKED'] }
    });
    
    const deptStatus = pendingGrades === 0 ? 'APPROVED' : 'PENDING';
    const deptRemarks = pendingGrades === 0 ? 'Auto-approved: All final grades are finalized.' : 'Pending: Some grades are still awaiting approval.';

    const clearance = await Clearance.create({
      student: req.user.id,
      type: type || 'GRADUATION',
      steps: {
        library: { 
          status: libraryStatus, 
          remarks: libraryRemarks,
          updatedAt: activeLoans === 0 ? new Date() : null 
        },
        department: { 
          status: deptStatus,
          remarks: deptRemarks,
          updatedAt: pendingGrades === 0 ? new Date() : null,
          gradesCompleted: pendingGrades === 0,
          academicCompleted: pendingGrades === 0
        },
        proctor: { status: 'PENDING' },
        dormitory: { 
          status: dormStatus, 
          remarks: dormRemarks,
          updatedAt: !hasDorm ? new Date() : null
        },
        dean: { status: 'PENDING' },
        registrar: { status: 'PENDING' }
      }
    });

    res.status(201).json(clearance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get student clearance status
// @route   GET /api/clearance/my
// @access  Private (Student)
const getMyClearance = async (req, res) => {
  try {
    const clearance = await Clearance.findOne({ student: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    if (!clearance) {
      return res.json(null);
    }

    // Attach student profile info for certificate
    const studentProfile = await Student.findOne({ user: req.user.id })
      .populate({
        path: 'user',
        select: 'name'
      })
      .select('studentId academicYear')
      .lean();

    clearance.student = {
      name: studentProfile?.user?.name,
      studentId: studentProfile?.studentId,
      academicYear: studentProfile?.academicYear
    };

    res.json(clearance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update clearance step status
// @route   PUT /api/clearance/:id/step
// @access  Private (Proctor, Dorm Admin, Dean, Registrar)
const updateStepStatus = async (req, res) => {
  try {
    const { unit, status, remarks, checklist } = req.body;
    const clearance = await Clearance.findById(req.params.id);

    if (!clearance) {
      return res.status(404).json({ message: 'Clearance request not found' });
    }

    // unit: 'proctor', 'dormitory', 'dean', 'registrar'
    const step = clearance.steps[unit];
    if (!step) {
      return res.status(400).json({ message: 'Invalid unit name' });
    }

    // Role-based authorization
    const roleMap = {
      'library': 'LIBRARY_ADMIN',
      'department': 'DEPARTMENT_ADMIN',
      'proctor': 'PROCTOR',
      'dormitory': 'DORMITORY_ADMIN',
      'dean': 'DEAN_OF_STUDENTS',
      'registrar': 'REGISTRAR'
    };

    if (req.user.role !== roleMap[unit] && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: `Only ${roleMap[unit]} can approve this step` });
    }

    // Dependency Logic for Dormitory
    if (unit === 'dormitory' && clearance.steps.proctor.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Proctor clearance must be approved before dormitory clearance' });
    }

    // Dependency Logic for Dean
    if (unit === 'dean') {
      const requiredUnits = ['library', 'department', 'proctor', 'dormitory'];
      const incomplete = requiredUnits.filter(u => clearance.steps[u].status !== 'APPROVED');
      if (incomplete.length > 0) {
        return res.status(400).json({ message: `Cannot approve. Pending units: ${incomplete.join(', ').toUpperCase()}` });
      }
    }

    // Update the step
    step.status = status;
    step.remarks = remarks;
    step.updatedAt = new Date();
    step.updatedBy = req.user.id;

    // Apply checklist updates
    if (checklist) {
      Object.keys(checklist).forEach(key => {
        if (step[key] !== undefined) {
          step[key] = checklist[key];
        }
      });
    }

    // Final System Step: Dean
    if (unit === 'dean' && status === 'APPROVED') {
      clearance.status = 'CLEARED';
      clearance.clearedAt = new Date();
      
      // Auto-clear registrar so the certificate prints correctly
      if (clearance.steps.registrar) {
        clearance.steps.registrar.status = 'APPROVED';
        clearance.steps.registrar.updatedAt = new Date();
        clearance.steps.registrar.updatedBy = req.user.id;
      }
    } else if (status === 'REJECTED') {
      // Logic could be added here if a rejection should fail the entire process
    }

    await clearance.save();
    res.json(clearance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get clearance by student ID (for search)
// @route   GET /api/clearance/student/:studentId
// @access  Private (Admins)
const getClearanceByStudentId = async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.studentId })
          .populate({
            path: 'user',
            select: 'name role department'
          })
          .select('studentId academicYear user department')
          .lean();
          
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Department Admin Restriction: Only own department students
        if (req.user.role === 'DEPARTMENT_ADMIN') {
            if (student.department?.toString() !== req.user.department?.toString()) {
                return res.status(403).json({ message: 'You are only authorized to view students from your own department.' });
            }
        }

        // Clearance.student stores the User _id (from req.user.id when applied)
        const userObjectId = student.user?._id || student.user;
        
        const clearance = await Clearance.findOne({ student: userObjectId })
          .sort({ createdAt: -1 })
          .lean();
          
        if (!clearance) {
            return res.status(404).json({ message: 'No clearance request found for this student' });
        }
        
        // Include active loan count so Library Admin knows current borrow status
        // BookLoan.student references the Student model, so use student._id here
        const activeLoans = await BookLoan.find({
            student: student._id,
            status: { $ne: 'Returned' }
        }).populate('book', 'title isbn dueDate').lean();
        
        // Proctor Auto-Checks
        // 1. Behavior & Discipline: Check for unresolved violations
        const unresolvedViolations = await Violation.countDocuments({
            student: userObjectId,
            status: { $in: ['REPORTED', 'UNDER_REVIEW'] }
        });
        
        clearance.student = {
          name: student.user?.name,
          studentId: student.studentId,
          academicYear: student.academicYear
        };
        clearance.activeLoans = activeLoans;
        clearance.activeLoansCount = activeLoans.length;
        
        // These will be used by the frontend to pre-fill the checklist
        clearance.proctorAutoChecks = {
            behaviorClean: unresolvedViolations === 0,
            academicClean: clearance.steps.library.status === 'APPROVED',
            violationCount: unresolvedViolations
        };
        
        res.json(clearance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get clearances pending dean approval (all other units approved)
// @route   GET /api/clearance/pending/dean
// @access  Private (Dean/Super Admin)
const getPendingDeanClearances = async (req, res) => {
  try {
    const pending = await Clearance.find({
      'steps.library.status': 'APPROVED',
      'steps.department.status': 'APPROVED',
      'steps.proctor.status': 'APPROVED',
      'steps.dormitory.status': 'APPROVED',
      'steps.dean.status': 'PENDING'
    }).populate('student', 'name email');
    
    res.json(pending);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Download clearance certificate PDF
// @route   GET /api/clearance/:id/certificate
// @access  Private (Student)
const downloadCertificate = async (req, res) => {
  try {
    const clearance = await Clearance.findById(req.params.id)
      .populate('student'); // This is the User model

    if (!clearance) {
      return res.status(404).json({ message: 'Clearance record not found' });
    }

    // Fetch the Student profile for additional details (studentId, department, etc.)
    const studentProfile = await Student.findOne({ user: clearance.student._id })
      .populate('department college');
    
    if (!studentProfile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Security check: only the student or an admin can download
    if (clearance.student._id.toString() !== req.user.id && !['SUPER_ADMIN', 'REGISTRAR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to access this certificate' });
    }

    if (clearance.status !== 'CLEARED') {
      return res.status(400).json({ message: 'Clearance is not yet completed' });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Clearance_Certificate_${studentProfile.studentId || 'N/A'}.pdf`);

    // Stream the PDF to the response
    doc.pipe(res);

    // --- Header ---
    doc.fillColor('#1A1F3C')
       .fontSize(26)
       .text('UNIVERSITY CLEARANCE CERTIFICATE', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.strokeColor('#2D3597')
       .lineWidth(2)
       .moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .stroke();
    
    doc.moveDown(2);

    // --- Body ---
    doc.fillColor('#000000')
       .fontSize(14)
       .text('This is to certify that', { align: 'center' });
    
    doc.moveDown(1);
    doc.fontSize(22)
       .font('Helvetica-Bold')
       .text(clearance.student.name.toUpperCase(), { align: 'center' });
    
    doc.moveDown(0.5);
    doc.font('Helvetica')
       .fontSize(14)
       .text(`Student ID: ${studentProfile.studentId || 'N/A'}`, { align: 'center' });
    
    doc.moveDown(0.5);
    doc.text(`Department: ${studentProfile.department?.name || 'N/A'}`, { align: 'center' });
    doc.text(`College: ${studentProfile.college?.name || 'N/A'}`, { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(12)
       .text('has successfully completed the university clearance process and is officially cleared from all academic and administrative units.', { align: 'center', lineGap: 5 });

    doc.moveDown(3);

    // --- Approval Table ---
    const startX = 75;
    const tableTop = doc.y;
    const col1 = 200;
    const col2 = 150;
    const col3 = 100;

    // Table Header
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Unit / Department', startX, tableTop);
    doc.text('Status', startX + col1, tableTop);
    doc.text('Date Approved', startX + col1 + col2, tableTop);
    
    doc.moveDown(0.5);
    doc.moveTo(startX, doc.y).lineTo(startX + col1 + col2 + col3, doc.y).stroke();
    doc.moveDown(0.5);

    // Table Rows
    const drawRow = (label, step) => {
      doc.font('Helvetica').fontSize(10);
      doc.text(label, startX, doc.y);
      doc.fillColor(step.status === 'APPROVED' ? '#008000' : '#FF0000');
      doc.text(step.status, startX + col1, doc.y - 12); // Adjust Y because doc.text moves down
      doc.fillColor('#000000');
      const dateStr = step.updatedAt ? new Date(step.updatedAt).toLocaleDateString() : 'N/A';
      doc.text(dateStr, startX + col1 + col2, doc.y - 12);
      doc.moveDown(0.8);
    };

    drawRow('Library Unit', clearance.steps.library);
    drawRow('Academic Department', clearance.steps.department);
    drawRow('Proctor / Student Affairs', clearance.steps.proctor);
    drawRow('Dormitory / Housing', clearance.steps.dormitory);
    drawRow('Dean of Students', clearance.steps.dean);
    drawRow('University Registrar', clearance.steps.registrar);

    doc.moveDown(4);

    // --- Signatures ---
    const sigY = doc.y;
    doc.moveTo(75, sigY).lineTo(225, sigY).stroke();
    doc.moveTo(370, sigY).lineTo(520, sigY).stroke();
    
    doc.fontSize(10).text('University Registrar', 75, sigY + 5, { width: 150, align: 'center' });
    doc.text('Dean of Students', 370, sigY + 5, { width: 150, align: 'center' });

    doc.moveDown(4);

    // --- Footer ---
    doc.fontSize(9).fillColor('#666666')
       .text(`Issued on: ${new Date(clearance.clearedAt || Date.now()).toLocaleString()}`, { align: 'center' });
    doc.text(`Verification ID: ${clearance._id.toString().toUpperCase()}`, { align: 'center' });

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('PDF Generation Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate certificate' });
    }
  }
};

module.exports = {
  applyForClearance,
  getMyClearance,
  updateStepStatus,
  getClearanceByStudentId,
  getPendingDeanClearances,
  downloadCertificate,
};