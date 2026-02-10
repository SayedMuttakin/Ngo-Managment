const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/members');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: memberCode_timestamp.extension
    const memberCode = req.body.memberCode || 'member';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${memberCode}_${timestamp}${extension}`);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware wrapper for single profile image upload with better error handling
const uploadProfileImage = (req, res, next) => {
  // Create upload middleware
  const uploadHandler = upload.single('profileImage');

  // Execute upload with comprehensive error handling
  uploadHandler(req, res, (error) => {
    if (error) {
      console.error('❌ Upload middleware error:', error);

      // Handle multer-specific errors
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB.'
          });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected field. Only profileImage field is allowed.'
          });
        }
        // Generic multer error
        return res.status(400).json({
          success: false,
          message: `File upload error: ${error.message}`
        });
      }

      // Handle file type errors
      if (error.message === 'Only image files are allowed!') {
        return res.status(400).json({
          success: false,
          message: 'Only image files (JPG, PNG, GIF, etc.) are allowed.'
        });
      }

      // Handle any other upload errors
      return res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message
      });
    }

    // No error - continue to next middleware
    console.log('✅ Upload middleware passed - File:', req.file ? req.file.filename : 'No file uploaded');
    next();
  });
};

// Error handling middleware (kept for backwards compatibility but now mostly handled above)
const handleUploadError = (error, req, res, next) => {
  // This should rarely be called now since uploadProfileImage handles errors
  if (error) {
    console.error('❌ Unhandled upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during file processing',
      error: error.message
    });
  }
  next();
};

module.exports = {
  uploadProfileImage,
  handleUploadError
};
