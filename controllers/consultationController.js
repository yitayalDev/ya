const MedicalVisit = require('../models/MedicalVisit');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const Student = require('../models/Student');

// @desc    Create a medical visit record (Consultation)
// @route   POST /api/consultations/visit
// @access  Private (Doctor)
const createMedicalVisit = async (req, res) => {
  try {
    const { appointment, student, clinic, vitals, complaint, assessment, diagnosis, notes, treatmentPlan, medicalCertificate } = req.body;

    // Handle empty strings for numbers
    if (vitals) {
      if (vitals.heartRate === '') vitals.heartRate = null;
      if (vitals.temperature === '') vitals.temperature = null;
      if (vitals.weight === '') vitals.weight = null;
    }

    const visit = await MedicalVisit.create({
      appointment: appointment,
      student: student,
      clinic: clinic,
      doctor: req.user._id,
      vitals,
      complaint,
      assessment,
      diagnosis,
      notes,
      treatmentPlan,
      medicalCertificate
    });

    // Update appointment status to COMPLETED if it exists
    if (appointment) {
      await Appointment.findByIdAndUpdate(appointment, { status: 'COMPLETED' });
    }

    res.status(201).json(visit);
  } catch (error) {
    console.error('CREATE_VISIT_ERROR:', error);
    require('fs').writeFileSync('visit_error.log', JSON.stringify({ error: error.message, stack: error.stack, body: req.body }, null, 2));
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create an e-prescription
// @route   POST /api/consultations/prescription
// @access  Private (Doctor)
const createPrescription = async (req, res) => {
  try {
    const { visitId, studentId, clinicId, medications, isEmergency } = req.body;

    const prescription = await Prescription.create({
      visit: visitId,
      student: studentId,
      doctor: req.user._id,
      clinic: clinicId,
      medications,
      isEmergency
    });

    // Notify Pharmacist
    if (req.io) {
      req.io.to(`clinic_${clinicId}`).emit('new_prescription', {
        prescriptionId: prescription._id,
        studentId
      });
    }

    res.status(201).json(prescription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get student's medical history
// @route   GET /api/consultations/history/:studentId
// @access  Private (Doctor / Student)
const getMedicalHistory = async (req, res) => {
  try {
    // If student, they can only see their own. If doctor, they can see anyone.
    const requestedStudentId = req.params.studentId;
    
    if (req.user.role === 'STUDENT') {
        const student = await Student.findOne({ user: req.user._id });
        if (student._id.toString() !== requestedStudentId) {
            return res.status(403).json({ message: 'Access denied' });
        }
    }

    const history = await MedicalVisit.find({ student: requestedStudentId })
      .populate('doctor', 'name')
      .populate('clinic', 'name')
      .sort({ createdAt: -1 });
      
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check prescription safety against student allergies
// @route   POST /api/consultations/check-safety
// @access  Private (Doctor)
const checkPrescriptionSafety = async (req, res) => {
  try {
    const { studentId, medications } = req.body;
    const student = await Student.findById(studentId);
    
    if (!student || !student.medicalProfile) {
      return res.json({ safe: true, warnings: [] });
    }

    const { allergies, chronicConditions } = student.medicalProfile;
    const warnings = [];

    medications.forEach(med => {
      const medName = med.medicineName.toLowerCase();
      
      // 1. Allergy Check
      const allergyMatch = allergies.find(a => medName.includes(a.toLowerCase()));
      if (allergyMatch) {
        warnings.push({
          type: 'ALLERGY',
          severity: 'CRITICAL',
          message: `🚨 Patient is ALLERGIC to ${allergyMatch}. Avoid ${med.medicineName}.`
        });
      }

      // 2. Condition Check (Example logic: Beta-blockers + Asthma)
      if (chronicConditions.some(c => c.toLowerCase().includes('asthma')) && 
          (medName.includes('propranolol') || medName.includes('atenolol'))) {
        warnings.push({
          type: 'CONTRAINDICATION',
          severity: 'HIGH',
          message: `⚠️ Patient has Asthma. Beta-blockers like ${med.medicineName} are high risk.`
        });
      }
    });

    res.json({
      safe: warnings.length === 0,
      warnings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createMedicalVisit,
  createPrescription,
  getMedicalHistory,
  checkPrescriptionSafety
};
