const AcademicPolicy = require('../models/AcademicPolicy');
const Campus = require('../models/Campus');
const College = require('../models/College');
const AuditLog = require('../models/AuditLog');

// @desc    Get all academic policies
// @route   GET /api/policies
// @access  Private (Super Admin)
const getPolicies = async (req, res) => {
  try {
    const { scope, campus, college, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (scope) filter.scope = scope;
    if (campus) filter.campus = campus;
    if (college) filter.college = college;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const policies = await AcademicPolicy.find(filter)
      .populate('campus', 'name')
      .populate('college', 'name')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AcademicPolicy.countDocuments(filter);

    res.json({
      policies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getPolicies error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single policy
// @route   GET /api/policies/:id
// @access  Private (Super Admin)
const getPolicy = async (req, res) => {
  try {
    const policy = await AcademicPolicy.findById(req.params.id)
      .populate('campus', 'name')
      .populate('college', 'name')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    res.json(policy);
  } catch (error) {
    console.error('getPolicy error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new academic policy
// @route   POST /api/policies
// @access  Private (Super Admin)
const createPolicy = async (req, res) => {
  try {
    const {
      name,
      description,
      scope,
      campus,
      college,
      creditHourPolicy,
      gpaSystem,
      gradingPolicy,
      attendancePolicy,
      academicStatusRules,
    } = req.body;

    // Validate scope-specific requirements
    if (scope === 'CAMPUS' && !campus) {
      return res.status(400).json({ message: 'Campus is required for campus-specific policies' });
    }
    if (scope === 'COLLEGE' && !college) {
      return res.status(400).json({ message: 'College is required for college-specific policies' });
    }

    // Check for existing active policy in same scope
    const existingFilter = { scope, isActive: true };
    if (scope === 'CAMPUS') existingFilter.campus = campus;
    if (scope === 'COLLEGE') existingFilter.college = college;

    const existingPolicy = await AcademicPolicy.findOne(existingFilter);
    if (existingPolicy) {
      return res.status(400).json({
        message: `An active ${scope.toLowerCase()} policy already exists. Please deactivate it first.`,
      });
    }

    const policy = await AcademicPolicy.create({
      name,
      description,
      scope,
      campus,
      college,
      creditHourPolicy,
      gpaSystem,
      gradingPolicy,
      attendancePolicy,
      academicStatusRules,
      createdBy: req.user._id,
    });

    const populatedPolicy = await AcademicPolicy.findById(policy._id)
      .populate('campus', 'name')
      .populate('college', 'name')
      .populate('createdBy', 'name email');

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_POLICY',
      module: 'ACADEMIC_POLICIES',
      details: { policyId: policy._id, name: policy.name, scope: policy.scope },
      method: req.method,
      path: req.originalUrl
    });

    res.status(201).json({
      message: 'Academic policy created successfully',
      policy: populatedPolicy,
    });
  } catch (error) {
    console.error('createPolicy error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Policy name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update academic policy
// @route   PUT /api/policies/:id
// @access  Private (Super Admin)
const updatePolicy = async (req, res) => {
  try {
    const {
      name,
      description,
      creditHourPolicy,
      gpaSystem,
      gradingPolicy,
      attendancePolicy,
      academicStatusRules,
    } = req.body;

    const policy = await AcademicPolicy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    // Update fields
    if (name) policy.name = name;
    if (description !== undefined) policy.description = description;
    if (creditHourPolicy) policy.creditHourPolicy = { ...policy.creditHourPolicy, ...creditHourPolicy };
    if (gpaSystem) policy.gpaSystem = { ...policy.gpaSystem, ...gpaSystem };
    if (gradingPolicy) policy.gradingPolicy = { ...policy.gradingPolicy, ...gradingPolicy };
    if (attendancePolicy) policy.attendancePolicy = { ...policy.attendancePolicy, ...attendancePolicy };
    if (academicStatusRules) policy.academicStatusRules = { ...policy.academicStatusRules, ...academicStatusRules };

    policy.updatedBy = req.user._id;
    await policy.save();

    const updatedPolicy = await AcademicPolicy.findById(policy._id)
      .populate('campus', 'name')
      .populate('college', 'name')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_POLICY',
      module: 'ACADEMIC_POLICIES',
      details: { policyId: policy._id, name: policy.name },
      method: req.method,
      path: req.originalUrl
    });

    res.json({
      message: 'Academic policy updated successfully',
      policy: updatedPolicy,
    });
  } catch (error) {
    console.error('updatePolicy error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Policy name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete/Deactivate academic policy
// @route   DELETE /api/policies/:id
// @access  Private (Super Admin)
const deletePolicy = async (req, res) => {
  try {
    const policy = await AcademicPolicy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    // Soft delete by deactivating
    policy.isActive = false;
    policy.updatedBy = req.user._id;
    await policy.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_POLICY',
      module: 'ACADEMIC_POLICIES',
      details: { policyId: policy._id, name: policy.name },
      method: req.method,
      path: req.originalUrl
    });

    res.json({ message: 'Academic policy deactivated successfully' });
  } catch (error) {
    console.error('deletePolicy error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get effective policy for a context (campus/college)
// @route   GET /api/policies/effective
// @access  Private (All authenticated users)
const getEffectivePolicy = async (req, res) => {
  try {
    const { campus, college } = req.query;

    let policy = null;

    // Try college-specific first
    if (college) {
      policy = await AcademicPolicy.findOne({
        scope: 'COLLEGE',
        college,
        isActive: true,
      });
    }

    // Try campus-specific if no college policy
    if (!policy && campus) {
      policy = await AcademicPolicy.findOne({
        scope: 'CAMPUS',
        campus,
        isActive: true,
      });
    }

    // Fall back to global
    if (!policy) {
      policy = await AcademicPolicy.findOne({
        scope: 'GLOBAL',
        isActive: true,
      });
    }

    if (!policy) {
      return res.status(404).json({ message: 'No active academic policy found' });
    }

    res.json(policy);
  } catch (error) {
    console.error('getEffectivePolicy error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Activate a policy (deactivate others in same scope)
// @route   PUT /api/policies/:id/activate
// @access  Private (Super Admin)
const activatePolicy = async (req, res) => {
  try {
    const policy = await AcademicPolicy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    // Deactivate other policies in same scope
    const deactivateFilter = { scope: policy.scope, isActive: true };
    if (policy.scope === 'CAMPUS') deactivateFilter.campus = policy.campus;
    if (policy.scope === 'COLLEGE') deactivateFilter.college = policy.college;

    await AcademicPolicy.updateMany(deactivateFilter, { isActive: false });

    // Activate this policy
    policy.isActive = true;
    policy.updatedBy = req.user._id;
    await policy.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'ACTIVATE_POLICY',
      module: 'ACADEMIC_POLICIES',
      details: { policyId: policy._id, name: policy.name, scope: policy.scope },
      method: req.method,
      path: req.originalUrl
    });

    res.json({ message: 'Policy activated successfully' });
  } catch (error) {
    console.error('activatePolicy error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getEffectivePolicy,
  activatePolicy,
};