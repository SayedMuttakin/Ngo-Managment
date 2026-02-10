const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// Trust proxy - Required for cPanel deployment
app.set('trust proxy', 1);

// Rate limiting - TEMPORARILY DISABLED to fix trust proxy validation error
// TODO: Re-enable after confirming app works
/*
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipFailedRequests: false,
  validate: { trustProxy: false } // Disable trust proxy validation
});
app.use(limiter);
*/

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: false, // Set to false when using wildcard origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Cache-Control', 'Pragma', 'Expires']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploaded images) - Standard Route
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Serve static files (uploaded images) - API Route (Backup for cPanel Proxy)
app.use('/api/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ngo_management';
console.log('🔗 Attempting to connect to MongoDB:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.log('💡 Trying local MongoDB fallback...');

    // Fallback to local MongoDB
    mongoose.connect('mongodb://localhost:27017/ngo_management_local', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
      .then(() => {
        console.log('✅ Local MongoDB connected successfully');
        console.log('📊 Database:', mongoose.connection.name);
      })
      .catch(localErr => {
        console.error('❌ Local MongoDB also failed:', localErr);
        console.log('🚨 Please install MongoDB locally or fix Atlas connection');
      });
  });

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/collectors', require('./routes/collectors'));
app.use('/api/products', require('./routes/products'));
app.use('/api/distributions', require('./routes/distributions'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/installments', require('./routes/installments'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/savings', require('./routes/savings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/collector-dashboard', require('./routes/collectorDashboard'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'NGO Management API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    // Test database connection
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting'
    };

    if (dbState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected',
        state: states[dbState]
      });
    }

    // Test creating a simple document
    const testData = {
      test: true,
      timestamp: new Date(),
      message: 'Database connection test'
    };

    // Try to access the database
    const db = mongoose.connection.db;
    const collection = db.collection('test');
    const result = await collection.insertOne(testData);

    // Clean up test data
    await collection.deleteOne({ _id: result.insertedId });

    res.json({
      success: true,
      message: 'Database connection successful',
      state: states[dbState],
      testResult: 'Insert and delete operations successful'
    });

  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Global error handler - MUST be defined BEFORE 404 handler
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Set default status code
  const statusCode = err.statusCode || err.status || 500;

  // Always return JSON, never HTML
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? {
      stack: err.stack,
      details: err.details || null
    } : undefined
  });
});

// 404 handler - This will only run if no routes match
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 5000;

// Check if running in Phusion Passenger
if (typeof (PhusionPassenger) !== 'undefined') {
  app.listen('passenger');
} else {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`🔗 API Health Check: http://localhost:${PORT}/api/health`);

    // Start SMS Scheduler
    const smsScheduler = require('./scheduler/smsScheduler');
    smsScheduler.start();
    console.log(`📱 SMS Scheduler activated - Will run at 8:00 PM Bangladesh time daily`);
    console.log(`⏰ Next SMS run: ${smsScheduler.getNextRunTime()}`);
  });
}

module.exports = app;
