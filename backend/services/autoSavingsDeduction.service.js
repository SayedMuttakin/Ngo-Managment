const Installment = require('../models/Installment');
const Member = require('../models/Member');
const moment = require('moment-timezone');

/**
 * Auto Savings Deduction Service
 * Automatically deducts installment amounts from member's savings if they don't pay on due date
 */
class AutoSavingsDeductionService {

  /**
   * Process auto deduction for a specific member and installment (Product-Specific)
   * Called when installment is due but not paid
   */
  async processAutoDeduction(memberId, installmentId, deductionDate = null) {
    try {
      console.log(`🔄 Processing product-specific auto deduction for member: ${memberId}, installment: ${installmentId}`);

      // Get member and installment details
      const member = await Member.findById(memberId);
      const installment = await Installment.findById(installmentId).populate('member');

      if (!member || !installment) {
        throw new Error('Member or installment not found');
      }

      // Check if installment is still pending
      if (installment.status !== 'pending') {
        console.log(`⚠️ Installment already processed: ${installment.status}`);
        return { success: false, message: 'Installment already processed' };
      }

      const installmentAmount = installment.amount;

      // 🎯 CRITICAL: Find product-specific savings for this installment
      const productSpecificSavings = await this.getProductSpecificSavings(member._id, installment);

      console.log(`💰 Member ${member.name}:`);
      console.log(`   - Installment Amount: ৳${installmentAmount}`);
      console.log(`   - Product-Specific Savings: ৳${productSpecificSavings}`);
      console.log(`   - Total Member Savings: ৳${member.totalSavings || 0}`);

      // Check if member has sufficient product-specific savings
      if (productSpecificSavings <= 0) {
        console.log(`❌ No product-specific savings available for deduction`);
        return {
          success: false,
          message: 'No product-specific savings available for deduction',
          productSpecificSavings: productSpecificSavings,
          installmentAmount: installmentAmount
        };
      }

      // Additional check for member's total savings (belt and suspenders)
      if (member.totalSavings <= 0) {
        console.log(`❌ Member has no total savings available`);
        return {
          success: false,
          message: 'Member has no total savings available for deduction',
          memberTotalSavings: member.totalSavings || 0,
          installmentAmount: installmentAmount
        };
      }

      // Calculate deduction amount (full amount or whatever product-specific savings available)
      // 🎯 CRITICAL FIX: Also cap by member.totalSavings to prevent negative balance
      const memberTotalSavings = member.totalSavings || 0;
      const deductionAmount = Math.min(installmentAmount, productSpecificSavings, memberTotalSavings);
      const remainingInstallmentAmount = installmentAmount - deductionAmount;

      console.log(`💸 Product-Specific Auto Deduction Calculation:`);
      console.log(`   - Deduction Amount: ৳${deductionAmount}`);
      console.log(`   - Remaining Installment: ৳${remainingInstallmentAmount}`);

      // Update member's TOTAL savings (reduce by deducted amount)
      const currentTotalSavings = member.totalSavings || 0;
      member.totalSavings = currentTotalSavings - deductionAmount;
      await member.save();

      console.log(`💰 Updated Member Total Savings: ৳${currentTotalSavings} → ৳${member.totalSavings}`);

      // Update installment based on deduction amount
      if (remainingInstallmentAmount <= 0) {
        // Full payment through savings deduction
        installment.status = 'collected';
        installment.paidAmount = installmentAmount;
        installment.paymentMethod = 'savings_deduction';
        installment.collectionDate = deductionDate || new Date();
        installment.note = `${installment.note || ''} - Auto deducted from savings: ৳${deductionAmount}`;
      } else {
        // Partial payment through savings deduction
        installment.status = 'partial';
        installment.paidAmount = deductionAmount;
        installment.paymentMethod = 'savings_deduction';
        installment.collectionDate = deductionDate || new Date();
        installment.note = `${installment.note || ''} - Partial auto deduction from savings: ৳${deductionAmount}`;
      }

      await installment.save();

      // Create savings deduction record for tracking
      await this.createSavingsDeductionRecord(
        member,
        installment,
        deductionAmount,
        deductionDate || new Date()
      );

      console.log(`✅ Auto deduction completed for ${member.name}:`);
      console.log(`   - Deducted: ৳${deductionAmount}`);
      console.log(`   - New Savings Balance: ৳${member.totalSavings}`);
      console.log(`   - Installment Status: ${installment.status}`);

      return {
        success: true,
        message: 'Auto deduction processed successfully',
        deductionAmount: deductionAmount,
        remainingAmount: remainingInstallmentAmount,
        newSavingsBalance: member.totalSavings,
        installmentStatus: installment.status,
        memberName: member.name
      };

    } catch (error) {
      console.error('❌ Auto deduction error:', error);
      return {
        success: false,
        message: 'Error processing auto deduction',
        error: error.message
      };
    }
  }

