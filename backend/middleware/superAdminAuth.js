// Super Admin authorization middleware
module.exports = function(req, res, next) {
  // Check if user exists (auth middleware should have already run)
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Access denied. No user authenticated.' 
    });
  }

  // Check if user is super admin (role === 'admin')
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false,
      message: 'Access denied. Super Admin privileges required.' 
    });
  }

  // User is super admin, proceed
  next();
};
