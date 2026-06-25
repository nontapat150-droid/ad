const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Middleware: Verify JWT from Authorization: Bearer <token>
 * Attaches decoded payload to req.user
 */
const auth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const secretKey = process.env.JWT_SECRET || 'BOU_SECRET_KEY_12345!@#';
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded; // { id, username, role, roles[], team_id, full_name }
    
    // Update last_active asynchronously (fire and forget)
    pool.query('UPDATE users SET last_active = NOW() WHERE id = ?', [decoded.id]).catch(err => console.error('Error updating last_active:', err.message));
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Role guard factory — requires user to have at least one of the listed roles.
 * Checks both primary role (users.role) and multi-roles (user_roles).
 * Usage: router.get('/admin-only', auth, requireRole(['admin', 'super_admin']), handler)
 */
const requireRole = (allowedRoles = []) => (req, res, next) => {
  const userRoles = req.user.roles || [req.user.role];
  const hasRole = allowedRoles.some((r) => userRoles.includes(r));
  if (!hasRole) {
    return res.status(403).json({
      error: 'Access denied',
      required: allowedRoles,
      yours: userRoles,
    });
  }
  next();
};

module.exports = { auth, requireRole };
