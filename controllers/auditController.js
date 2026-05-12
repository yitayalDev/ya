const AuditLog = require('../models/AuditLog');

// @desc    Get all audit logs
// @route   GET /api/audit
// @access  Private (Registrar, Super Admin)
const getAuditLogs = async (req, res) => {
    try {
        const { module, action, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (module) filter.module = module;
        if (action) filter.action = action;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const logs = await AuditLog.find(filter)
            .populate('user', 'name role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await AuditLog.countDocuments(filter);

        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getAuditLogs };
