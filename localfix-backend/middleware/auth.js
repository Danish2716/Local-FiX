const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Worker = require('../models/Worker');

// ─── Verify JWT and attach user/worker to request ───────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user or worker based on role in token
    if (decoded.role === 'user') {
      const user = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
      }
      req.user = user;
      req.role = 'user';
    } else if (decoded.role === 'worker') {
      const worker = await Worker.findById(decoded.id).select('-password');
      if (!worker || !worker.isActive) {
        return res.status(401).json({ success: false, message: 'Worker not found or deactivated.' });
      }
      req.user = worker;
      req.role = 'worker';
    } else {
      return res.status(401).json({ success: false, message: 'Invalid token role.' });
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

// ─── Role-based access control ───────────────────────────────────────────────
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This endpoint is for: ${roles.join(', ')} only.`,
      });
    }
    next();
  };
};

// Shorthand middlewares
const requireUser = requireRole('user');
const requireWorker = requireRole('worker');

module.exports = { protect, requireRole, requireUser, requireWorker };
