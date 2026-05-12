const AuditLog = require('../models/AuditLog');

/**
 * Middleware to log academic and administrative actions
 * @param {string} moduleName - The name of the module (e.g., 'ACADEMIC_CALENDAR')
 * @param {string} actionDescription - Description of the action (optional)
 */
const auditLogger = (moduleName, actionDescription) => {
  return async (req, res, next) => {
    // We'll wrap the original res.send to log AFTER successful completion
    const originalSend = res.send;

    res.send = function (data) {
      // Only log successful operations (2xx) or as per requirement
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user ? req.user._id : null;
        
        if (userId) {
          // Fire and forget logging (don't block response)
          AuditLog.create({
            user: userId,
            module: moduleName,
            action: actionDescription || `${req.method} ${req.originalUrl}`,
            method: req.method,
            path: req.originalUrl,
            details: {
              body: req.body,
              params: req.params,
              query: req.query,
              responseStatus: res.statusCode
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
          }).catch(err => console.error('Audit Logging Error:', err));
        }
      }
      
      return originalSend.apply(res, arguments);
    };

    next();
  };
};

module.exports = auditLogger;
