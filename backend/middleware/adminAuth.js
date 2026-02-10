// Admin authorization middleware
module.exports = function(req, res, next) {
  // Check if user exists (auth middleware should have already run)
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Access denied. No user authenticated.' 
    });
  }

  // Check if user is admin or manager
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ 
      success: false,
      message: 'Access denied. Admin or Manager privileges required.' 
    });
  }

  // User is admin or manager, proceed
  next();
};