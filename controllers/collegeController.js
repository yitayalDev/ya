const College = require('../models/College');

// @desc    Get all colleges
// @route   GET /api/colleges
// @access  Private
const getColleges = async (req, res) => {
  try {
    const colleges = await College.find({}).populate('campus', 'name');
    res.json(colleges);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a college
// @route   POST /api/colleges
// @access  Private/Admin
const createCollege = async (req, res) => {
  const { name, campusId, description } = req.body;

  try {
    const college = await College.create({
      name,
      campus: campusId,
      description,
    });

    res.status(201).json(college);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a college
// @route   PUT /api/colleges/:id
// @access  Private/Admin
const updateCollege = async (req, res) => {
  try {
    const { name, campusId, description } = req.body;
    const college = await College.findById(req.params.id);

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    college.name = name || college.name;
    college.campus = campusId || college.campus;
    college.description = description || college.description;

    const updatedCollege = await college.save();
    res.json(updatedCollege);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a college
// @route   DELETE /api/colleges/:id
// @access  Private/Admin
const deleteCollege = async (req, res) => {
  try {
    const college = await College.findById(req.params.id);

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    await college.deleteOne();
    res.json({ message: 'College removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getColleges, createCollege, updateCollege, deleteCollege };