  /**
   * Create a record for savings deduction for tracking purposes
   */
  async createSavingsDeductionRecord(member, installment, deductionAmount, deductionDate) {
    try {
      const deductionRecord = await Installment.create({
        member: member._id,
        collector: installment.collector,
        amount: deductionAmount,
        installmentType: 'extra',
        branch: member.branch,
        branchCode: member.branchCode,
        dueDate: deductionDate,
        collectionDate: deductionDate,
        note: `Savings deducted for installment payment - Original Installment: ${installment._id}`,
        paymentMethod: 'savings_deduction',
        status: 'collected',
        isDeduction: true, // Flag to identify deduction records
        originalInstallmentId: installment._id
      });

      console.log(`📝 Created savings deduction record: ${deductionRecord._id}`);
      return deductionRecord;

    } catch (error) {
      console.error('❌ Error creating deduction record:', error);
      // Don't fail the main process if record creation fails
    }
  }

  /**
   * Process auto deductions for all pending installments on a specific date
   * Called by scheduler or manually
   */
  async processAllPendingDeductions(targetDate = null) {
    try {
      const processDate = targetDate || new Date();
      const dateStr = moment(processDate).tz('Asia/Dhaka').format('YYYY-MM-DD');

      console.log(`🔄 Processing auto deductions for date: ${dateStr}`);

      // Find all pending installments due on or before target date
      const pendingInstallments = await Installment.find({
        status: 'pending',
        dueDate: { $lte: processDate },
        isActive: { $ne: false } // Exclude inactive installments
      }).populate('member', 'name totalSavings');

      console.log(`📊 Found ${pendingInstallments.length} pending installments for auto deduction`);

      const results = [];
      let totalDeductions = 0;
      let successfulDeductions = 0;

      for (const installment of pendingInstallments) {
        if (!installment.member) {
          console.log(`⚠️ Skipping installment ${installment._id} - member not found`);
          continue;
        }

        const result = await this.processAutoDeduction(
          installment.member._id,
          installment._id,
          processDate
        );

        if (result.success) {
          totalDeductions += result.deductionAmount;
          successfulDeductions++;
        }

        results.push({
          memberId: installment.member._id,
          memberName: installment.member.name,
          installmentId: installment._id,
          installmentAmount: installment.amount,
          ...result
        });
      }

      console.log(`✅ Auto deduction batch completed:`);
      console.log(`   - Total Installments: ${pendingInstallments.length}`);
      console.log(`   - Successful Deductions: ${successfulDeductions}`);
      console.log(`   - Total Amount Deducted: ৳${totalDeductions}`);

      return {
        success: true,
        processDate: dateStr,
        totalInstallments: pendingInstallments.length,
        successfulDeductions: successfulDeductions,
        totalDeductionAmount: totalDeductions,
        details: results
      };

    } catch (error) {
      console.error('❌ Batch auto deduction error:', error);
      return {
        success: false,
        message: 'Error processing batch auto deductions',
        error: error.message
      };
    }
  }

