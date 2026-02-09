const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Member = require('../models/Member');
const Installment = require('../models/Installment');
const SystemSettings = require('../models/SystemSettings');

// @desc    Reset all financial data (delete installments, reset member balances)
// @route   POST /api/admin/reset-financial-data
// @access  Private/Admin
router.post('/reset-financial-data', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        console.log('🔄 Starting financial data reset...');
        console.log('👤 Requested by:', req.user.name, '(', req.user.role, ')');

        // 1. Count before deletion
        const installmentCountBefore = await Installment.countDocuments({});
        const memberCountBefore = await Member.countDocuments({});

        console.log(`📊 Before reset: ${installmentCountBefore} installments, ${memberCountBefore} members`);

        // 2. Delete all installments
        console.log('🗑️  Deleting all installments...');
        const deletedInstallments = await Installment.deleteMany({});
        console.log(`   ✅ Deleted ${deletedInstallments.deletedCount} installments`);

        // 3. Reset member financial fields
        console.log('💰 Resetting member financial balances...');
        const updateResult = await Member.updateMany(
            {},
            {
                $set: {
                    totalSavings: 0,
                    totalPaid: 0,
                    lastPaymentDate: null
                }
            }
        );
        console.log(`   ✅ Reset balances for ${updateResult.modifiedCount} members`);

        // 4. Verify results
        const installmentCountAfter = await Installment.countDocuments({});
        const memberCountAfter = await Member.countDocuments({});

        const summary = {
            success: true,
            message: 'Financial data reset completed successfully',
            details: {
                installmentsDeleted: deletedInstallments.deletedCount,
                membersReset: updateResult.modifiedCount,
                before: {
                    installments: installmentCountBefore,
                    members: memberCountBefore
                },
                after: {
                    installments: installmentCountAfter,
                    members: memberCountAfter
                },
                resetBy: {
                    name: req.user.name,
                    role: req.user.role,
                    id: req.user.id
                },
                timestamp: new Date().toISOString()
            }
        };

        console.log('✅ Financial data reset completed successfully!');
        console.log('📊 Final summary:', summary);

        res.status(200).json(summary);

    } catch (error) {
        console.error('❌ Error during financial data reset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset financial data',
            error: error.message
        });
    }
});

// @desc    Get reset statistics (what would be deleted)
// @route   GET /api/admin/reset-stats
// @access  Private/Admin
router.get('/reset-stats', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const installmentCount = await Installment.countDocuments({});
        const memberCount = await Member.countDocuments({});
        const membersWithSavings = await Member.countDocuments({ totalSavings: { $gt: 0 } });
        const membersWithPayments = await Member.countDocuments({ totalPaid: { $gt: 0 } });

        // Get total amounts
        const members = await Member.find({});
        const totalSavings = members.reduce((sum, m) => sum + (m.totalSavings || 0), 0);
        const totalPaid = members.reduce((sum, m) => sum + (m.totalPaid || 0), 0);

        res.status(200).json({
            success: true,
            data: {
                installments: {
                    total: installmentCount,
                    willBeDeleted: installmentCount
                },
                members: {
                    total: memberCount,
                    withSavings: membersWithSavings,
                    withPayments: membersWithPayments,
                    willBeReset: memberCount
                },
                amounts: {
                    totalSavings,
                    totalPaid
                },
                warning: '⚠️ This action cannot be undone!'
            }
        });

    } catch (error) {
        console.error('Error getting reset stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get reset statistics',
            error: error.message
        });
    }
});

// @desc    Check if admin PIN is set
// @route   GET /api/admin/pin-status
// @access  Private/Admin
router.get('/pin-status', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const settings = await SystemSettings.getSettings();
        res.status(200).json({
            success: true,
            isPinSet: !!settings.adminPin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to check PIN status'
        });
    }
});

// @desc    Set initial admin PIN
// @route   POST /api/admin/set-pin
// @access  Private/Admin
router.post('/set-pin', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin || pin.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'PIN must be at least 4 digits'
            });
        }

        const settings = await SystemSettings.getSettings();
        if (settings.adminPin) {
            return res.status(400).json({
                success: false,
                message: 'PIN is already set'
            });
        }

        settings.adminPin = pin;
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'PIN set successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to set PIN'
        });
    }
});

// @desc    Verify admin PIN
// @route   POST /api/admin/verify-pin
// @access  Private/Admin
router.post('/verify-pin', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { pin } = req.body;
        const settings = await SystemSettings.getSettings();

        if (!settings.adminPin) {
            return res.status(400).json({
                success: false,
                message: 'PIN is not set'
            });
        }

        if (settings.adminPin === pin) {
            res.status(200).json({
                success: true,
                message: 'PIN verified successfully'
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Incorrect PIN'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to verify PIN'
        });
    }
});

module.exports = router;
