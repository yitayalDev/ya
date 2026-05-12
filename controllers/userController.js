const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('college', 'name')
      .populate('department', 'name')
      .populate('campus', 'name')
      .populate('assignedBuilding', 'name')
      .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users (filtered by role or college)
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'COLLEGE_ADMIN') {
      // College Admin sees their college staff
      query = { college: req.user.college };
    } else if (req.query.role) {
      // Super Admin can filter by role
      query = { role: req.query.role };
    }

    const users = await User.find(query)
      .populate('college', 'name')
      .populate('department', 'name')
      .select('-password');

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new user (Admin/Staff)
// @route   POST /api/users
// @access  Private
const createUser = async (req, res) => {
  const { name, email, password, role, collegeId, departmentId, campusId } = req.body;

  try {
    let userCollege = collegeId;
    let userRole = role || 'COLLEGE_ADMIN';
    let userDept = departmentId;

    if (req.user.role === 'COLLEGE_ADMIN') {
      userCollege = req.user.college;
      const allowedRoles = ['DEPARTMENT_ADMIN', 'REGISTRAR', 'INSTRUCTOR'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: 'Not authorized to create this role' });
      }
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      college: userCollege,
      department: userDept,
      campus: campusId,
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_USER',
      module: 'USER_MANAGEMENT',
      details: { email: user.email, role: user.role, name: user.name },
      method: req.method,
      path: req.originalUrl
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      college: user.college,
      department: user.department,
      campus: user.campus,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all college admins
// @route   GET /api/users/admins
// @access  Private/SuperAdmin
const getAdmins = async (req, res) => {
  try {
    const { type } = req.query;
    let role = 'COLLEGE_ADMIN';
    if (type == 'campus') role = 'CAMPUS_ADMIN';
    
    const admins = await User.find({ role })
      .populate('college', 'name')
      .populate('campus', 'name')
      .select('-password');
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a college or campus admin
// @route   POST /api/users/admins
// @access  Private/SuperAdmin
const createAdmin = async (req, res) => {
  const { name, email, password, collegeId, campusId, adminType } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const role = adminType == 'campus' ? 'CAMPUS_ADMIN' : 'COLLEGE_ADMIN';
    
    const user = await User.create({
      name,
      email,
      password,
      role,
      college: collegeId,
      campus: campusId,
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_ADMIN',
      module: 'USER_MANAGEMENT',
      details: { email: user.email, role: user.role, name: user.name },
      method: req.method,
      path: req.originalUrl
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      college: user.college,
      campus: user.campus,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.deleteOne();

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_USER',
      module: 'USER_MANAGEMENT',
      details: { email: user.email, role: user.role, name: user.name },
      method: req.method,
      path: req.originalUrl
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Impersonate a user
// @route   POST /api/users/impersonate/:id
// @access  Private/SuperAdmin
const impersonateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'IMPERSONATE_USER',
      module: 'USER_MANAGEMENT',
      details: { targetEmail: user.email, targetRole: user.role, targetName: user.name },
      method: req.method,
      path: req.originalUrl
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: token,
      isImpersonating: true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUsers, createUser, getAdmins, createAdmin, getMe, deleteUser, impersonateUser };
