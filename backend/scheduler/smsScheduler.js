const cron = require('node-cron');
const moment = require('moment-timezone');
const Installment = require('../models/Installment');
const Member = require('../models/Member');
const smsService = require('../services/sms.service');
const smsConfig = require('../config/sms.config');
const autoSavingsDeductionService = require('../services/autoSavingsDeduction.service');

class SMSScheduler {
  constructor() {
    this.cronJob = null;
  }

  /**
   * Start the SMS scheduler
   */
  start() {
    // Schedule for 9:00 PM Bangladesh time every day
    // Cron format: second minute hour day month day-of-week
    // '0 21 * * *' = Every day at 9:00 PM

    this.cronJob = cron.schedule('0 21 * * *', async () => {
      console.log('🔔 SMS Scheduler triggered at', moment().tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss'));
      await this.sendDueReminders();
    }, {
      scheduled: true,
      timezone: 'Asia/Dhaka'
    });

    console.log('✅ SMS Scheduler started - Will run daily at 9:00 PM Bangladesh time');

    // Also run every 5 minutes in development for testing (remove in production)
    if (process.env.NODE_ENV === 'development') {
      this.testCronJob = cron.schedule('*/5 * * * *', async () => {
        console.log('🧪 TEST: Running SMS check (dev mode only)');
        // await this.sendDueReminders(); // Uncomment to test
      });
    }
  }

  /**
   * Stop the SMS scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('❌ SMS Scheduler stopped');
    }
    if (this.testCronJob) {
      this.testCronJob.stop();
    }
  }

  /**
   * Send due reminders to all members with pending installments
   */
  async sendDueReminders() {
    try {
      console.log('📱 Starting SMS reminder process...');

      // Get current date in Bangladesh timezone
      const today = moment().tz('Asia/Dhaka').startOf('day');
      const tomorrow = moment().tz('Asia/Dhaka').add(1, 'day').startOf('day');

      // 🔄 STEP 1: Process Auto Savings Deductions FIRST
      // console.log('💸 Processing auto savings deductions before SMS...');
      // const deductionResult = await autoSavingsDeductionService.processAllPendingDeductions(today.toDate());

      // if (deductionResult.success) {
      //   console.log(`✅ Auto deductions completed:`);
      //   console.log(`   - Total Installments: ${deductionResult.totalInstallments}`);
      //   console.log(`   - Successful Deductions: ${deductionResult.successfulDeductions}`);
      //   console.log(`   - Total Amount Deducted: ৳${deductionResult.totalDeductionAmount}`);
      // } else {
      //   console.log('⚠️ Auto deduction failed:', deductionResult.message);
      // }

      // Find all installments that are due TODAY ONLY (not overdue)
      // শুধু আজকের due installments - পুরানো বকেয়া নয়
      // ✅ Include PARTIAL payments with remaining amount
      const dueInstallments = await Installment.find({
        status: { $in: ['pending', 'partial'] }, // ✅ Include partial payments
        dueDate: {
          $gte: today.toDate(),  // From today
          $lt: tomorrow.toDate()  // Until tomorrow (today only)
        },
        // Make sure SMS not already sent today
        $or: [
          { lastSmsDate: { $exists: false } },
          { lastSmsDate: { $lt: today.toDate() } }
        ]
      }).populate('memberId productId');

      console.log(`Found ${dueInstallments.length} installments due today`);

      // Group installments by member
      const memberInstallments = {};

      for (const installment of dueInstallments) {
        if (!installment.memberId || !installment.memberId.phone) continue;

        const memberId = installment.memberId._id.toString();
        if (!memberInstallments[memberId]) {
          memberInstallments[memberId] = {
            member: installment.memberId,
            installments: [],
            totalDue: 0
          };
        }

        memberInstallments[memberId].installments.push(installment);
        // ✅ For partial payments, only add remaining amount
        if (installment.status === 'partial') {
          const remainingAmount = installment.amount - (installment.paidAmount || 0);
          memberInstallments[memberId].totalDue += remainingAmount;
        } else {
          memberInstallments[memberId].totalDue += installment.amount;
        }
      }

      // Send SMS to each member (only for today's due installments)
      const smsResults = [];

      for (const memberData of Object.values(memberInstallments)) {
        const { member, totalDue, installments } = memberData;

        // Calculate total overdue from all previous weeks
        const allOverdueInstallments = await Installment.find({
          memberId: member._id,
          status: 'pending',
          dueDate: { $lt: today.toDate() }
        });

        // Calculate total overdue amount (বকেয়া স্থিতি)
        let totalOverdue = 0;
        let weeksMissed = 0;

        if (allOverdueInstallments.length > 0) {
          // ✅ For partial payments, only count remaining amount
          totalOverdue = allOverdueInstallments.reduce((sum, inst) => {
            if (inst.status === 'partial') {
              return sum + (inst.amount - (inst.paidAmount || 0));
            }
            return sum + inst.amount;
          }, 0);
          // Calculate weeks missed
          const oldestOverdue = allOverdueInstallments.reduce((oldest, inst) =>
            inst.dueDate < oldest.dueDate ? inst : oldest
          );
          weeksMissed = Math.ceil(today.diff(moment(oldestOverdue.dueDate), 'weeks'));
        }

        // Add today's due to overdue if counting as missed
        totalOverdue += totalDue;
        if (weeksMissed === 0) weeksMissed = 1; // Today is first week

        // Calculate total remaining (মোট পাওনা)
        const allPendingInstallments = await Installment.find({
          memberId: member._id,
          status: { $in: ['pending', 'partial'] }
        });

        const totalRemaining = allPendingInstallments.reduce((sum, inst) => {
          if (inst.status === 'partial') {
            return sum + (inst.amount - (inst.paidAmount || 0));
          }
          return sum + inst.amount;
        }, 0);

        // Format today's date
        const dueDate = today.format('DD/MM/YYYY');

        // Prepare SMS data
        const smsData = {
          memberName: member.name,
          phone: member.phone,
          weeklyAmount: totalDue,      // Today's installment (or remaining if partial)
          totalOverdue: totalOverdue,   // বকেয়া স্থিতি (includes partial remaining)
          totalRemaining: totalRemaining, // মোট পাওনা
          dueDate: dueDate,
          weeksMissed: weeksMissed
        };

        // Send due today reminder with all details
        console.log(`Sending detailed reminder to ${member.name}:`);
        console.log(`  - Weekly Amount: ৳${totalDue}`);
        console.log(`  - Total Overdue: ৳${totalOverdue} (${weeksMissed} weeks)`);
        console.log(`  - Total Remaining: ৳${totalRemaining}`);

        const result = await smsService.sendDueReminder(smsData);

        // Mark installments as SMS sent
        for (const installment of installments) {
          installment.lastSmsDate = new Date();
          installment.smsCount = (installment.smsCount || 0) + 1;
          await installment.save();
        }

        smsResults.push({
          memberId: member._id,
          memberName: member.name,
          phone: member.phone,
          amount: totalDue,
          ...result
        });

        // Log SMS to database (optional)
        await this.logSMS({
          memberId: member._id,
          phone: member.phone,
          message: result.success ? 'sent' : 'failed',
          type: weeksMissed > 1 ? 'overdue' : 'due', // Fixed: use weeksMissed instead of undefined daysOverdue
          amount: totalDue,
          timestamp: new Date()
        });
      }

      console.log(`✅ SMS reminder process completed. Sent ${smsResults.length} messages`);
      console.log('Results:', smsResults);

      return smsResults;

    } catch (error) {
      console.error('❌ Error in SMS reminder process:', error);
      throw error;
    }
  }

  /**
   * Log SMS to database for tracking
   */
  async logSMS(data) {
    try {
      // You can create a SmsLog model to store SMS history
      // For now, just console log
      console.log('SMS Log:', data);

      // TODO: Create SmsLog model and save to database
      // const SmsLog = require('../models/SmsLog');
      // await SmsLog.create(data);
    } catch (error) {
      console.error('Error logging SMS:', error);
    }
  }

  /**
   * Send overdue reminders (can be triggered manually or scheduled weekly)
   */
  async sendOverdueReminders() {
    try {
      console.log('📢 Checking for overdue installments...');

      const today = moment().tz('Asia/Dhaka').startOf('day');

      // Find installments that are overdue (before today)
      const overdueInstallments = await Installment.find({
        status: 'pending',
        dueDate: { $lt: today.toDate() },
        // Only send overdue SMS once per week
        $or: [
          { lastSmsDate: { $exists: false } },
          { lastSmsDate: { $lt: moment().subtract(7, 'days').toDate() } }
        ]
      }).populate('memberId productId');

      console.log(`Found ${overdueInstallments.length} overdue installments`);

      // Group by member and send SMS
      const memberOverdues = {};

      for (const installment of overdueInstallments) {
        if (!installment.memberId || !installment.memberId.phone) continue;

        const memberId = installment.memberId._id.toString();
        if (!memberOverdues[memberId]) {
          memberOverdues[memberId] = {
            member: installment.memberId,
            installments: [],
            totalOverdue: 0,
            oldestDueDate: installment.dueDate
          };
        }

        memberOverdues[memberId].installments.push(installment);
        memberOverdues[memberId].totalOverdue += installment.amount;

        // Track oldest due date
        if (installment.dueDate < memberOverdues[memberId].oldestDueDate) {
          memberOverdues[memberId].oldestDueDate = installment.dueDate;
        }
      }

      const smsResults = [];

      for (const memberData of Object.values(memberOverdues)) {
        const { member, totalOverdue, oldestDueDate, installments } = memberData;
        const daysOverdue = today.diff(moment(oldestDueDate), 'days');

        // Only send if overdue by at least 3 days
        if (daysOverdue < 3) continue;

        // Calculate weeks missed
        const weeksMissed = Math.ceil(daysOverdue / 7);

        // Calculate total remaining (all pending + partial)
        const allPendingInstallments = await Installment.find({
          memberId: member._id,
          status: { $in: ['pending', 'partial'] }
        }).populate('productId');

        const totalRemaining = allPendingInstallments.reduce((sum, inst) => {
          if (inst.status === 'partial') {
            return sum + (inst.amount - (inst.paidAmount || 0));
          }
          return sum + inst.amount;
        }, 0);

        // Group by product for breakdown
        const productBreakdown = {};
        installments.forEach(inst => {
          if (inst.productId) {
            const productName = inst.productId.name || 'Unknown';
            if (!productBreakdown[productName]) {
              productBreakdown[productName] = 0;
            }
            productBreakdown[productName] += inst.amount;
          }
        });

        const productDetails = Object.entries(productBreakdown).map(([name, overdue]) => ({
          name,
          overdue
        }));

        // Prepare SMS data
        const smsData = {
          memberName: member.name,
          phone: member.phone,
          totalOverdue: totalOverdue,
          totalRemaining: totalRemaining,
          weeksMissed: weeksMissed,
          productDetails: productDetails
        };

        console.log(`Sending overdue reminder to ${member.name}:`);
        console.log(`  - Overdue: ৳${totalOverdue} (${weeksMissed} weeks)`);
        console.log(`  - Total Remaining: ৳${totalRemaining}`);

        const result = await smsService.sendOverdueReminder(smsData);

        // Update SMS tracking
        for (const installment of installments) {
          installment.lastSmsDate = new Date();
          installment.smsCount = (installment.smsCount || 0) + 1;
          await installment.save();
        }

        smsResults.push({
          memberId: member._id,
          memberName: member.name,
          phone: member.phone,
          amount: totalOverdue,
          daysOverdue,
          ...result
        });
      }

      console.log(`✅ Sent ${smsResults.length} overdue reminders`);
      return smsResults;

    } catch (error) {
      console.error('❌ Error sending overdue reminders:', error);
      throw error;
    }
  }

  /**
   * Manually trigger SMS sending (for testing)
   */
  async testSendReminders() {
    console.log('🧪 Manually triggering SMS reminders...');
    return await this.sendDueReminders();
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime() {
    const now = moment().tz('Asia/Dhaka');
    const nextRun = moment().tz('Asia/Dhaka').hour(21).minute(0).second(0);

    if (now.hour() >= 21) {
      nextRun.add(1, 'day');
    }

    return nextRun.format('YYYY-MM-DD HH:mm:ss [Bangladesh Time]');
  }
}

module.exports = new SMSScheduler();