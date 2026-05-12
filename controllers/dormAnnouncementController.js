const DormAnnouncement = require('../models/DormAnnouncement');
const DormBed = require('../models/DormBed');

// @desc    Create announcement
// @route   POST /api/dorm-announcements
// @access  Private/Dormitory Admin/Proctor
const createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetType, targetId, priority } = req.body;

    const announcement = await DormAnnouncement.create({
      sender: req.user.id,
      title,
      content,
      targetType,
      targetId,
      priority: priority || 'NORMAL',
    });

    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get announcements for a student
// @route   GET /api/dorm-announcements/my-announcements
// @access  Private/Student
const getMyAnnouncements = async (req, res) => {
  try {
    // 1. Find student's location
    const bed = await DormBed.findOne({ student: req.user.id }).populate({
      path: 'room',
      populate: {
        path: 'floor',
        populate: {
          path: 'block',
          populate: { path: 'building' }
        }
      }
    });

    const query = {
      $or: [
        { targetType: 'ALL' },
      ]
    };

    if (bed && bed.room && bed.room.floor && bed.room.floor.block) {
      const block = bed.room.floor.block;
      const building = block.building;
      const campusId = building.campus;

      query.$or.push(
        { targetType: 'BLOCK', targetId: block._id },
        { targetType: 'BUILDING', targetId: building._id },
        { targetType: 'CAMPUS', targetId: campusId }
      );
    }

    const announcements = await DormAnnouncement.find(query)
      .populate('sender', 'name role')
      .sort({ createdAt: -1 });

    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createAnnouncement,
  getMyAnnouncements,
};
