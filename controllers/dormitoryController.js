const mongoose = require('mongoose');
const Dormitory = require('../models/Dormitory');
const User = require('../models/User');

// @desc    Get all dormitories
// @route   GET /api/dormitories
// @access  Private/Super Admin
const getDormitories = async (req, res) => {
  try {
    const dorms = await Dormitory.find({})
      .populate('dormitoryAdmin', 'name email')
      .populate('campus', 'name');
    res.json(dorms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a dormitory and its admin
// @route   POST /api/dormitories
// @access  Private/Super Admin
const createDormitory = async (req, res) => {
  try {
    const { name, campus, location, description, totalRooms, totalCapacity, genderType, contactInfo, adminData } = req.body;

    let dormitoryAdminId = null;

    if (adminData) {
      const { name: adminName, email, password } = adminData;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const user = await User.create({
        name: adminName,
        email,
        password,
        role: 'DORMITORY_ADMIN',
        campus,
      });

      dormitoryAdminId = user._id;
    }

    const dorm = await Dormitory.create({
      name,
      campus,
      location,
      description,
      totalRooms,
      totalCapacity,
      genderType,
      contactInfo,
      dormitoryAdmin: dormitoryAdminId,
    });

    const populatedDorm = await Dormitory.findById(dorm._id)
      .populate('dormitoryAdmin', 'name email')
      .populate('campus', 'name');

    res.status(201).json(populatedDorm);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update dormitory
// @route   PUT /api/dormitories/:id
// @access  Private/Super Admin
const updateDormitory = async (req, res) => {
  try {
    const dorm = await Dormitory.findById(req.params.id);
    if (!dorm) {
      return res.status(404).json({ message: 'Dormitory not found' });
    }

    const { name, location, description, totalRooms, totalCapacity, genderType, contactInfo, isActive } = req.body;

    dorm.name = name || dorm.name;
    dorm.location = location || dorm.location;
    dorm.description = description || dorm.description;
    dorm.totalRooms = totalRooms || dorm.totalRooms;
    dorm.totalCapacity = totalCapacity || dorm.totalCapacity;
    dorm.genderType = genderType || dorm.genderType;
    dorm.contactInfo = contactInfo || dorm.contactInfo;
    dorm.isActive = isActive !== undefined ? isActive : dorm.isActive;

    await dorm.save();

    const updatedDorm = await Dormitory.findById(dorm._id)
      .populate('dormitoryAdmin', 'name email')
      .populate('campus', 'name');

    res.json(updatedDorm);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dormitory by campus
// @route   GET /api/dormitories/campus/:campusId
// @access  Private (Dormitory Admin, Student)
const getDormitoryByCampus = async (req, res) => {
  try {
    const { campusId } = req.params;
    const dormitory = await Dormitory.findOne({ campus: campusId })
      .populate('dormitoryAdmin', 'name email')
      .populate('campus', 'name');

    if (!dormitory) {
      return res.status(404).json({ message: 'No dormitory found for this campus' });
    }

    res.json(dormitory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete dormitory
// @route   DELETE /api/dormitories/:id
// @access  Private/Super Admin
const deleteDormitory = async (req, res) => {
  try {
    const dorm = await Dormitory.findById(req.params.id);
    if (!dorm) {
      return res.status(404).json({ message: 'Dormitory not found' });
    }

    await dorm.deleteOne();
    res.json({ message: 'Dormitory removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDormitories,
  createDormitory,
  updateDormitory,
  deleteDormitory,
  getDormitoryByCampus,
};
