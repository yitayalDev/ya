const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get all messages
// @route   GET /api/messages
// @access  Private
const getMessages = async (req, res) => {
  try {
    let query = {};

    // If user is SUPER_ADMIN, they only see messages from staff (non-students)
    if (req.user.role === 'SUPER_ADMIN') {
      const staff = await User.find({ role: { $ne: 'STUDENT' } }).select('_id');
      const staffIds = staff.map((u) => u._id);
      query.sender = { $in: staffIds };
    }

    // If user is STUDENT, they don't see messages from SUPER_ADMIN
    if (req.user.role === 'STUDENT') {
      const superAdmins = await User.find({ role: 'SUPER_ADMIN' }).select('_id');
      const superAdminIds = superAdmins.map((u) => u._id);
      query.sender = { $nin: superAdminIds };
    }

    const messages = await Message.find(query).populate('sender', 'name role');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  const { content } = req.body;

  try {
    // If Super Admin is only allowed to communicate with staff, 
    // in this global chat it means their message is intended for staff.
    // The filtering in getMessages handles the "who sees what" part.

    const message = await Message.create({
      sender: req.user._id,
      content,
    });

    const populatedMessage = await Message.findById(message._id).populate('sender', 'name role');
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMessages, sendMessage };
