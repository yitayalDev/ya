const User = require('../models/User');

// @desc    Get all staff in a college (Users with staff roles)
// @route   GET /api/staff
// @access  Private/Admin
const getStaff = async (req, res) => {
  try {
    let query = {};
    
    // Define which roles are considered "staff"
    const staffRoles = ['DEPARTMENT_ADMIN', 'REGISTRAR', 'INSTRUCTOR'];

    if (req.user.role === 'COLLEGE_ADMIN') {
      query = { 
        college: req.user.college,
        role: { $in: staffRoles }
      };
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      if (!req.user.department) {
        return res.json([]); // Return empty array if admin is not assigned to a department
      }
      query = { 
        department: req.user.department,
        role: { $in: staffRoles }
      };
      console.log('DEBUG: Dept Admin searching for staff in department:', req.user.department);
    } else if (req.query.collegeId) {
      query = { 
        college: req.query.collegeId,
        role: { $in: staffRoles }
      };
    } else {
      query = { role: { $in: staffRoles } };
    }

    const staff = await User.find(query)
      .populate('college', 'name')
      .populate('department', 'name')
      .select('-password');
      
    console.log(`DEBUG: Found ${staff.length} staff members for this query.`);
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a staff member
// @route   POST /api/staff
// @access  Private/Admin
const createStaff = async (req, res) => {
  const { name, email, password, role, departmentId, collegeId } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const college = req.user.role === 'COLLEGE_ADMIN' ? req.user.college : collegeId;

    if (!college) {
      return res.status(400).json({ message: 'Please provide a college ID' });
    }

    const normalizedRole = role || 'INSTRUCTOR';
    const normalizedDepartmentId =
      normalizedRole === 'REGISTRAR' ? undefined : (departmentId || undefined);

    if (normalizedRole !== 'REGISTRAR' && !normalizedDepartmentId) {
      return res.status(400).json({ message: 'Please assign a department for this staff role' });
    }

    const user = await User.create({
      name,
      email,
      password: password || 'password123',
      role: normalizedRole,
      college,
      department: normalizedDepartmentId,
    });

    // Populate the newly created user
    const populatedUser = await User.findById(user._id)
      .populate('college', 'name')
      .populate('department', 'name')
      .select('-password');

    res.status(201).json(populatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a staff member
// @route   PUT /api/staff/:id
// @access  Private/Admin
const updateStaff = async (req, res) => {
  try {
    const { name, email, role, departmentId } = req.body;
    
    // Find the staff member
    let staffMember = await User.findById(req.params.id);
    
    if (!staffMember) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    // Ensure it's the right college for COLLEGE_ADMIN
    if (req.user.role === 'COLLEGE_ADMIN' && 
        staffMember.college.toString() !== req.user.college.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if email is already taken by another user
    if (email && email !== staffMember.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (emailExists) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
    }
    
    // Update fields
    if (name) staffMember.name = name;
    if (email) staffMember.email = email;
    const nextRole = role || staffMember.role;
    if (role) staffMember.role = role;

    if (nextRole === 'REGISTRAR') {
      staffMember.department = undefined;
    } else if (departmentId !== undefined) {
      if (!departmentId) {
        return res.status(400).json({ message: 'Please assign a department for this staff role' });
      }
      staffMember.department = departmentId;
    } else if (!staffMember.department) {
      return res.status(400).json({ message: 'Please assign a department for this staff role' });
    }
    
    await staffMember.save();
    
    // Populate and return updated staff
    const updatedStaff = await User.findById(staffMember._id)
      .populate('college', 'name')
      .populate('department', 'name')
      .select('-password');
      
    res.json(updatedStaff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a staff member
// @route   DELETE /api/staff/:id
// @access  Private/Admin
const deleteStaff = async (req, res) => {
  try {
    const staffMember = await User.findById(req.params.id);
    
    if (!staffMember) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    // Ensure it's the right college for COLLEGE_ADMIN
    if (req.user.role === 'COLLEGE_ADMIN' && 
        staffMember.college.toString() !== req.user.college.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await staffMember.deleteOne();
    
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getStaff, createStaff, updateStaff, deleteStaff };
