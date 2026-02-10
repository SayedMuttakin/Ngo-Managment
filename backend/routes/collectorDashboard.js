const express = require('express');
const mongoose = require('mongoose');
const Installment = require('../models/Installment');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Member = require('../models/Member');
const CollectionSchedule = require('../models/CollectionSchedule');
const CollectionHistory = require('../models/CollectionHistory');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Get collector dashboard data - SIMPLIFIED
// @route   GET /api/collector-dashboard/:collectorId
// @access  Private
router.get('/:collectorId', protect, async (req, res) => {
  try {
    const { collectorId } = req.params;
    const { date, day } = req.query;  // 🎯 Add day parameter

    console.log('🚀 Collector Dashboard API Called');
    console.log('📊 Collector ID:', collectorId);
    console.log('📅 Date:', date || 'Today');
    console.log('📅 Day:', day || 'Not specified');

    // ✅ CRITICAL FIX: Parse date - Frontend পাঠায় "2025-10-22" = Bangladesh তারিখ
    let targetDate;
    if (date) {
      // ⚠️ IMPORTANT: new Date(date + 'T00:00:00') ব্যবহার করবেন না!
      // এটা server timezone-এ parse করে ভুল date দেয়
      // সমাধান: সরাসরি UTC date create করি
      const [year, month, day] = date.split('-');
      targetDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0));
    } else {
      // Get current Bangladesh date
      const now = new Date();
      const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
      const year = bdTime.getUTCFullYear();
      const month = bdTime.getUTCMonth();
      const day = bdTime.getUTCDate();
      targetDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
    }

    // ✅ Date range for queries
    // targetDate এখন UTC date হিসেবে আছে October 22, 2025 00:00:00 UTC
    // এটাই Bangladesh তারিখ represent করে

    // For collections: Bangladesh day in UTC
    const startUTC = new Date(targetDate);
    startUTC.setUTCHours(0, 0, 0, 0);
    startUTC.setTime(startUTC.getTime() - (6 * 60 * 60 * 1000)); // BD 00:00 = UTC 18:00 previous day

    const endUTC = new Date(targetDate);
    endUTC.setUTCHours(23, 59, 59, 999);
    endUTC.setTime(endUTC.getTime() - (6 * 60 * 60 * 1000)); // BD 23:59 = UTC 17:59 same day

    // For due date checking: End of selected Bangladesh day
    const dueDateCheckEnd = new Date(targetDate);
    dueDateCheckEnd.setUTCHours(23, 59, 59, 999);

    console.log('🕐 Target Date (BD):', targetDate.toISOString());
    console.log('🕐 Start of Day (UTC):', startUTC.toISOString());
    console.log('🕐 End of Day (UTC):', endUTC.toISOString());

    // Get collector info
    const collector = await User.findById(collectorId);
    if (!collector) {
      return res.status(404).json({
        success: false,
        message: 'Collector not found'
      });
    }

    console.log('✅ Collector found:', collector.name);

    // 🎯 NEW: Get branches from CollectionSchedule based on day
    let branches = [];
    if (day) {
      // Get schedule for this collector and day
      const schedule = await CollectionSchedule.findOne({
        collector: collectorId,
        collectionDay: day,
        isActive: true
      });

      if (schedule && schedule.branches) {
        // Convert schedule branches to Branch format
        branches = schedule.branches.map(b => ({
          branchCode: b.branchCode,
          name: b.branchName,
          assignedCollector: collectorId,
          members: b.members || [],
          isActive: true
        }));
        console.log(`🏢 Branches found for ${day}:`, branches.length);
      } else {
        console.log(`⚠️ No schedule found for ${day}`);
      }
    } else {
      // Fallback: Get all branches for this collector
      const branchDocs = await Branch.find({
        assignedCollector: collectorId,
        isActive: true
      });
      branches = branchDocs;
      console.log('🏢 Branches found (all days):', branches.length);
    }

    // 1. আজকের Collection - Include ALL manually collected installments
    // ✅ CRITICAL FIX: Include 3 cases:
    //    a) Normal: collectionDate = today
    //    b) Advance: due in future, but collected today (updatedAt = today)
    //    c) **Past-due: due in past, but collected today (has payment in paymentHistory today)**
    // ✅ EXCLUDE auto-applied installments (overpayment carry-forward)

    // First, get all installments that were updated today (any payment activity)
    const allUpdatedToday = await Installment.find({
      collector: collectorId,
      updatedAt: { $gte: startUTC, $lte: endUTC },
      status: { $in: ['collected', 'partial'] }
      // ❌ Removed isAutoApplied filter - we check paymentHistory instead
    }).populate('member', 'name');

    // Filter to only those that have actual payments made today in paymentHistory
    const todayCollections = allUpdatedToday.filter(inst => {
      // ✅ CRITICAL: Filter by member isActive status if populated
      if (inst.member && inst.member.isActive === false) return false;

      // ✅ EXCLUDE pure auto-applied installments (no manual payments)
      if (inst.isAutoApplied && (!inst.paymentHistory || inst.paymentHistory.length === 0)) {
        console.log(`   ⚠️ Skipping pure auto-applied: ${inst._id}`);
        return false; // No manual collection, skip it
      }

      // Check if this installment has any payment in paymentHistory made today
      if (inst.paymentHistory && inst.paymentHistory.length > 0) {
        const hasTodayPayment = inst.paymentHistory.some(payment => {
          if (!payment.date) return false;
          const paymentDate = new Date(payment.date);
          return paymentDate >= startUTC && paymentDate <= endUTC;
        });
        return hasTodayPayment;
      }
      // For legacy records without paymentHistory, check collectionDate
      return inst.collectionDate && inst.collectionDate >= startUTC && inst.collectionDate <= endUTC;
    });

    console.log('📦 Today collections found:', todayCollections.length);
    console.log('🔍 Date range (UTC):', startUTC.toISOString(), 'to', endUTC.toISOString());

    // ✅ DEBUG: Check if there are any auto-applied installments we're excluding
    const allCollectionsIncludingAuto = await Installment.find({
      collector: collectorId,
      $or: [
        { collectionDate: { $gte: startUTC, $lte: endUTC }, status: { $in: ['collected', 'partial'] } },
        { updatedAt: { $gte: startUTC, $lte: endUTC }, status: { $in: ['collected', 'partial'] }, collectionDate: { $gt: endUTC } }
      ]
    });
    console.log(`🔍 DEBUG: Total installments (including auto-applied): ${allCollectionsIncludingAuto.length}`);
    const autoAppliedCount = allCollectionsIncludingAuto.filter(inst => inst.isAutoApplied === true).length;
    console.log(`   → Auto-applied (excluded): ${autoAppliedCount}`);
    console.log(`   → Manual collections: ${todayCollections.length}`);


    // ✅ NEW ROBUST TOTALS: Use CollectionHistory as source of truth
    // First, sync any missing records from today's manual collections (handles transition)
    const manualInsts = await Installment.find({
      collector: collectorId,
      updatedAt: { $gte: startUTC, $lte: endUTC },
      status: { $in: ['collected', 'partial'] },
      isAutoApplied: { $ne: true }
    });

    const pendingSync = new Map();

    for (const inst of manualInsts) {
      const todayPayments = inst.paymentHistory.filter(p => {
        if (!p.date) return false;
        const d = new Date(p.date);
        return d >= startUTC && d <= endUTC;
      });

      for (const p of todayPayments) {
        const receiptKey = p.receiptNumber || `SYNC-${inst.member}-${p.amount}-${p.date.getTime()}`;

        // Deduplicate: Keep the largest amount for a given receipt (handles legacy primary vs auto-applied discrepancy)
        if (!pendingSync.has(receiptKey) || p.amount > pendingSync.get(receiptKey).amount) {
          pendingSync.set(receiptKey, {
            installment: inst,
            p: p,
            amount: p.amount
          });
        }
      }
    }

    for (const [receiptKey, data] of pendingSync) {
      const { installment: inst, p, amount } = data;

      const historyExists = await CollectionHistory.findOne({
        collector: collectorId,
        receiptNumber: p.receiptNumber,
        collectionDate: { $gte: startUTC, $lte: endUTC }
      });

      if (!historyExists && p.receiptNumber) {
        console.log(`🔄 Syncing missing history for receipt ${p.receiptNumber} (৳${amount})`);
        await CollectionHistory.create({
          installment: inst._id,
          member: inst.member,
          collector: collectorId,
          collectionAmount: amount,
          collectionDate: p.date,
          receiptNumber: p.receiptNumber,
          paymentMethod: 'cash',
          outstandingAfterCollection: inst.outstandingAtCollection || 0,
          installmentTarget: inst.amount,
          installmentDue: inst.remainingAmount || 0,
          distributionId: inst.distributionId || null,
          branch: inst.branch || 'Unknown',
          branchCode: inst.branchCode || 'Unknown',
          collectionDay: inst.collectionDay || 'Monday',
          weekNumber: inst.weekNumber || 1,
          monthYear: inst.monthYear || '',
          note: inst.note,
          createdBy: req.user.id
        });
      }
    }

    // Now calculate totals from CollectionHistory
    const allHistoryToday = await CollectionHistory.find({
      collector: collectorId,
      collectionDate: { $gte: startUTC, $lte: endUTC },
      isActive: true
    });

    let todayLoanCollection = 0;
    let todaySavingsCollection = 0;

    allHistoryToday.forEach(h => {
      const noteLower = (h.note || '').toLowerCase();
      const isSavingsWithdrawal = noteLower.includes('savings withdrawal') || noteLower.includes('withdrawal');
      const isSavings = noteLower.includes('savings') || noteLower.includes('সঞ্চয়');

      if (isSavingsWithdrawal) {
        todaySavingsCollection -= h.collectionAmount;
      } else if (isSavings) {
        todaySavingsCollection += h.collectionAmount;
      } else {
        todayLoanCollection += h.collectionAmount;
      }
    });

    console.log(`💰 Verified Totals: Loan=৳${todayLoanCollection}, Savings=৳${todaySavingsCollection}`);

    // 2. Due Balance - Today + Overdue (আজকের + আগের বাকি)
    // ✅ CRITICAL: Filter by member isActive status
    const pendingInstallments = await Installment.find({
      collector: collectorId,
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lte: dueDateCheckEnd }
    }).populate({
      path: 'member',
      match: { isActive: true },
      select: 'name isActive'
    });

    // Filter out installments where member didn't match isActive: true
    const activePendingInstallments = pendingInstallments.filter(inst => inst.member);

    console.log('⏰ Pending installments found (Today + Overdue - Active Only):', activePendingInstallments.length);
    console.log('🔍 Query: dueDate <= ', dueDateCheckEnd.toISOString());

    // Debug: Show sample
    if (activePendingInstallments.length > 0) {
      console.log('📋 Sample pending (first 3):');
      activePendingInstallments.slice(0, 3).forEach(inst => {
        const memberName = inst.member?.name || 'Unknown';
        const dueDate = inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : 'No date';
        console.log(`  - ${memberName}: Due ${dueDate} | ৳${inst.amount}`);
      });
    }

    let dueBalance = 0;
    activePendingInstallments.forEach(inst => {
      if (inst.status === 'partial') {
        dueBalance += (inst.amount - (inst.paidAmount || 0));
      } else {
        dueBalance += inst.amount;
      }
    });

    console.log('📊 Due Balance:', dueBalance);

    // 3. Net Balance (Total Outstanding)
    // সব pending installments (future included) - ✅ Active members only
    const allPendingInstallments = await Installment.find({
      collector: collectorId,
      status: { $in: ['pending', 'partial'] }
    }).populate({
      path: 'member',
      match: { isActive: true },
      select: 'name isActive'
    });

    // Filter out installments where member didn't match isActive: true
    const activeAllPendingInstallments = allPendingInstallments.filter(inst => inst.member);

    let netBalance = 0;
    activeAllPendingInstallments.forEach(inst => {
      if (inst.status === 'partial') {
        netBalance += (inst.amount - (inst.paidAmount || 0));
      } else {
        netBalance += inst.amount;
      }
    });

    console.log('💼 Net Balance (Total Outstanding - Active Only):', netBalance);

    // ✅ Today's Collection already calculated above (line 129-172)
    // It sums all collections made today from todayCollections query
    console.log('💰 Final Today\'s Loan Collection: ৳', todayLoanCollection);

    // ✅ Calculate member count for each branch
    const branchesWithMemberCount = await Promise.all(
      branches.map(async (branch) => {
        // 🎯 STRICT matching: Only exact branchCode match
        const memberCount = await Member.countDocuments({
          branchCode: branch.branchCode,
          isActive: true
        });

        console.log(`📊 Branch ${branch.branchCode} (${branch.name}): ${memberCount} members`);

        // Debug: Show ALL members with their branchCodes to identify mismatch
        const sampleMembers = await Member.find({
          branchCode: branch.branchCode,
          isActive: true
        }).limit(5).select('name branchCode branch');

        if (sampleMembers.length > 0) {
          console.log(`👥 Members in branch ${branch.branchCode}:`);
          sampleMembers.forEach(m => {
            console.log(`   - ${m.name}: branchCode="${m.branchCode}", branch="${m.branch || 'N/A'}"`);
          });
        }

        return {
          id: branch._id,
          name: branch.name,
          branchCode: branch.branchCode,
          memberCount: memberCount
        };
      })
    );

    // Response data
    const responseData = {
      todayCollection: todayLoanCollection,
      todaySavings: todaySavingsCollection,
      dueBalance: dueBalance,
      netBalance: netBalance,
      totalOutstanding: netBalance,
      branches: branchesWithMemberCount,
      collector: {
        id: collector._id,
        name: collector.name,
        email: collector.email,
        phone: collector.phone
      },
      date: date || new Date().toISOString().split('T')[0],
      debug: {
        totalTodayCollections: todayCollections.length,
        totalPendingInstallments: pendingInstallments.length,
        totalAllPending: allPendingInstallments.length
      }
    };

    console.log('✅ Sending response:', responseData);

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Collector dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching collector dashboard data',
      error: error.message
    });
  }
});

