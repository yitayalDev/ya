const Clinic = require('../models/Clinic');
const MedicalStaff = require('../models/MedicalStaff');
const User = require('../models/User');

// @desc    Create a new clinic
// @route   POST /api/clinics
// @access  Private (Super Admin)
const createClinic = async (req, res) => {
  try {
    const clinic = await Clinic.create(req.body);
    res.status(201).json(clinic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all clinics (filtered by assignment for CLINIC_ADMIN/PHARMACIST/DOCTOR)
// @route   GET /api/clinics
// @access  Private
const getClinics = async (req, res) => {
  try {
    const restrictedRoles = ['CLINIC_ADMIN', 'PHARMACIST', 'DOCTOR'];

    if (restrictedRoles.includes(req.user.role)) {
      // Find the clinic this staff member is assigned to
      const staffRecord = await MedicalStaff.findOne({ user: req.user._id }).populate('clinic');
      if (!staffRecord || !staffRecord.clinic) {
        // Fallback: return all clinics so they can still see something
        const clinics = await Clinic.find().populate('campus', 'name');
        return res.json(clinics);
      }
      // Populate campus on the clinic
      const clinic = await Clinic.findById(staffRecord.clinic._id).populate('campus', 'name');
      return res.json(clinic ? [clinic] : []);
    }

    // SUPER_ADMIN and others get all clinics
    const clinics = await Clinic.find().populate('campus', 'name');
    res.json(clinics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add staff to a clinic
// @route   POST /api/clinics/:id/staff
// @access  Private (Super Admin / Clinic Admin)
const addStaff = async (req, res) => {
  try {
    const { userId, role, specialization } = req.body;
    const clinicId = req.params.id;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user role to match medical role
    user.role = role;
    await user.save();

    const staff = await MedicalStaff.create({
      user: userId,
      clinic: clinicId,
      role,
      specialization
    });

    res.status(201).json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get staff for a clinic
// @route   GET /api/clinics/:id/staff
// @access  Private
const getClinicStaff = async (req, res) => {
  try {
    const staff = await MedicalStaff.find({ clinic: req.params.id })
      .populate('user', 'name email');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update clinic operating hours
// @route   PUT /api/clinics/:id/operating-hours
// @access  Private (Super Admin / Clinic Admin / Doctor)
const updateOperatingHours = async (req, res) => {
  try {
    const { open, close, slotMinutes } = req.body;

    if (!open || !close) {
      return res.status(400).json({ message: 'Open and close times are required.' });
    }

    const clinic = await Clinic.findById(req.params.id);
    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found.' });
    }

    clinic.operatingHours = {
      open,
      close,
      slotMinutes: Number(slotMinutes) > 0 ? Number(slotMinutes) : 30,
    };

    await clinic.save();
    res.json(clinic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createClinic,
  getClinics,
  addStaff,
  getClinicStaff,
  updateOperatingHours
};
