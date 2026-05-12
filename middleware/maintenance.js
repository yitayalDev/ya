const SystemConfig = require('../models/SystemConfig');
const jwt = require('jsonwebtoken');

const checkMaintenance = async (req, res, next) => {
    try {
        const config = await SystemConfig.findOne({});
        
        if (config && config.maintenanceMode) {
            // 1. Always allow Super Admin login and config routes
            if (req.url.includes('/auth/login') || req.url.includes('/system/config') || req.url.includes('/system/public-config')) {
                return next();
            }

            // 2. Try to see if this is a Super Admin via token
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
                try {
                    const token = req.headers.authorization.split(' ')[1];
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    if (decoded.role === 'SUPER_ADMIN') {
                        return next();
                    }
                } catch (err) {
                    // Invalid token, treat as normal user
                }
            }
            
            return res.status(503).json({ 
                message: 'System is currently under maintenance. Please try again later.',
                maintenance: true
            });
        }
        next();
    } catch (error) {
        next(); 
    }
};

module.exports = { checkMaintenance };
