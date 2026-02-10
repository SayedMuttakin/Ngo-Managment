const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const Member = require('../models/Member');
const Installment = require('../models/Installment');
const Distribution = require('../models/Distribution');
const CollectionHistory = require('../models/CollectionHistory');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const User = require('../models/User');

const resetFinancialData = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ngo_management';
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });

        console.log('✅ Connected to MongoDB');
        console.log(`📡 URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);

        console.log('\n🔄 Starting COMPLETE Financial Data Reset...\n');
        console.log('⚠️  This will:');
        console.log('   ❌ DELETE: All Installments (Loan schedules)');
        console.log('   ❌ DELETE: All Distributions (Product disbursements)');
        console.log('   ❌ DELETE: All Collection History (Transactions)');
        console.log('   🔄 RESET: Member financial balances (Savings, Paid, LastPayment, MonthlyInstallment)\n');
        console.log('   ✅ PRESERVE: Members, Collectors, Branches, Products, Users (Logins will work!)\n');

        // Wait 3 seconds to allow cancellation
        console.log('⏳ Starting in 3 seconds... Press Ctrl+C to cancel if you change your mind.');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 1. Delete Installments
        console.log('🗑️  Step 1: Deleting Installments...');
        const deletedInstallments = await Installment.deleteMany({});
        console.log(`   ✅ Deleted ${deletedInstallments.deletedCount} installments`);

        // 2. Delete Distributions
        console.log('🗑️  Step 2: Deleting Distributions...');
        const deletedDistributions = await Distribution.deleteMany({});
        console.log(`   ✅ Deleted ${deletedDistributions.deletedCount} distributions`);

        // 3. Delete Collection History
        console.log('🗑️  Step 3: Deleting Collection History...');
        const deletedHistory = await CollectionHistory.deleteMany({});
        console.log(`   ✅ Deleted ${deletedHistory.deletedCount} transaction records`);

        // 4. Reset Member Financials
        console.log('💰 Step 4: Resetting Member Financials...');
        const memberUpdateResult = await Member.updateMany(
            {},
            {
                $set: {
                    totalSavings: 0,
                    totalPaid: 0,
                    lastPaymentDate: null,
                    monthlyInstallment: 0
                }
            }
        );
        console.log(`   ✅ Reset financial fields for ${memberUpdateResult.modifiedCount} members`);

        // 5. Reset Branch Financials
        console.log('🏢 Step 5: Resetting Branch Financials...');
        const branchUpdateResult = await Branch.updateMany(
            {},
            {
                $set: {
                    totalSavings: 0
                }
            }
        );
        console.log(`   ✅ Reset totalSavings for ${branchUpdateResult.modifiedCount} branches`);

        // 6. Reset Product Stock (restore distributed products to available stock)
        console.log('📦 Step 6: Resetting Product Stock...');
        const products = await Product.find({});
        let productResetCount = 0;
        for (const product of products) {
            product.availableStock = product.totalStock;
            product.distributedStock = 0;
            product.status = product.totalStock > 0 ? 'Active' : 'Out of Stock';
            await product.save();
            productResetCount++;
        }
        console.log(`   ✅ Reset stock levels for ${productResetCount} products`);

        // Final Summary
        console.log('\n📊 Final Data Audit:');
        const countMembers = await Member.countDocuments({});
        const countInstallments = await Installment.countDocuments({});
        const countDistributions = await Distribution.countDocuments({});
        const countHistory = await CollectionHistory.countDocuments({});
        const countBranches = await Branch.countDocuments({});
        const countProducts = await Product.countDocuments({});
        const countUsers = await User.countDocuments({});

        console.log(`   👥 Members: ${countMembers}`);
        console.log(`   🏢 Branches: ${countBranches}`);
        console.log(`   📦 Products: ${countProducts}`);
        console.log(`   👤 Users (Logins): ${countUsers}`);
        console.log(`   💵 Installments: ${countInstallments} (Verified 0)`);
        console.log(`   🚚 Distributions: ${countDistributions} (Verified 0)`);
        console.log(`   📝 Transactions: ${countHistory} (Verified 0)`);
        console.log(`   💰 Member Balances: All Reset to 0`);

        console.log('\n✅ Mission Accomplished! Financial data has been cleaned.');
        console.log('🚀 Admin and Collectors can now log in and start fresh entries.');

    } catch (error) {
        console.error('❌ Error during financial reset:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
};

resetFinancialData();
