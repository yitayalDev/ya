const Alert = require('../models/Alert');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');

// @desc    Broadcast an emergency alert
// @route   POST /api/alerts/broadcast
// @access  Private (Super Admin)
const broadcastAlert = async (req, res) => {
    const { title, message, severity, channels, targetScope } = req.body;

    try {
        // 1. Get targets
        let query = {};
        if (targetScope === 'STAFF_ONLY') query.role = { $ne: 'STUDENT' };
        if (targetScope === 'STUDENTS_ONLY') query.role = 'STUDENT';
        
        const targets = await User.find(query).select('email phone');
        const targetCount = targets.length;

        // 2. Create alert record
        const alert = await Alert.create({
            title,
            message,
            severity,
            channels,
            targetScope,
            sender: req.user._id,
            sentCount: targetCount
        });

        // 3. Simulate Multi-Channel Dispatch
        const config = await SystemConfig.findOne({});
        const smsGateway = config?.integrations?.SMS_GATEWAY_URL;

        console.log(`[EMERGENCY ALERT] ${severity}: ${title}`);
        console.log(`Targeting ${targetCount} users via ${JSON.stringify(channels)}`);

        if (channels.sms && smsGateway) {
            console.log(`>>> Dispatched ${targetCount} SMS via ${smsGateway}`);
        }
        
        if (channels.push) {
            // This would normally go to FCM or similar
            console.log(`>>> Dispatched ${targetCount} Push Notifications`);
        }

        res.status(201).json({
            message: 'Alert broadcasted successfully',
            alert,
            dispatchStats: {
                totalTargets: targetCount,
                channels: channels
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get alert history
// @route   GET /api/alerts
// @access  Private (Super Admin)
const getAlertHistory = async (req, res) => {
    try {
        const alerts = await Alert.find({})
            .populate('sender', 'name')
            .sort({ createdAt: -1 });
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    broadcastAlert,
    getAlertHistory
};
