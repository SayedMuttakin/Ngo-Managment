import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Package, Target, AlertCircle, Plus, Calendar } from 'lucide-react';
import { branchesAPI, installmentsAPI, membersAPI, dashboardAPI, schedulesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const CollectorDashboard = ({ selectedDay, selectedCollector, onGoBack, onBranchSelect, onShowCollectionSheet }) => {
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);

  // Get today's date in Bangladesh timezone (UTC+6)
  const getBangladeshDate = () => {
    const now = new Date();
    // Bangladesh is UTC+6, so add 6 hours to UTC time
    // Note: toISOString() already gives UTC, so we just need to add 6 hours
    const bangladeshTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
    // Format as YYYY-MM-DD for Bangladesh date
    const year = bangladeshTime.getUTCFullYear();
    const month = String(bangladeshTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(bangladeshTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getBangladeshDate()); // Date picker state
  const [newBranch, setNewBranch] = useState({
    branchName: '',
    branchCode: ''
  });
  const [dashboardData, setDashboardData] = useState({
    todayCollection: 0,
    todaySavings: 0,
    todayTarget: 25000, // Base daily target
    productSales: 0,
    totalDue: 0,
    previousDue: 0, // Due from previous days
    actualTarget: 25000, // Today's target + previous due
    outstandingBalance: 0,
    branches: [],
    recentTransactions: []
  });

  useEffect(() => {
    console.log('🚀🚀🚀 COLLECTOR DASHBOARD LOADED - NEW CODE VERSION 🚀🚀🚀');
    console.log('📅 Selected Date:', selectedDate);
    console.log('👤 Selected Collector:', selectedCollector?.name);

    loadCollectorDashboard();

    // ✅ LISTEN FOR INSTALLMENT COLLECTION EVENTS: Reload dashboard when payment is collected
    const handleInstallmentCollected = (event) => {
      console.log('💰 Installment collected event received:', event.detail);
      console.log('🔄 Reloading collector dashboard...');

      // Reload dashboard with a small delay to ensure backend is updated
      setTimeout(() => {
        loadCollectorDashboard();
      }, 600);
    };

    window.addEventListener('installmentCollected', handleInstallmentCollected);

    // ✅ ALSO LISTEN FOR GENERIC DASHBOARD RELOAD
    const handleDashboardReload = () => {
      console.log('🔄 Generic dashboard reload event received');
      loadCollectorDashboard();
    };

    window.addEventListener('dashboardReload', handleDashboardReload);

    // Cleanup
    return () => {
      window.removeEventListener('installmentCollected', handleInstallmentCollected);
      window.removeEventListener('dashboardReload', handleDashboardReload);
    };
  }, [selectedCollector, selectedDay, selectedDate]);

  const loadCollectorDashboard = async () => {
    console.log('\n\n🔄🔄🔄 LOADING COLLECTOR DASHBOARD 🔄🔄🔄');
    console.log('📅 Date:', selectedDate);
    console.log('👤 Collector:', selectedCollector?.name, selectedCollector?.id);

    try {
      setLoading(true);

      // Backend API থেকে data load করছি - day parameter সহ
      const dayParam = selectedDay?.isDaily ? 'Daily' : selectedDay?.name; // Convert 'Daily Kisti' to 'Daily'
      const response = await dashboardAPI.getCollectorDashboard(
        selectedCollector.id,
        selectedDate,
        dayParam  // 🎯 Pass collection day
      );

      console.log('📡 API Response:', response);

      if (response.success) {
        console.log('✅ API SUCCESS - Using backend data');
        const data = response.data;
        console.log('📊 Backend Due Balance:', data.dueBalance);
        console.log('📊 Backend Net Balance:', data.netBalance);
        console.log('📊 Backend Today Collection:', data.todayCollection);
        console.log('📊 Backend Today Savings:', data.todaySavings);

        // Dashboard data update করছি
        setDashboardData(prev => ({
          ...prev,
          todayCollection: data.todayCollection || 0,
          todaySavings: data.todaySavings || 0,
          totalDue: data.dueBalance || 0,
          outstandingBalance: data.netBalance || 0,
          branches: data.branches || [],
          todayTarget: data.dueBalance || 0, // Due balance কেই target ধরছি
          actualTarget: data.dueBalance || 0
        }));
      } else {
        console.log('❌ API FAILED - Using fallback method');
        // যদি API fail করে, তাহলে পুরানো method use করব
        await loadBasicDashboardData();
        setTimeout(() => {
          loadDetailedDashboardData();
        }, 100);
      }
    } catch (error) {
      console.log('API error, falling back to old method:', error);
      // Fallback to old method
      await loadBasicDashboardData();
      setTimeout(() => {
        loadDetailedDashboardData();
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  const loadBasicDashboardData = async () => {
    try {

      // Get selected date (or today if not specified) in different formats for debugging
      const today = selectedDate; // Use selected date from date picker
      const todayStart = new Date(selectedDate);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(selectedDate);
      todayEnd.setHours(23, 59, 59, 999);


      // Load collector's branches (fast)
      const branchesResponse = await branchesAPI.getByCollector(selectedCollector.id);
      const collectorBranches = branchesResponse.success ? branchesResponse.data : [];

      // Set basic dashboard data immediately
      setDashboardData(prev => ({
        ...prev,
        branches: collectorBranches
      }));


    } catch (error) {
      // Error loading basic dashboard data
    }
  };

  const loadDetailedDashboardData = async () => {
    console.log('\n\n🔍🔍🔍 LOADING DETAILED DASHBOARD DATA (FALLBACK METHOD) 🔍🔍🔍');

    try {

      const today = selectedDate; // Use selected date from date picker
      const todayStart = new Date(selectedDate);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(selectedDate);
      todayEnd.setHours(23, 59, 59, 999);

      // CRITICAL FIX: Get all installments from members in collector's branches
      // Instead of filtering by collectorId (which may not be set), get by branch members
      let allCollectorInstallments = [];

      // CRITICAL: Fetch branches again to ensure we have latest data (state might not be updated yet)
      console.log(`🔍 Fetching branches for collector ID: ${selectedCollector.id}`);
      const branchesResponse = await branchesAPI.getByCollector(selectedCollector.id);
      console.log(`📦 Branches API Response:`, branchesResponse);

      const currentBranches = branchesResponse.success ? branchesResponse.data : [];

      console.log(`📊 Collector has ${currentBranches.length} branches:`, currentBranches.map(b => b.branchCode));
      console.log(`🔍 DEBUG: Selected Date: ${selectedDate}`);
      console.log(`🔍 DEBUG: Collector ID: ${selectedCollector.id}`);
      console.log(`🔍 DEBUG: Collector Name: ${selectedCollector.name}`);

      for (const branch of currentBranches) {
        console.log(`  🔍 Processing branch: ${branch.branchCode} (${branch.name})`);
        try {
          // Get all members for this branch
          const membersResponse = await membersAPI.getAll({
            branchCode: branch.branchCode,
            limit: 1000
          });

          console.log(`    👥 Found ${membersResponse.data?.length || 0} members in branch ${branch.branchCode}`);

          if (membersResponse.success && membersResponse.data) {
            // Get installments for each member
            for (const member of membersResponse.data) {
              try {
                const memberInstallments = await installmentsAPI.getMemberHistory(member._id, 100);

                if (memberInstallments.success) {
                  let installmentData = [];

                  if (Array.isArray(memberInstallments.data)) {
                    installmentData = memberInstallments.data;
                  } else if (memberInstallments.data && Array.isArray(memberInstallments.data.history)) {
                    installmentData = memberInstallments.data.history;
                  } else if (memberInstallments.data && Array.isArray(memberInstallments.data.installments)) {
                    installmentData = memberInstallments.data.installments;
                  }

                  allCollectorInstallments.push(...installmentData);
                }
              } catch (error) {
                // Continue with next member
              }
            }
          }
        } catch (error) {
          // Continue with next branch
        }
      }

      console.log(`📊 Collector Dashboard: Fetched ${allCollectorInstallments.length} total installments from all branches`);

      // Create a response object similar to API response
      const installmentsResponse = {
        success: true,
        data: allCollectorInstallments
      };

      // Get total savings from all branches by fetching members data
      let totalSavingsAllTime = 0;

      // Reuse currentBranches from above (already declared at line 90)

      for (const branch of currentBranches) {

        try {
          // Get all members for this branch
          const membersResponse = await membersAPI.getAll({
            branchCode: branch.branchCode,
            limit: 1000
          });

          if (membersResponse.success && membersResponse.data) {
            let branchSavings = 0;
            membersResponse.data.forEach(member => {
              const memberSavings = member.totalSavings || member.savings || 0;
              branchSavings += memberSavings;
            });

            totalSavingsAllTime += branchSavings;
          }
        } catch (error) {
          // Error fetching members for branch
        }
      }


      // Calculate today's collection and categorize
      let todayLoanCollection = 0; // Loan installments collected today
      let todaySavingsCollection = 0; // Savings collected today
      let productSalesTotal = 0; // Total product sales amount (ALL TIME)
      let totalLoanCollections = 0; // Total loan collections (ALL TIME)
      let todayCollectedInstallments = []; // 🎯 DECLARE OUTSIDE BLOCK for reuse in due calculation

      if (installmentsResponse.success && installmentsResponse.data) {
        const allInstallments = installmentsResponse.data;

        // Helper to convert a JS Date to Bangladesh date string (YYYY-MM-DD)
        const toBDDateStr = (dateObj) => {
          if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return null;
          const bd = new Date(dateObj.getTime() + (6 * 60 * 60 * 1000)); // UTC+6
          return bd.toISOString().split('T')[0];
        };

        // 🔍 DEBUG: Show ALL collected/partial installments with their dates
        console.log(`\n📊 ========== ALL COLLECTED INSTALLMENTS (Last 10) ==========`);
        const allCollected = allInstallments.filter(i => i.status === 'collected' || i.status === 'partial');
        console.log(`Total Collected/Partial: ${allCollected.length}`);
        allCollected.slice(0, 10).forEach(inst => {
          const collectionDateRaw = inst.collectionDate || inst.createdAt;
          const collectionDate = new Date(collectionDateRaw);
          const bdDateStr = toBDDateStr(collectionDate);
          const amount = inst.paidAmount != null ? inst.paidAmount : inst.amount;
          console.log(`  💰 ${inst.member?.name}: ৳${amount} - BD Date: ${bdDateStr} - Status: ${inst.status} - Type: ${inst.installmentType}`);
        });
        console.log(`========================================\n`);

        console.log(`\n🔍 ========== FILTERING TODAY'S COLLECTIONS ==========`);
        console.log(`📅 Selected Date: ${selectedDate}`);
        console.log(`📊 Total Installments to Check: ${allInstallments.length}`);

        // Show sample of ALL installments with their details
        console.log(`\n📊 Sample of ALL installments (first 5):`);
        allInstallments.slice(0, 5).forEach(inst => {
          const collectionDateRaw = inst.collectionDate || inst.createdAt;
          const collectionDate = new Date(collectionDateRaw);
          const bdDateStr = toBDDateStr(collectionDate);
          console.log(`  - Member: ${inst.member?.name}, Amount: ${inst.amount}, PaidAmount: ${inst.paidAmount}, Status: ${inst.status}, Type: ${inst.installmentType}, BD Date: ${bdDateStr}, Note: ${inst.note?.substring(0, 30) || 'N/A'}`);
        });

        todayCollectedInstallments = allInstallments.filter(installment => {
          // Must be collected or partial status (to include partial payments)
          if (installment.status !== 'collected' && installment.status !== 'partial') {
            return false;
          }

          // Check if collection date matches selected date (Bangladesh timezone)
          const collectionDateRaw = installment.collectionDate || installment.createdAt;
          const collectionDate = new Date(collectionDateRaw);
          const selectedDateObj = new Date(selectedDate);

          const collectionDateStr = toBDDateStr(collectionDate);
          const selectedDateStr = toBDDateStr(selectedDateObj);
          const isSelectedDate = collectionDateStr === selectedDateStr;

          // Debug log for first 5 collected/partial installments
          if (allInstallments.filter(i => i.status === 'collected' || i.status === 'partial').indexOf(installment) < 5) {
            console.log(`  📝 ${installment.member?.name}: Status=${installment.status}, Amount=${installment.amount}, CollectionDate=${collectionDateStr}, Selected=${selectedDateStr}, Match=${isSelectedDate}`);
          }

          return isSelectedDate;
        });

        console.log(`✅ Found ${todayCollectedInstallments.length} installments collected on ${selectedDate}`);
        console.log(`========================================\n`);

        console.log(`📊 Collector Dashboard: Found ${todayCollectedInstallments.length} collected installments today`);

        // Process today's collections
        todayCollectedInstallments.forEach(installment => {
          let amount = 0;
          if (installment.paymentHistory && installment.paymentHistory.length > 0) {
            // Sum all payments made on the selected date
            const todayPayments = installment.paymentHistory.filter(payment => {
              if (!payment.date) return false;
              const paymentDate = new Date(payment.date);
              const paymentDateStr = toBDDateStr(paymentDate);
              const selectedDateObj = new Date(selectedDate);
              const selectedDateStr = toBDDateStr(selectedDateObj);
              return paymentDateStr === selectedDateStr;
            });

            amount = todayPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
            if (todayPayments.length > 1) {
              console.log(`💰 Client-side: Multiple payments for installment ${installment._id}: ${todayPayments.length} payments = ৳${amount}`);
            }
          } else if (installment.isAutoApplied) {
            // Skip fallback for auto-applied installments without history (prevents double counting)
            amount = 0;
            console.log(`   ⏭️ Client-side: Skipping auto-applied installment ${installment._id} without history`);
          } else {
            // Fallback for legacy records
            amount = (installment.paidAmount != null && installment.paidAmount > 0)
              ? installment.paidAmount
              : (installment.amount != null && installment.amount > 0)
                ? installment.amount
                : 0;
          }

          const note = installment.note || '';
          const type = installment.installmentType;
          const memberName = installment.member?.name || 'Unknown';

          console.log(`🔍 Processing: ${memberName} - Amount: ${amount}, PaidAmount: ${installment.paidAmount}, InstallmentAmount: ${installment.amount}`);

          // ✅ IMPROVED: Flexible categorization based on installmentType
          // Savings: installmentType === 'savings' OR note contains "savings" (case insensitive)
          // Loan: All other types (regular, extra, advance, penalty)

          const noteLower = note.toLowerCase();
          const isSavingsWithdrawal = noteLower.includes('savings withdrawal') || noteLower.includes('withdrawal');
          const isSavingsCollection = noteLower.includes('savings collection');
          const isSavings = !isSavingsWithdrawal && (type === 'savings' || isSavingsCollection || noteLower.includes('সঞ্চয়'));
          const isProductSale = noteLower.includes('product sale') || noteLower.includes('বিক্রয়');

          // 🔍 DETAILED DEBUG for categorization
          console.log(`\n🔍 Categorizing installment:`);
          console.log(`   Member: ${memberName}`);
          console.log(`   Type: ${type}`);
          console.log(`   Note: ${note || 'No note'}`);
          console.log(`   Amount calculated: ${amount}`);
          console.log(`   InstallmentAmount field: ${installment.amount}`);
          console.log(`   PaidAmount field: ${installment.paidAmount}`);
          console.log(`   Status: ${installment.status}`);
          console.log(`   Is Savings: ${isSavings}`);
          console.log(`   Is Savings Withdrawal: ${isSavingsWithdrawal}`);
          console.log(`   Is Product Sale: ${isProductSale}`);

          if (isProductSale) {
            // ❌ SKIP: Product sale is NOT a collection, it's loan disbursement
            console.log(`   ❌ SKIPPED: Product Sale (loan disbursement, not collection)`);
          } else if (isSavingsWithdrawal) {
            // Savings withdrawal - SUBTRACT from savings
            todaySavingsCollection -= amount;
            console.log(`   ➡️ Category: SAVINGS WITHDRAWAL (৳-${amount})`);
          } else if (isSavings) {
            // Savings collection - ADD to savings
            todaySavingsCollection += amount;
            console.log(`   ➡️ Category: SAVINGS COLLECTION (৳${amount})`);
          } else {
            // Loan installment collection (regular, extra, advance, penalty)
            todayLoanCollection += amount;
            console.log(`   ➡️ Category: LOAN INSTALLMENT (৳${amount})`);
          }
        });

        console.log(`
✅ ========== TODAY'S COLLECTIONS (${selectedDate}) ==========`);
        console.log(`💰 Loan Collections: ৳${todayLoanCollection}`);
        console.log(`💵 Savings Collections: ৳${todaySavingsCollection}`);
        console.log(`📈 Total Collected Today: ৳${todayLoanCollection + todaySavingsCollection}`);
        console.log(`========================================
`);

        // Calculate ALL-TIME totals for Net Balance
        const allCollectedInstallments = allInstallments.filter(installment =>
          installment.status === 'collected' || installment.status === 'partial'
        );

        allCollectedInstallments.forEach(installment => {
          const amount = (installment.paidAmount != null ? installment.paidAmount : installment.amount) || 0;
          const note = installment.note || '';
          const type = installment.installmentType;
          const noteLower = note.toLowerCase();

          // ✅ IMPROVED: Flexible categorization
          // Product Sale: note contains "product sale" or "বিক্রয়"
          // Loan Repayment: All non-savings installments (regular, extra, advance, penalty)

          const isProductSale = noteLower.includes('product sale') || noteLower.includes('বিক্রয়');
          const isSavings = type === 'savings' || noteLower.includes('savings') || noteLower.includes('সঞ্চয়');

          if (isProductSale) {
            // Product sale (loan given out)
            productSalesTotal += amount;
          } else if (!isSavings) {
            // Loan repayment (money coming back) - exclude savings
            totalLoanCollections += amount;
          }
        });

        console.log(`
📊 ========== NET BALANCE CALCULATION (ALL TIME) ==========`);
        console.log(`📦 Product Sales (Loans Given): ৳${productSalesTotal}`);
        console.log(`💰 Loan Repayments (Money Received): ৳${totalLoanCollections}`);
      }

      // Net Balance will be calculated after due balance calculation

      // ✅ DUE BALANCE = TODAY + OVERDUE ONLY (not future)
      let todayDueBalance = 0; // Total due amount - today + overdue only
      let totalExpectedToday = 0; // Today's scheduled installments (for target)

      if (installmentsResponse.success && installmentsResponse.data) {
        const allInstallments = installmentsResponse.data;
        const selectedDateObj = new Date(selectedDate);
        const todayDateString = selectedDateObj.toDateString();

        // 🎯 CALCULATE DUE BALANCE (TODAY + OVERDUE installments ONLY)
        const dueInstallments = allInstallments.filter(installment => {
          // Must be pending or partial status
          if (installment.status !== 'pending' && installment.status !== 'partial') return false;

          // Must have due date
          if (!installment.dueDate) return false;

          // ✅ CRITICAL: INCLUDE INSTALLMENTS DUE TODAY OR EARLIER (starts from beginning of today)
          const dueDate = new Date(installment.dueDate);
          dueDate.setHours(0, 0, 0, 0); // Start of due date

          const todayDate = new Date(selectedDate);
          todayDate.setHours(0, 0, 0, 0); // Start of today

          // ✅ TRUE if due date <= today (includes today from 00:00)
          const isDueOrOverdue = dueDate <= todayDate; // Today (from start) or past dates

          if (isDueOrOverdue && installment.member) {
            const daysDiff = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));
            let status = 'Due Today';
            if (daysDiff > 0) status = `${daysDiff} day${daysDiff > 1 ? 's' : ''} overdue`;
            console.log(`🔍 Including ${installment.member.name}: ${status}, Amount: ৳${installment.amount}`);
          }

          return isDueOrOverdue;
        });

        console.log(`\n📅 ===== DUE BALANCE CALCULATION =====`);
        console.log(`📅 Selected Date (Today): ${new Date(selectedDate).toLocaleDateString()}`);
        console.log(`📅 Found ${dueInstallments.length} installments due/overdue (today + past only)`);
        console.log(`🔍 DEBUG: Total installments in database: ${allInstallments.length}`);
        console.log(`🔍 DEBUG: Pending installments: ${allInstallments.filter(i => i.status === 'pending').length}`);
        console.log(`🔍 DEBUG: Partial installments: ${allInstallments.filter(i => i.status === 'partial').length}`);
        console.log(`🔍 DEBUG: Collected installments: ${allInstallments.filter(i => i.status === 'collected').length}`);

        // Count future installments (for debugging)
        const futureCount = allInstallments.filter(i => {
          if (i.status !== 'pending' && i.status !== 'partial') return false;
          if (!i.dueDate) return false;
          const dueDate = new Date(i.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const todayDate = new Date(selectedDate);
          todayDate.setHours(0, 0, 0, 0);
          return dueDate > todayDate;
        }).length;
        console.log(`🔍 DEBUG: Future installments (excluded from due): ${futureCount}`);

        // 🔍 DEBUG: Show due dates of pending installments with comparison
        console.log(`🔍 DEBUG: Sample pending installment due dates vs Selected Date:`);
        const todayForDebug = new Date(selectedDate);
        todayForDebug.setHours(0, 0, 0, 0);

        allInstallments.filter(i => i.status === 'pending').slice(0, 10).forEach(inst => {
          const memberName = inst.member?.name || 'Unknown';
          if (inst.dueDate) {
            const dueDate = new Date(inst.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const dueDateStr = dueDate.toLocaleDateString();
            const isIncluded = dueDate <= todayForDebug;
            const comparison = dueDate < todayForDebug ? 'OVERDUE' : (dueDate.getTime() === todayForDebug.getTime() ? 'DUE TODAY' : 'FUTURE');
            console.log(`  - ${memberName}: Due ${dueDateStr} (৳${inst.amount}) → ${comparison} ${isIncluded ? '✅ INCLUDED' : '❌ EXCLUDED'}`);
          } else {
            console.log(`  - ${memberName}: No due date (৳${inst.amount})`);
          }
        });

        // 🎯 CRITICAL FIX: Filter out installments that were already collected today
        // Also exclude installments with same member + amount that were collected
        const todayCollectedIds = todayCollectedInstallments.map(inst => inst._id).filter(Boolean);
        const todayCollectedKeys = todayCollectedInstallments.map(inst => {
          const memberId = inst.member?._id || inst.member;
          const amount = inst.amount || 0;
          const dueDate = inst.dueDate ? new Date(inst.dueDate).toDateString() : null;
          return `${memberId}-${amount}-${dueDate}`;
        }).filter(Boolean);

        console.log(`🔄 Excluding ${todayCollectedIds.length} installments collected today from due balance`);

        const actualDueInstallments = dueInstallments.filter(installment => {
          // Method 1: Exclude by ID
          if (todayCollectedIds.includes(installment._id)) {
            console.log(`  ✂️ Excluded by ID: ${installment.member?.name} - ৳${installment.amount}`);
            return false;
          }

          // Method 2: Exclude by member + amount + dueDate match (for duplicate entries)
          const memberId = installment.member?._id || installment.member;
          const amount = installment.amount || 0;
          const dueDate = installment.dueDate ? new Date(installment.dueDate).toDateString() : null;
          const key = `${memberId}-${amount}-${dueDate}`;

          if (todayCollectedKeys.includes(key)) {
            console.log(`  ✂️ Excluded by match: ${installment.member?.name} - ৳${amount}`);
            return false;
          }

          return true;
        });

        console.log(`📅 After excluding collected installments: ${actualDueInstallments.length} still due`);

        actualDueInstallments.forEach(installment => {
          let dueAmount = 0;

          if (installment.status === 'partial') {
            // For partial: remaining amount = total - paid
            const totalAmount = installment.amount || 0;
            const paidAmount = installment.paidAmount || 0;
            dueAmount = Math.max(0, totalAmount - paidAmount);
          } else if (installment.status === 'pending') {
            // For pending: full amount is due
            dueAmount = installment.amount || 0;
          }

          todayDueBalance += dueAmount;

          const statusIcon = installment.status === 'partial' ? '⚠️' : '⏳';
          const memberName = installment.member?.name || 'Unknown';
          const dueDateStr = new Date(installment.dueDate).toLocaleDateString();
          const today = new Date(selectedDate);
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(installment.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          let dueDateStatus = 'Due Today';
          const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          if (daysDiff > 0) {
            dueDateStatus = `${daysDiff} day${daysDiff > 1 ? 's' : ''} overdue`;
          } else if (daysDiff < 0) {
            dueDateStatus = `Due in ${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''}`;
          }

          console.log(`  ${statusIcon} ${memberName}: ৳${dueAmount} (${dueDateStatus}) - Status: ${installment.status}`);
        });

        console.log(`💰 TOTAL DUE BALANCE (Today + Overdue ONLY): ৳${todayDueBalance}`);
        console.log(`✅ This includes only installments due today or overdue (past dates)`);

        // 🎯 For target calculation: Today's due balance is same as expected amount
        totalExpectedToday = todayDueBalance;

        console.log(`🎯 Total Expected to Collect: ৳${totalExpectedToday} (includes overdue amounts)`);
      }

      // 🎯 NET BALANCE = Due Balance (all outstanding installments)
      const netBalance = todayDueBalance;
      console.log(`\n🎯 NET BALANCE = ৳${netBalance} (same as Due Balance - all outstanding)`);
      console.log(`   This shows total amount still owed by members\n`);

      // Total collection = loans + savings
      const totalTodayCollection = todayLoanCollection + todaySavingsCollection;

      // 🎯 SIMPLIFIED TARGET CALCULATION
      // Base Target = Today's due balance (all pending installments)
      const baseDailyTarget = todayDueBalance;
      const actualTarget = baseDailyTarget; // No need for complex cumulative calculation
      const previousDue = 0; // Remove confusing previous due

      // Prepare recent transactions from real data
      const recentTransactions = [];
      if (installmentsResponse.success && installmentsResponse.data) {
        const sortedInstallments = installmentsResponse.data
          .sort((a, b) => new Date(b.collectionDate || b.createdAt) - new Date(a.collectionDate || a.createdAt))
          .slice(0, 10); // Get latest 10 transactions

        sortedInstallments.forEach((installment, index) => {
          const time = new Date(installment.collectionDate || installment.createdAt)
            .toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });

          let type = 'installment';
          if (installment.installmentType === 'regular') {
            type = 'savings';
          } else if (installment.installmentType === 'extra') {
            type = 'product';
          }

          recentTransactions.push({
            id: installment._id || index,
            type: type,
            member: installment.member?.name || 'Unknown Member',
            amount: installment.amount || 0,
            time: time,
            note: installment.note || ''
          });
        });
      }

      // ✅ Update dashboard data with TODAY'S due balance calculation
      setDashboardData(prev => ({
        ...prev,
        todayCollection: todayLoanCollection, // Today's loan installments collected
        todaySavings: todaySavingsCollection, // Today's savings collected
        todayTarget: baseDailyTarget, // All pending installments
        actualTarget, // Same as base target (simplified)
        totalDue: todayDueBalance, // All pending installments
        previousDue: 0, // Removed - no longer needed
        outstandingBalance: netBalance, // Same as Due Balance
        recentTransactions
      }));

      console.log(`📡 Dashboard Updated - Due Balance: ৳${todayDueBalance} (Due + Overdue, matches Pending Installments: ৳5,698)`);


    } catch (error) {
      // Error loading detailed dashboard data
    }
  };

  const handleAddBranch = async () => {
    if (!newBranch.branchName.trim() || !newBranch.branchCode.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate branch code format (4 digits)
    if (!/^\d{4}$/.test(newBranch.branchCode.trim())) {
      toast.error('Branch code must be exactly 4 digits');
      return;
    }

    // Check if branch code already exists
    const existingBranch = dashboardData.branches.find(branch => branch.branchCode === newBranch.branchCode.trim());
    if (existingBranch) {
      toast.error('Branch code already exists');
      return;
    }

    try {
      setAddingBranch(true);

      // 🎯 NEW: Add branch to CollectionSchedule instead of Branch model
      const scheduleData = {
        collectorId: selectedCollector.id,
        collectionDay: selectedDay.isDaily ? 'Daily' : selectedDay.name, // Use 'Daily' for daily collectors
        branches: [{
          branchCode: newBranch.branchCode.trim(),
          branchName: newBranch.branchName.trim(),
          members: []
        }]
      };

      console.log('📤 Creating schedule with branch:', scheduleData);

      // Call API to create/update schedule using schedulesAPI
      const data = await schedulesAPI.create(scheduleData);

      if (data.success) {
        toast.success(`Branch ${newBranch.branchName} added successfully!`);

        // Reset form
        setNewBranch({
          branchName: '',
          branchCode: ''
        });
        setShowAddForm(false);

        // Reload dashboard data
        await loadCollectorDashboard();
      } else {
        throw new Error(data.message || 'Failed to add branch');
      }

    } catch (error) {
      console.error('Error adding branch:', error);
      toast.error(error.message || 'Failed to add branch');
    } finally {
      setAddingBranch(false);
    }
  };

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getBalanceIcon = (balance) => {
    if (balance > 0) return <TrendingUp className="h-5 w-5" />;
    if (balance < 0) return <TrendingDown className="h-5 w-5" />;
    return <DollarSign className="h-5 w-5" />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + '৳';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl lg:rounded-3xl shadow-2xl border p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 md:h-12 w-10 md:w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-sm md:text-base text-gray-600">Loading collector dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl lg:rounded-3xl shadow-2xl border p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 lg:mb-8 space-y-4 lg:space-y-0">
        <div className="text-center lg:text-left">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Collector Dashboard</h2>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            {selectedCollector.name} - {selectedDay.name}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:space-x-3 lg:items-center">
          {/* Date Picker */}
          <div className="flex items-center justify-center space-x-2 bg-gray-50 px-3 md:px-4 py-2 rounded-xl border border-gray-300">
            <Calendar className="h-4 md:h-5 w-4 md:w-5 text-gray-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={getBangladeshDate()}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-gray-900 font-medium cursor-pointer text-sm md:text-base"
            />
          </div>
          <button
            onClick={() => {
              loadCollectorDashboard();
            }}
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold transition-all text-sm md:text-base"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
          <button
            onClick={onGoBack}
            className="flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Collection */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Today's Collection</p>
              <p className="text-2xl font-bold">{formatCurrency(dashboardData.todayCollection)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-200" />
          </div>
        </div>

        {/* Today's Savings */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Today's Savings</p>
              <p className="text-2xl font-bold">{formatCurrency(Math.max(0, dashboardData.todaySavings))}</p>
            </div>
            <Users className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        {/* Due Balance */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Due Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(dashboardData.totalDue)}</p>
              <p className="text-xs mt-1 opacity-90">Today + Overdue</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-200" />
          </div>
        </div>

        {/* Net Balance - Outstanding Loans */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Net Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(dashboardData.outstandingBalance)}</p>
              <p className="text-xs mt-1 opacity-90">Total Outstanding</p>
            </div>
            <Package className="h-8 w-8 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Target vs Achievement */}
      <div className="bg-gray-50 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Target vs Achievement Calculation
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Base Daily Target:</span>
            <span className="font-semibold">{formatCurrency(dashboardData.todayTarget)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-gray-900 font-medium">Total Outstanding:</span>
            <span className="font-bold text-orange-600">{formatCurrency(dashboardData.totalDue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Today's Collection:</span>
            <span className="font-semibold text-green-600">{formatCurrency(dashboardData.todayCollection)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Today's Savings:</span>
            <span className="font-semibold text-blue-600">{formatCurrency(dashboardData.todaySavings)}</span>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-900 font-medium">Net Balance (Outstanding):</span>
              <span className="font-bold text-orange-600">
                {formatCurrency(dashboardData.outstandingBalance)}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Collection Progress (vs Total Outstanding)</span>
              <span>
                {dashboardData.todayTarget > 0
                  ? Math.round((dashboardData.todayCollection / dashboardData.todayTarget) * 100)
                  : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${dashboardData.todayTarget > 0
                    ? Math.min((dashboardData.todayCollection / dashboardData.todayTarget) * 100, 100)
                    : 0}%`
                }}
              ></div>
            </div>
          </div>

          {/* Info Messages */}
          {dashboardData.totalDue > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-orange-800 text-sm">
                <strong>💰 Total Outstanding:</strong> {formatCurrency(dashboardData.totalDue)} is currently pending from all members. Keep collecting!
              </p>
            </div>
          )}

          {dashboardData.todayCollection > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                <strong>✅ Great work!</strong> You've collected {formatCurrency(dashboardData.todayCollection)} today.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Branch Selection Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Branch to Manage</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Branch
          </button>
        </div>

        {/* Add Branch Form */}
        {showAddForm && (
          <div className="mb-6 p-6 bg-gray-50 rounded-xl border">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Add New Branch</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter branch name"
                  value={newBranch.branchName}
                  onChange={(e) => setNewBranch({ ...newBranch, branchName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Code (4 digits) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="e.g. 1234"
                  value={newBranch.branchCode}
                  onChange={(e) => setNewBranch({ ...newBranch, branchCode: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3 mt-4">
              <button
                onClick={handleAddBranch}
                disabled={addingBranch}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {addingBranch ? 'Adding...' : 'Add Branch'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewBranch({ branchName: '', branchCode: '' });
                }}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Branches List */}
        {dashboardData.branches.length === 0 && !showAddForm ? (
          <div className="text-center py-8 bg-gray-50 rounded-2xl">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No branches assigned to this collector</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-5 w-5" />
              <span>Add First Branch</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData.branches.map((branch) => (
              <div
                key={branch._id || branch.id}
                className="bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl shadow-sm overflow-hidden transition-all"
              >
                {/* Clickable Branch Header */}
                <button
                  onClick={() => onBranchSelect({
                    code: branch.branchCode,
                    name: branch.name,
                    members: branch.members || [],
                    collectorName: selectedCollector.name
                  })}
                  className="w-full p-6 text-left hover:bg-blue-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-xl">
                        {branch.branchCode}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-lg">{branch.name}</h4>
                        <p className="text-gray-600 text-sm">{branch.memberCount || 0} members</p>
                      </div>
                    </div>
                    <div className="text-blue-600 text-2xl">→</div>
                  </div>
                </button>

                {/* Collection Sheet Button */}
                <div className="px-6 pb-6">
                  <button
                    onClick={() => onShowCollectionSheet({
                      branchCode: branch.branchCode,
                      name: branch.name,
                      members: branch.members || []
                    })}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all text-sm flex items-center justify-center space-x-2"
                  >
                    <span>📋</span>
                    <span>Collection Sheet</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default CollectorDashboard;
