const MedicalStock = require('../models/MedicalStock');
const Prescription = require('../models/Prescription');

// @desc    Add or update medical stock
// @route   POST /api/pharmacy/stock
// @access  Private (Pharmacist / Admin)
const updateStock = async (req, res) => {
  try {
    const { clinic, name, quantity, category, unit, expiryDate, minStockLevel } = req.body;
    
    let item = await MedicalStock.findOne({ clinic, name });
    
    if (item) {
      item.quantity += quantity;
      if (expiryDate) item.expiryDate = expiryDate;
      await item.save();
    } else {
      item = await MedicalStock.create(req.body);
    }
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get stock for a clinic
// @route   GET /api/pharmacy/stock/:clinicId
// @access  Private
const getClinicStock = async (req, res) => {
  try {
    const stock = await MedicalStock.find({ clinic: req.params.clinicId });
    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending prescriptions for a clinic
// @route   GET /api/pharmacy/prescriptions/:clinicId
// @access  Private (Pharmacist)
const getPendingPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ 
      clinic: req.params.clinicId,
      status: { $in: ['PENDING', 'PREPARING', 'READY'] }
    })
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name studentId' }
      })
      .populate('doctor', 'name')
      .sort({ isEmergency: -1, createdAt: 1 });
      
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Dispense medication and update stock
// @route   PUT /api/pharmacy/dispense/:id
// @access  Private (Pharmacist)
const dispensePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) return res.status(404).json({ message: 'Prescription not found' });

    // Update stock for each medication
    for (let med of prescription.medications) {
      if (med.medicine) {
        await MedicalStock.findByIdAndUpdate(med.medicine, {
          $inc: { quantity: -1 } // Assuming 1 unit for now, or use med.quantity if added to schema
        });
      }
    }

    prescription.status = 'DISPENSED';
    prescription.pharmacist = req.user._id;
    prescription.dispensedAt = new Date();
    await prescription.save();

    // Notify Student
    if (req.io) {
      const Student = require('../models/Student');
      const studentDoc = await Student.findById(prescription.student).populate('user');
      if (studentDoc && studentDoc.user) {
        req.io.to(studentDoc.user._id.toString()).emit('medication_ready', {
          prescriptionId: prescription._id,
          clinicName: 'University Pharmacy'
        });
      }
    }

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  updateStock,
  getClinicStock,
  getPendingPrescriptions,
  dispensePrescription
};