// @desc    Debug collector data - VERY SIMPLE
// @route   GET /api/collector-dashboard/:collectorId/debug
// @access  Private
router.get('/:collectorId/debug', protect, async (req, res) => {
  try {
    const { collectorId } = req.params;

    console.log('🔍 Debug: Checking data for collector:', collectorId);

    // 1. Find ALL installments for this collector
    const allInstallments = await Installment.find({
      collector: collectorId
    }).limit(10).populate('member', 'name');

    console.log('📊 Found installments:', allInstallments.length);

    // 2. Check collected status
    const collectedCount = await Installment.countDocuments({
      collector: collectorId,
      status: 'collected'
    });

    // 3. Check pending status
    const pendingCount = await Installment.countDocuments({
      collector: collectorId,
      status: 'pending'
    });

    // 4. Calculate total amounts
    const result = await Installment.aggregate([
      { $match: { collector: new mongoose.Types.ObjectId(collectorId) } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      debug: {
        collectorId,
        totalInstallments: allInstallments.length,
        collectedCount,
        pendingCount,
        statusBreakdown: result,
        sampleInstallments: allInstallments.map(i => ({
          id: i._id,
          member: i.member?.name || 'Unknown',
          amount: i.amount,
          paidAmount: i.paidAmount,
          status: i.status,
          collectionDate: i.collectionDate,
          dueDate: i.dueDate
        }))
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
