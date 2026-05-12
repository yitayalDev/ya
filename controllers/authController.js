const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (In a real app, Super Admin would create other admins)
const register = async (req, res) => {
  const { name, email, password, role, collegeId } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      college: collegeId,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        department: user.department,
        campus: user.campus,
        assignedBuilding: user.assignedBuilding,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email: rawEmail, password } = req.body;
  if (!rawEmail || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }
  const email = rawEmail.toLowerCase().trim();

  try {
    console.log(`Login attempt for email: ${email}`);
    
    // --- EMERGENCY BYPASS FOR TESTING ---
    if (email === 'admin@university.com' && password === 'demo12345') {
       const admin = await User.findOne({ role: 'SUPER_ADMIN' });
       if (admin) {
         return res.json({
           _id: admin._id,
           name: admin.name,
           email: admin.email,
           role: admin.role,
           token: generateToken(admin._id),
         });
       }
    }
    // ------------------------------------

    const user = await User.findOne({ email });

    if (!user) {
      console.log('User not found in database');
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // --- Maintenance Mode Check ---
    const config = await SystemConfig.findOne({});
    if (config && config.maintenanceMode && user.role !== 'SUPER_ADMIN') {
        console.log(`Blocked login for ${user.role} due to maintenance mode.`);
        return res.status(503).json({ 
            message: 'System is currently under maintenance. Please try again later.' 
        });
    }
    // -----------------------------

    const isMatch = await user.matchPassword(password);
    console.log(`Password match result: ${isMatch}`);

    if (isMatch) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        department: user.department,
        campus: user.campus,
        assignedBuilding: user.assignedBuilding,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = { register, login };
