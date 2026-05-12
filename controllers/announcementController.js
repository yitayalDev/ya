const Announcement = require('../models/Announcement');
const Student = require('../models/Student');

// @desc    Create an announcement
// @route   POST /api/announcements
// @access  Private (Registrar, Super Admin)
const createAnnouncement = async (req, res) => {
    const { title, message, targetType, targetId, targetYear, priority, expiresAt, scheduledFor } = req.body;

    try {
        const status = scheduledFor && new Date(scheduledFor) > new Date() ? 'SCHEDULED' : 'PUBLISHED';
        
        const announcement = await Announcement.create({
            title,
            message,
            sender: req.user._id,
            targetType,
            targetId,
            targetYear,
            priority,
            expiresAt,
            scheduledFor,
            status
        });

        res.status(201).json(announcement);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get announcements for the current user
// @route   GET /api/announcements/my
// @access  Private
const getMyAnnouncements = async (req, res) => {
    try {
        let filter = { 
            status: 'PUBLISHED',
            $or: [{ targetType: 'ALL' }] 
        };

        if (req.user.role === 'STUDENT') {
            const student = await Student.findOne({ user: req.user._id });
            if (student) {
                filter.$or.push(
                    { targetType: 'COLLEGE', targetId: student.college },
                    { targetType: 'DEPARTMENT', targetId: student.department },
                    { targetType: 'YEAR_LEVEL', targetYear: student.academicYear }
                );
            }
        }

        const announcements = await Announcement.find(filter)
            .populate('sender', 'name')
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(announcements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all announcements (for management)
// @route   GET /api/announcements
// @access  Private (Registrar)
const getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find({})
            .populate('sender', 'name')
            .sort({ createdAt: -1 });

        res.json(announcements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private (Registrar)
const deleteAnnouncement = async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: 'Announcement removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Background Task: Process Scheduled Announcements
const processScheduledAnnouncements = async () => {
    try {
        const now = new Date();
        const result = await Announcement.updateMany(
            { status: 'SCHEDULED', scheduledFor: { $lte: now } },
            { $set: { status: 'PUBLISHED' } }
        );
        if (result.modifiedCount > 0) {
            console.log(`[Scheduler] Published ${result.modifiedCount} scheduled announcements.`);
        }
    } catch (error) {
        console.error('[Scheduler] Error processing announcements:', error);
    }
};

// Run scheduler every 1 minute
setInterval(processScheduledAnnouncements, 60000);

module.exports = {
    createAnnouncement,
    getMyAnnouncements,
    getAllAnnouncements,
    deleteAnnouncement,
    processScheduledAnnouncements
};
