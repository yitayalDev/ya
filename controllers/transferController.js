const TransferRequest = require('../models/TransferRequest');
const Student = require('../models/Student');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');

// @desc    Submit a transfer request
// @route   POST /api/transfers
// @access  Private (Student)
const submitTransferRequest = async (req, res) => {
    const { newDepartmentId, targetDepartment, reason } = req.body;

    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        // Accept either a department ObjectId or a department name string
        let resolvedDeptId = newDepartmentId;
        if (!resolvedDeptId && targetDepartment) {
            const dept = await Department.findOne({ name: { $regex: new RegExp(targetDepartment, 'i') } });
            if (dept) {
                resolvedDeptId = dept._id;
            }
            // If no exact match, store the name as a text note in reason
        }

        const request = await TransferRequest.create({
            student: student._id,
            oldDepartment: student.department,
            newDepartment: resolvedDeptId || undefined,
            reason: resolvedDeptId ? reason : `[Requested: ${targetDepartment}] ${reason}`
        });

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my own transfer requests (student)
// @route   GET /api/transfers/my
// @access  Private (Student)
const getMyTransferRequests = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) return res.json([]);

        const requests = await TransferRequest.find({ student: student._id })
            .populate('oldDepartment', 'name')
            .populate('newDepartment', 'name')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all transfer requests
// @route   GET /api/transfers
// @access  Private (Registrar)
const getTransferRequests = async (req, res) => {
    try {
        const requests = await TransferRequest.find({})
            .populate({
                path: 'student',
                populate: { path: 'user', select: 'name studentId' }
            })
            .populate('oldDepartment', 'name')
            .populate('newDepartment', 'name')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Process a transfer request
// @route   PUT /api/transfers/:id
// @access  Private (Registrar)
const processTransferRequest = async (req, res) => {
    const { status, registrarComment } = req.body;

    try {
        const request = await TransferRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        request.status = status;
        request.registrarComment = registrarComment;
        request.processedBy = req.user._id;
        request.processedAt = Date.now();

        if (status === 'APPROVED') {
            const student = await Student.findById(request.student);
            student.department = request.newDepartment;
            await student.save();
        }

        await request.save();

        await AuditLog.create({
            user: req.user._id,
            action: `TRANSFER_${status}`,
            module: 'CAMPUS_TRANSFER',
            details: { requestId: request._id, student: request.student, status },
            method: req.method,
            path: req.originalUrl
        });

        res.json(request);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    submitTransferRequest,
    getMyTransferRequests,
    getTransferRequests,
    processTransferRequest
};
