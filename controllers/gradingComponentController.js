const GradingComponent = require('../models/GradingComponent');
const Course = require('../models/Course');
const { validateComponentWeights, getEffectivePolicy } = require('../utils/gradeCalculator');

// @desc    Get all grading components for a course
// @route   GET /api/grading-components/course/:courseId
// @access  Private (Department Admin, Instructor)
const getComponentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const components = await GradingComponent.find({ course: courseId, isActive: true })
      .sort('sequenceOrder')
      .populate('createdBy', 'name email');

    res.json(components);
  } catch (error) {
    console.error('getComponentsByCourse error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create grading component for a course
// @route   POST /api/grading-components
// @access  Private (Department Admin)
const createComponent = async (req, res) => {
  try {
    const { course, name, weight, maxScore, isRequired, description, sequenceOrder } = req.body;

    // Verify course exists
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if component name already exists for this course
    const existing = await GradingComponent.findOne({ course, name, isActive: true });
    if (existing) {
      return res.status(400).json({ message: `Component "${name}" already exists for this course` });
    }

    // Validate weight sum with other active components
    const allComponents = await GradingComponent.find({ course, isActive: true });
    const totalWeight = allComponents.reduce((sum, comp) => sum + comp.weight, 0) + weight;

    if (totalWeight > 100) {
      return res.status(400).json({
        message: `Total weight exceeds 100%. Current total would be: ${totalWeight}%`,
      });
    }

    const component = await GradingComponent.create({
      course,
      name,
      weight,
      maxScore: maxScore || 100,
      isRequired: isRequired !== false,
      description,
      sequenceOrder: sequenceOrder || 1,
      createdBy: req.user._id,
    });

    // Populate creator info
    await component.populate('createdBy', 'name email');

    res.status(201).json(component);
  } catch (error) {
    console.error('createComponent error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update grading component
// @route   PUT /api/grading-components/:id
// @access  Private (Department Admin)
const updateComponent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, weight, maxScore, isRequired, description, sequenceOrder, isActive } = req.body;

    const component = await GradingComponent.findById(id);
    if (!component) {
      return res.status(404).json({ message: 'Grading component not found' });
    }

    // Check if new name conflicts with existing component (excluding current)
    if (name && name !== component.name) {
      const existing = await GradingComponent.findOne({
        course: component.course,
        name,
        isActive: true,
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ message: `Component "${name}" already exists for this course` });
      }
    }

    // If updating weight, validate total doesn't exceed 100%
    if (weight !== undefined && weight !== component.weight) {
      const allComponents = await GradingComponent.find({
        course: component.course,
        isActive: true,
        _id: { $ne: id },
      });
      const totalWeight = allComponents.reduce((sum, comp) => sum + comp.weight, 0) + weight;

      if (totalWeight > 100) {
        return res.status(400).json({
          message: `Total weight exceeds 100%. New total would be: ${totalWeight}%`,
        });
      }
    }

    // Update fields
    if (name !== undefined) component.name = name;
    if (weight !== undefined) component.weight = weight;
    if (maxScore !== undefined) component.maxScore = maxScore;
    if (isRequired !== undefined) component.isRequired = isRequired;
    if (description !== undefined) component.description = description;
    if (sequenceOrder !== undefined) component.sequenceOrder = sequenceOrder;
    if (isActive !== undefined) component.isActive = isActive;

    await component.save();
    await component.populate('createdBy', 'name email');

    res.json(component);
  } catch (error) {
    console.error('updateComponent error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete grading component (soft delete by setting isActive=false)
// @route   DELETE /api/grading-components/:id
// @access  Private (Department Admin)
const deleteComponent = async (req, res) => {
  try {
    const { id } = req.params;

    const component = await GradingComponent.findById(id);
    if (!component) {
      return res.status(404).json({ message: 'Grading component not found' });
    }

    // Check if any grades exist for this component
    const Grade = require('../models/Grade');
    const existingGrades = await Grade.exists({ component: id });

    if (existingGrades) {
      // Soft delete - just mark as inactive
      component.isActive = false;
      await component.save();
      return res.json({
        message: 'Component deleted (soft delete - grades preserved)',
        warning: 'Existing grades associated with this component remain in the system.',
      });
    }

    // Hard delete if no grades exist
    await component.deleteOne();
    res.json({ message: 'Component permanently deleted' });
  } catch (error) {
    console.error('deleteComponent error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Validate grading structure for a course
// @route   POST /api/grading-components/validate/:courseId
// @access  Private (Department Admin, Instructor)
const validateStructure = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Get course to determine policy context
    const course = await Course.findById(courseId).populate('college');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get effective policy
    const policy = await getEffectivePolicy(course.college.campus, course.college._id);

    const components = await GradingComponent.find({ course: courseId, isActive: true });

    const validation = validateComponentWeights(components, policy);

    res.json({
      isValid: validation.isValid,
      totalWeight: validation.totalWeight || 0,
      components: components.length,
      message: validation.message,
    });
  } catch (error) {
    console.error('validateStructure error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getComponentsByCourse,
  createComponent,
  updateComponent,
  deleteComponent,
  validateStructure,
};
