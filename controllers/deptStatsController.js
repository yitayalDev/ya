const Course = require('../models/Course');
const Section = require('../models/Section');
const User = require('../models/User');

// @desc    Get department-wide statistics
// @route   GET /api/departments/stats
// @access  Private (Department Admin)
const getDeptStats = async (req, res) => {
  try {
    if (req.user.role !== 'DEPARTMENT_ADMIN') {
      return res.status(403).json({ message: 'Only Department Admins can access stats' });
    }

    const mongoose = require('mongoose');
    const deptId = new mongoose.Types.ObjectId(req.user.department);

    // 1. Total Courses
    const courseCount = await Course.countDocuments({ department: deptId });

    // 2. Total Sections
    const sectionCount = await Section.countDocuments({ department: deptId });

    // 3. Total Instructors
    const instructorCount = await User.countDocuments({ department: deptId, role: 'INSTRUCTOR' });

    // 4. Instructor Workload (Sections per instructor)
    const instructorWorkload = await Section.aggregate([
      { $match: { department: deptId } },
      { $group: { _id: '$instructor', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', sections: '$count' } }
    ]);

    // 5. Student Distribution (Enrollment per course)
    const studentDistribution = await Section.aggregate([
      { $match: { department: deptId } },
      { $group: { _id: '$course', totalEnrolled: { $sum: '$enrolledCount' }, totalCapacity: { $sum: '$capacity' } } },
      { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'courseInfo' } },
      { $unwind: '$courseInfo' },
      { $project: { title: '$courseInfo.title', enrolled: '$totalEnrolled', capacity: '$totalCapacity' } }
    ]);

    res.json({
      courseCount,
      sectionCount,
      instructorCount,
      instructorWorkload,
      studentDistribution
    });
  } catch (error) {
    console.error('getDeptStats error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDeptStats };
