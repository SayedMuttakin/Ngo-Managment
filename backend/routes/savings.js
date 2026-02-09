const express = require('express');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all savings
// @route   GET /api/savings
// @access  Private
router.get('/', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Savings route - Coming soon',
    data: []
  });
});

module.exports = router;