  /**
   * Get member's savings deduction history
   */
  async getMemberDeductionHistory(memberId, limit = 50) {
    try {
      const deductionHistory = await Installment.find({
        member: memberId,
        isDeduction: true,
        paymentMethod: 'savings_deduction'
      })
        .sort({ collectionDate: -1 })
        .limit(limit)
        .populate('member', 'name phone')
        .populate('collector', 'name');

      return {
        success: true,
        data: deductionHistory
      };
    } catch (error) {
      console.error('❌ Error fetching deduction history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate potential savings deductions for planning
   */
  async calculatePotentialDeductions(targetDate = null) {
    try {
      const processDate = targetDate || new Date();

      const pendingInstallments = await Installment.find({
        status: 'pending',
        dueDate: { $lte: processDate },
        isActive: { $ne: false }
      }).populate('member', 'name totalSavings phone');

      const analysis = {
        totalPendingInstallments: pendingInstallments.length,
        totalPendingAmount: 0,
        potentialDeductionAmount: 0,
        membersWithSufficientSavings: 0,
        membersWithPartialSavings: 0,
        membersWithNoSavings: 0,
        details: []
      };

      for (const installment of pendingInstallments) {
        if (!installment.member) continue;

        const installmentAmount = installment.amount;
        const memberSavings = installment.member.totalSavings || 0;
        const possibleDeduction = Math.min(installmentAmount, memberSavings);

        analysis.totalPendingAmount += installmentAmount;
        analysis.potentialDeductionAmount += possibleDeduction;

        if (memberSavings >= installmentAmount) {
          analysis.membersWithSufficientSavings++;
        } else if (memberSavings > 0) {
          analysis.membersWithPartialSavings++;
        } else {
          analysis.membersWithNoSavings++;
        }

        analysis.details.push({
          memberId: installment.member._id,
          memberName: installment.member.name,
          phone: installment.member.phone,
          installmentAmount: installmentAmount,
          currentSavings: memberSavings,
          possibleDeduction: possibleDeduction,
          remainingAmount: installmentAmount - possibleDeduction,
          canFullyPay: memberSavings >= installmentAmount
        });
      }

      return {
        success: true,
        analysis: analysis
      };

    } catch (error) {
      console.error('❌ Error calculating potential deductions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get product-specific savings for a member's installment
   * This calculates how much savings are available for the specific product
   */
  async getProductSpecificSavings(memberId, installment) {
    try {
      // Get the installment's distribution ID or product info
      const installmentDistributionId = installment.distributionId;
      const installmentNote = installment.note || '';

      console.log(`🔍 Finding product-specific savings for member: ${memberId}`);
      console.log(`   - Installment Distribution ID: ${installmentDistributionId || 'N/A'}`);
      console.log(`   - Installment Note: "${installmentNote.substring(0, 50)}..."`);

      // Find all savings collections for this member
      const allSavingsRecords = await Installment.find({
        member: memberId,
        installmentType: 'extra',
        status: 'collected',
        note: { $regex: 'Savings Collection', $options: 'i' }
      });

      console.log(`📊 Found ${allSavingsRecords.length} total savings records`);

      let productSpecificSavings = 0;

      // Extract product name from installment note
      let installmentProductName = null;
      if (installmentNote.includes('Product Loan:')) {
        const productMatch = installmentNote.match(/Product Loan: (.+?) -/);
        if (productMatch) {
          installmentProductName = productMatch[1].trim().toLowerCase();
        }
      }

      console.log(`🏷️ Installment Product Name: "${installmentProductName || 'Unknown'}"`);

      // Calculate product-specific savings
      for (const savingsRecord of allSavingsRecords) {
        const savingsNote = savingsRecord.note || '';
        const savingsAmount = savingsRecord.amount || 0;

        let belongsToSameProduct = false;

        // Method 1: Distribution ID matching (most reliable)
        if (installmentDistributionId && savingsRecord.distributionId) {
          if (savingsRecord.distributionId === installmentDistributionId ||
            savingsRecord.distributionId.includes(installmentDistributionId) ||
            installmentDistributionId.includes(savingsRecord.distributionId)) {
            belongsToSameProduct = true;
            console.log(`   ✅ Distribution ID match: ${savingsRecord.distributionId}`);
          }
        }

        // Method 2: Product name in savings note ("Product: Mobile")
        if (!belongsToSameProduct && installmentProductName && savingsNote.toLowerCase().includes('product:')) {
          const savingsProductMatch = savingsNote.match(/product:\s*(.+?)(?:\s*\||\s*,|\s*$)/i);
          if (savingsProductMatch) {
            const savingsProductName = savingsProductMatch[1].trim().toLowerCase();
            if (savingsProductName.includes(installmentProductName) ||
              installmentProductName.includes(savingsProductName)) {
              belongsToSameProduct = true;
              console.log(`   ✅ Product name match: "${savingsProductName}" matches "${installmentProductName}"`);
            }
          }
        }

        // Method 3: Legacy fallback for old savings without product info
        if (!belongsToSameProduct && !savingsRecord.distributionId && !savingsNote.toLowerCase().includes('product:')) {
          // Old savings without product specificity - can be used for any installment
          belongsToSameProduct = true;
          console.log(`   ⚠️ Legacy savings (no product info): ৳${savingsAmount}`);
        }

        if (belongsToSameProduct) {
          productSpecificSavings += savingsAmount;
          console.log(`   💰 Added ৳${savingsAmount} to product-specific savings (Total: ৳${productSpecificSavings})`);
        } else {
          console.log(`   ❌ Skipped ৳${savingsAmount} (different product)`);
        }
      }

      // Check if any savings have already been used for deductions
      const usedDeductions = await Installment.find({
        member: memberId,
        isDeduction: true,
        paymentMethod: 'savings_deduction'
      });

      const totalDeductionsUsed = usedDeductions.reduce((sum, deduction) => {
        // Check if this deduction was for the same product
        if (installmentDistributionId && deduction.distributionId === installmentDistributionId) {
          return sum + (deduction.amount || 0);
        }
        return sum;
      }, 0);

      const availableProductSavings = Math.max(0, productSpecificSavings - totalDeductionsUsed);

      console.log(`📈 Product-Specific Savings Summary:`);
      console.log(`   - Total Product Savings: ৳${productSpecificSavings}`);
      console.log(`   - Previously Used Deductions: ৳${totalDeductionsUsed}`);
      console.log(`   - Available for Deduction: ৳${availableProductSavings}`);

      return availableProductSavings;

    } catch (error) {
      console.error('❌ Error calculating product-specific savings:', error);
      return 0; // Return 0 if calculation fails
    }
  }
}

module.exports = new AutoSavingsDeductionService();
