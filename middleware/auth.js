const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // --- DEMO MODE BYPASS ---
      if (token === 'demo_token') {
        req.user = {
          _id: '000000000000000000000000',
          name: 'Guest User',
          role: 'SUPER_ADMIN', // Allow demo user to see everything
        };
        return next();
      }
      // ------------------------

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      return next();
    } catch (error) {
      console.error('Protect middleware error:', error);
      return res.status(401).json({ message: 'Not authorized' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log(`Authorizing roles: ${roles}. User role: ${req.user.role}`);
    if (req.user.role === 'SUPER_ADMIN' || roles.includes(req.user.role)) {
      return next();
    }
    console.log(`Authorization failed: ${req.user.role} is not in ${roles}`);
    return res.status(403).json({
      message: `User role ${req.user.role} is not authorized to access this route`,
    });
  };
};

// Admin middleware
const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'COLLEGE_ADMIN' || req.user.role === 'DORMITORY_ADMIN' || req.user.role === 'REGISTRAR')) {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, authorize, admin };
