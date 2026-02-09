const express = require('express');
const router = express.Router();
const smsService = require('../services/sms.service');
const smsScheduler = require('../scheduler/smsScheduler');
const { protect, authorize } = require('../middleware/auth');

// Test SMS sending (Admin only)
router.post('/test', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }

    const result = await smsService.sendSMS(phone, message);
    
    res.json({
      success: true,
      message: 'SMS test completed',
      data: result
    });
  } catch (error) {
    console.error('SMS test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test SMS',
      error: error.message
    });
  }
});

// Manually trigger due reminders (Admin only)
router.post('/send-reminders', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const results = await smsScheduler.testSendReminders();
    
    res.json({
      success: true,
      message: 'SMS reminders sent',
      data: {
        count: results.length,
        results: results
      }
    });
  } catch (error) {
    console.error('SMS reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS reminders',
      error: error.message
    });
  }
});

// Get SMS scheduler status
router.get('/scheduler/status', protect, async (req, res) => {
  try {
    const nextRun = smsScheduler.getNextRunTime();
    
    res.json({
      success: true,
      data: {
        status: 'active',
        nextRun: nextRun,
        timezone: 'Asia/Dhaka',
        scheduledTime: '9:00 PM daily'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message
    });
  }
});

// Send payment confirmation SMS
router.post('/payment-confirmation', protect, async (req, res) => {
  try {
    const { memberName, phone, paidAmount, remainingOverdue, totalRemaining, paymentType } = req.body;
    
    if (!memberName || !phone || paidAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Member name, phone, and paid amount are required'
      });
    }

    const smsData = {
      memberName,
      phone,
      paidAmount,
      remainingOverdue: remainingOverdue || 0,
      totalRemaining: totalRemaining || 0,
      paymentType: paymentType || 'full' // 'full' or 'partial'
    };

    const result = await smsService.sendPaymentConfirmation(smsData);
    
    res.json({
      success: true,
      message: 'Payment confirmation SMS sent',
      data: result
    });
  } catch (error) {
    console.error('Payment confirmation SMS error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send payment confirmation SMS',
      error: error.message
    });
  }
});

// Get SMS statistics
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await smsService.getSMSStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get SMS statistics',
      error: error.message
    });
  }
});

// Check SMS balance (Admin only)
router.get('/balance', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const result = await smsService.checkBalance();
    
    res.json({
      success: result.success,
      message: result.success ? 'SMS balance retrieved' : 'Failed to check balance',
      data: result
    });
  } catch (error) {
    console.error('SMS balance check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check SMS balance',
      error: error.message
    });
  }
});

// Update SMS settings (Admin only)
router.put('/settings', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { enableSMS, testMode, language } = req.body;
    
    // Update settings in config
    const smsConfig = require('../config/sms.config');
    
    if (enableSMS !== undefined) smsConfig.settings.enableSMS = enableSMS;
    if (testMode !== undefined) smsConfig.settings.testMode = testMode;
    if (language) smsConfig.settings.defaultLanguage = language;
    
    res.json({
      success: true,
      message: 'SMS settings updated',
      data: smsConfig.settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update SMS settings',
      error: error.message
    });
  }
});

module.exports = router;