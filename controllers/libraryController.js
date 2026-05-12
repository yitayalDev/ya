const mongoose = require('mongoose');
const Library = require('../models/Library');
const User = require('../models/User');

// @desc    Get all libraries
// @route   GET /api/libraries
// @access  Private/Super Admin
const getLibraries = async (req, res) => {
  try {
    const libraries = await Library.find({})
      .populate('libraryAdmin', 'name email')
      .populate('campus', 'name');
    res.json(libraries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a library and its admin
// @route   POST /api/libraries
// @access  Private/Super Admin
const createLibrary = async (req, res) => {
  try {
    const { name, campus, location, description, contactInfo, capacity, adminData } = req.body;

    // Check if library already exists for this campus
    const existingLibrary = await Library.findOne({ campus });
    if (existingLibrary) {
      return res.status(400).json({ message: 'A library already exists for this campus' });
    }

    let libraryAdminId = null;

    if (adminData) {
      const { name: adminName, email, password } = adminData;

      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const user = await User.create({
        name: adminName,
        email,
        password,
        role: 'LIBRARY_ADMIN',
        campus,
      });

      libraryAdminId = user._id;
    }

    const library = await Library.create({
      name,
      campus,
      location,
      description,
      contactInfo,
      capacity: capacity || 100,
      libraryAdmin: libraryAdminId,
    });

    const populatedLibrary = await Library.findById(library._id)
      .populate('libraryAdmin', 'name email')
      .populate('campus', 'name');

    res.status(201).json(populatedLibrary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update library
// @route   PUT /api/libraries/:id
// @access  Private/Super Admin
const updateLibrary = async (req, res) => {
  try {
    const library = await Library.findById(req.params.id);
    if (!library) {
      return res.status(404).json({ message: 'Library not found' });
    }

    const { name, location, description, contactInfo, capacity, isActive } = req.body;

    library.name = name || library.name;
    library.location = location || library.location;
    library.description = description || library.description;
    library.contactInfo = contactInfo || library.contactInfo;
    library.capacity = capacity !== undefined ? capacity : library.capacity;
    library.isActive = isActive !== undefined ? isActive : library.isActive;

    await library.save();

    const updatedLibrary = await Library.findById(library._id)
      .populate('libraryAdmin', 'name email')
      .populate('campus', 'name');

    res.json(updatedLibrary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign library admin
// @route   PUT /api/libraries/:id/assign-admin
// @access  Private/Super Admin
const assignLibraryAdmin = async (req, res) => {
  try {
    const { adminId } = req.body;
    const library = await Library.findById(req.params.id);

    if (!library) {
      return res.status(404).json({ message: 'Library not found' });
    }

    // Verify admin exists and has appropriate role
    if (adminId) {
      const admin = await User.findById(adminId);
      if (!admin) {
        return res.status(400).json({ message: 'Library admin not found' });
      }
      if (admin.role !== 'LIBRARY_ADMIN') {
        return res.status(400).json({ message: 'Selected user is not authorized to be library admin' });
      }
    }

    library.libraryAdmin = adminId || null;
    await library.save();

    const updatedLibrary = await Library.findById(library._id)
      .populate('libraryAdmin', 'name email')
      .populate('campus', 'name');

    res.json({
      message: adminId ? 'Library admin assigned successfully' : 'Library admin removed successfully',
      library: updatedLibrary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get assigned library for the logged in admin or campus library for student
// @route   GET /api/libraries/my/assigned
// @access  Private
const getMyLibrary = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'STUDENT' || req.user.role === 'SUPER_ADMIN') {
      // For students or super admin, find library by their campus
      if (!req.user.campus) {
        return res.status(404).json({ message: 'No campus assigned to this user' });
      }
      query = { campus: req.user.campus };
    } else if (req.user.role === 'LIBRARY_ADMIN') {
      // For library admins, find library assigned specifically to them
      query = { libraryAdmin: req.user._id };
    } else {
      return res.status(403).json({ message: 'Not authorized to access library data' });
    }

    const library = await Library.findOne(query).populate('campus', 'name');
    
    if (!library) {
      return res.status(404).json({ message: 'No library found for your campus/account' });
    }
    
    res.json(library);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete library
// @route   DELETE /api/library-ops/libraries/:id
// @access  Private/Super Admin
const deleteLibrary = async (req, res) => {
  try {
    const library = await Library.findById(req.params.id);
    if (!library) {
      return res.status(404).json({ message: 'Library not found' });
    }

    await library.deleteOne();
    res.json({ message: 'Library removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLibraries,
  createLibrary,
  updateLibrary,
  assignLibraryAdmin,
  getMyLibrary,
  deleteLibrary
};
