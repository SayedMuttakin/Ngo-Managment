import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { membersAPI, branchesAPI, installmentsAPI } from '../../utils/api';
import { formatBDDateShort, getCurrentBDDateTime } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import '../../styles/collectionSheet.css';

// Helper function for currency formatting
const formatCurrency = (amount) => {
  const numAmount = Number(amount) || 0;
  return '\u09F3' + numAmount.toString(); // Unicode for Bengali Taka symbol
};

const CollectionSheet = ({ selectedCollector, selectedBranch, selectedDay, onGoBack }) => {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading collection sheet...');
  const [members, setMembers] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [collectorBranches, setCollectorBranches] = useState([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all'); // 'all' or specific branchCode
  // Month filtering state
  const [selectedMonthYear, setSelectedMonthYear] = useState(() => {
    const today = new Date();
    return { month: today.getMonth(), year: today.getFullYear() };
  });
  // NEW: Pagination state for daily schedules (9 dates per page)
  const [currentDatePage, setCurrentDatePage] = useState(0);
  const [isDailySchedule, setIsDailySchedule] = useState(false);
  const DATES_PER_PAGE = 9; // Show 9 dates at a time for daily schedules

  console.log(' CollectionSheet loaded with DATES_PER_PAGE:', DATES_PER_PAGE);

  useEffect(() => {
    // Unified data loading logic
    loadInitialData();
  }, [selectedCollector, selectedBranch]);

  // Event listener for installment collection updates
  useEffect(() => {
    const handleInstallmentCollected = (event) => {
      console.log('💰 Collection Sheet: Installment collected! Refreshing data...', event.detail);
      // Reload data to reflect changes
      setTimeout(() => {
        loadInitialData();
        toast.success('Collection sheet updated!', {
          icon: '🔄',
          duration: 2000
        });
      }, 1500); // Small delay to allow backend processing
    };

    // Listen for collection events
    window.addEventListener('installmentCollected', handleInstallmentCollected);
    window.addEventListener('dashboardReload', handleInstallmentCollected);

    // Cleanup
    return () => {
      window.removeEventListener('installmentCollected', handleInstallmentCollected);
      window.removeEventListener('dashboardReload', handleInstallmentCollected);
    };
  }, [selectedCollector, selectedBranch]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setLoadingProgress(0);

      if (!selectedCollector) {
        setMembers([]);
        return;
      }

      setLoadingMessage('Loading branches...');
      setLoadingProgress(25);

      // ✅ FIXED: Use selectedBranch if provided, otherwise get all branches
      let branches = [];

      if (selectedBranch) {
        // 🎯 Specific branch selected - only load this branch
        console.log('🎯 Using selected branch:', selectedBranch);
        branches = [{
          branchCode: selectedBranch.code,
          name: selectedBranch.name,
          members: selectedBranch.members || []
        }];
        setCollectorBranches(branches);
        setSelectedBranchFilter(selectedBranch.code); // Auto-filter to this branch
      } else {
        // 📊 Get all branches for the collector
        const branchesResponse = await branchesAPI.getByCollector(selectedCollector.id);
        if (!branchesResponse.success || !branchesResponse.data) {
          setMembers([]);
          return;
        }
        branches = branchesResponse.data;
        setCollectorBranches(branches);

        // Auto-select first branch if not already selected and branches exist
        if (selectedBranchFilter === 'all' && branches.length === 1) {
          setSelectedBranchFilter(branches[0].branchCode);
        }
      }

      let allMembers = [];

      setLoadingMessage('Loading members...');
      setLoadingProgress(60);

      // 2. Get all members from selected/all branches
      console.log(`📊 Loading members from ${branches.length} branch(es):`, branches.map(b => `${b.branchCode}-${b.name}`));
      for (const branch of branches) {
        console.log(`👥 Fetching members for branch ${branch.branchCode} (${branch.name})...`);
        const membersResponse = await membersAPI.getAll({
          branchCode: branch.branchCode,
          limit: 1000, // Get all members
        });

        console.log(`📊 Members API response for ${branch.branchCode}:`, {
          success: membersResponse.success,
          count: membersResponse.data?.length || 0,
          sample: membersResponse.data?.slice(0, 2).map(m => ({ name: m.name, branchCode: m.branchCode }))
        });

        if (membersResponse.success && membersResponse.data) {
          // Add branch information to each member for context
          const membersWithBranch = membersResponse.data.map(member => ({
            ...member,
            branchName: branch.name,
            branchCode: branch.branchCode
          }));
          allMembers.push(...membersWithBranch);
          console.log(`✅ Added ${membersWithBranch.length} members from branch ${branch.branchCode}`);
        } else {
          console.log(`❌ No members found for branch ${branch.branchCode}`);
        }
      }

      console.log(`📈 Total members loaded: ${allMembers.length}`);

      if (allMembers.length === 0) {
        console.log('⚠️ WARNING: No members found! Check if:');
        console.log('1. Members exist in database for branch code:', branches.map(b => b.branchCode));
        console.log('2. Member branchCode field matches branch branchCode');
        console.log('3. Members are active (isActive: true)');
      }

      setLoadingMessage('Loading real database information...');
      setLoadingProgress(70);

      // 3. Get enhanced member data with real database information (optimized batches)
      const enhancedMembers = [];
      const batchSize = 5; // Process 5 members at a time for better performance
      const maxMembers = Math.min(allMembers.length, 50); // Process up to 50 members for balance of speed vs completeness

      for (let i = 0; i < maxMembers; i += batchSize) {
        const batch = allMembers.slice(i, i + batchSize);
        setLoadingMessage(`Loading member details (${i + batch.length}/${maxMembers})...`);
        setLoadingProgress(70 + (i / maxMembers) * 25);

        const batchResults = await Promise.all(
          batch.map(async (member, index) => {
            try {
              // Get detailed member information
              const memberDetailsResponse = await membersAPI.getById(member._id);
              let enhancedMember = { ...member };

              if (memberDetailsResponse.success && memberDetailsResponse.data) {
                const fullMemberData = memberDetailsResponse.data;
                // Fix: Don't use totalSavings from database as it contains product amounts
                // Calculate actual savings from savings-specific fields or set to 0
                const actualSavings = Number(fullMemberData.currentSavings || fullMemberData.savingsBalance || 0);

                enhancedMember = {
                  ...member,
                  // Update with more detailed information from database
                  name: fullMemberData.name || member.name || 'Unknown Member',
                  sponsorName: fullMemberData.sponsorName || fullMemberData.sponsor || fullMemberData.sponser || member.sponsorName || 'N/A',
                  address: fullMemberData.address || fullMemberData.village || fullMemberData.location || fullMemberData.area || member.address || 'N/A',
                  totalSavings: actualSavings,
                  phone: fullMemberData.phone || fullMemberData.mobile || fullMemberData.phoneNumber || member.phone || 'N/A',
                  memberCode: fullMemberData.memberCode || fullMemberData.code || member.memberCode || `${String(i + index + 1).padStart(3, '0')}`,
                  // Additional fields that might be available
                  nidNumber: fullMemberData.nidNumber || fullMemberData.nid || member.nidNumber || 'N/A',
                  joinDate: fullMemberData.joinDate || fullMemberData.createdAt || member.joinDate || 'N/A',
                  branch: fullMemberData.branch || member.branchName || 'N/A',
                  branchCode: fullMemberData.branchCode || member.branchCode || 'N/A'
                };
              }

              // Get installment history for product sales - use getMemberHistory for complete data
              const installmentHistory = await installmentsAPI.getMemberHistory(member._id, 100); // Get more records
              let installmentData = [];

              if (installmentHistory.success) {
                // Handle different response formats
                if (Array.isArray(installmentHistory.data)) {
                  installmentData = installmentHistory.data;
                } else if (installmentHistory.data && Array.isArray(installmentHistory.data.history)) {
                  installmentData = installmentHistory.data.history;
                } else if (installmentHistory.data && Array.isArray(installmentHistory.data.installments)) {
                  installmentData = installmentHistory.data.installments;
                } else if (installmentHistory.data && Array.isArray(installmentHistory.data.data)) {
                  installmentData = installmentHistory.data.data;
                }

                if (installmentData.length > 0) {
                  const productInstallments = processInstallmentHistory(installmentData);
                  enhancedMember.productInstallments = productInstallments;

                  // Store all installment records for date-wise collection display
                  enhancedMember.allInstallmentRecords = installmentData;

                  // Calculate total collected amount (loan installments only) - ONLY COLLECTED STATUS
                  // DEFINITIVE FIX: A record is a loan collection if its type is 'regular' and it has been 'collected' or 'partial'.
                  // This is much more reliable than parsing the 'note' field.
                  const loanCollections = installmentData.filter(record =>
                    record.installmentType === 'regular' &&
                    (record.status === 'collected' || record.status === 'partial')
                  );

                  const totalLoanCollected = productInstallments.reduce((sum, product) => {
                    return sum + (product.paidAmount || 0);
                  }, 0);

                  const savingsCollections = installmentData.filter(record =>
                    record.installmentType === 'extra' &&
                    record.note &&
                    record.note.includes('Savings Collection')
                  );

                  const totalSavingsCollected = savingsCollections.reduce((sum, record) => sum + (record.amount || 0), 0);

                  // Debug disabled for performance

                  enhancedMember.totalCollectedAmount = totalLoanCollected;
                  // CRITICAL FIX: Use ONLY backend totalSavings (which already includes all savings calculations)
                  // Backend totalSavings = initial savings + all savings collections - withdrawals
                  // DO NOT add savings collections again here to avoid double counting!
                  const backendTotalSavings = Number(enhancedMember.totalSavings || member.totalSavings || member.savings || 0);
                  console.log(`💰 [${member.name}] Backend Total Savings: ${backendTotalSavings} (already includes initial + collections - withdrawals)`);
                  enhancedMember.totalSavings = backendTotalSavings; // Use backend value directly
                } else {
                  // ✅ FIX: Even without installment records, keep initial savings
                  const initialSavings = Number(member.totalSavings || member.savings || 0);
                  console.log(`💰 [${member.name}] No installments yet, but has initial savings: ${initialSavings}`);
                  enhancedMember.productInstallments = [];
                  enhancedMember.allInstallmentRecords = [];
                  enhancedMember.totalCollectedAmount = 0;
                  enhancedMember.totalSavings = initialSavings; // Keep initial savings!
                }
              } else {
                // ✅ FIX: Even without product sales, keep initial savings
                const initialSavings = Number(member.totalSavings || member.savings || 0);
                console.log(`💰 [${member.name}] No product sales, but has initial savings: ${initialSavings}`);
                enhancedMember.productInstallments = [];
                enhancedMember.allInstallmentRecords = [];
                enhancedMember.totalCollectedAmount = 0;
                enhancedMember.totalSavings = initialSavings; // Keep initial savings!
              }

              return enhancedMember;
            } catch (error) {
              // Return basic member data if enhancement fails
              return {
                ...member,
                productInstallments: [],
                allInstallmentRecords: [],
                memberCode: member.memberCode || `${String(i + index + 1).padStart(3, '0')}`,
                sponsorName: member.sponsorName || member.sponsor || 'N/A',
                address: member.address || member.village || 'N/A',
                phone: member.phone || member.mobile || 'N/A',
                totalSavings: Number(member.totalSavings || member.savings || 0),
                totalCollectedAmount: 0
              };
            }
          })
        );

        enhancedMembers.push(...batchResults);

        // Small delay between batches to prevent server overload
        if (i + batchSize < maxMembers) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Add remaining members with basic data if we have more than maxMembers
      if (allMembers.length > maxMembers) {
        const remainingMembers = allMembers.slice(maxMembers).map((member, index) => ({
          ...member,
          productInstallments: [],
          allInstallmentRecords: [],
          memberCode: member.memberCode || `${String(maxMembers + index + 1).padStart(3, '0')}`,
          sponsorName: member.sponsorName || member.sponsor || 'N/A',
          address: member.address || member.village || 'N/A',
          phone: member.phone || member.mobile || 'N/A',
          totalSavings: Number(member.totalSavings || member.savings || 0),
          totalCollectedAmount: 0
        }));
        enhancedMembers.push(...remainingMembers);
      }

      setLoadingMessage('Collection sheet ready!');
      setLoadingProgress(100);

      setMembers(enhancedMembers);
      setDataLoaded(true);

    } catch (error) {
      toast.error('Failed to load collection sheet data.');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const processInstallmentHistory = (installments) => {
    const productSales = {};
    const saleTransactions = {}; // Group products by sale transaction ID
    let dofaCounter = 1;

    // Sort installments by creation date to process sales in order
    const sortedInstallments = [...installments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    for (const installment of sortedInstallments) {
      // ✅ CRITICAL FIX: Exclude savings collection installments from product sales
      // Savings collection notes contain "Savings Collection - Product Sale:" but are NOT product sales
      if (installment.installmentType === 'extra' &&
        installment.note?.includes('Product Sale:') &&
        !installment.note?.includes('Savings Collection')) {
        // Extract sale transaction ID from note
        const saleIdMatch = installment.note.match(/SaleID: (SALE-\d+)/);
        const saleTransactionId = saleIdMatch ? saleIdMatch[1] : `LEGACY-${installment._id}`;

        // Initialize sale transaction group if not exists
        if (!saleTransactions[saleTransactionId]) {
          saleTransactions[saleTransactionId] = {
            products: [],
            createdAt: installment.createdAt,
            saleId: saleTransactionId
          };
        }

        const productMatch = installment.note.match(/Product Sale: (.+?)(?:\s*\||\s*$)/);
        if (!productMatch) continue;

        const productName = productMatch[1].trim();

        // Extract individual product details
        const qtyMatch = installment.note.match(/Qty: (.+?)(?:\s*\||\s*,|\s*\))/);
        const paymentMatch = installment.note.match(/Payment: (.+?)(?:\s*\||\s*$)/);
        // Extract installment count from note - handle both formats:
        // "8 installments" or "(8 installments of ৳210 each)"
        const installmentMatch = installment.note.match(/\(?(\d+)\s+installments/i);
        const totalInstallments = installmentMatch ? parseInt(installmentMatch[1], 10) : 16;

        // 🆕 Extract installment frequency (daily/weekly/monthly) from note
        const frequencyMatch = installment.note.match(/(daily|weekly|monthly)/i);
        const installmentFrequency = frequencyMatch ? frequencyMatch[1].toLowerCase() : 'weekly'; // Default to weekly

        // Create product entry
        const productEntry = {
          productName,
          quantity: qtyMatch ? qtyMatch[1].trim() : '1',
          paymentType: paymentMatch ? paymentMatch[1].trim() : 'installment',
          totalAmount: installment.amount,
          totalInstallments,
          installmentFrequency, // 🆕 Store weekly/monthly
          deliveryDate: installment.collectionDate || installment.createdAt,
          dofaNo: 0, // Will be assigned later based on sale transaction order
          saleId: installment._id,
          saleTransactionId: saleTransactionId,
          // ✅ FIX: Don't use installment._id as fallback - it causes wrong payment matching
          // If backend doesn't provide distributionId, we'll rely on product name matching
          distributionId: installment.distributionId || null,
          paidAmount: 0, // Will be calculated later
          paidDates: [],
          note: installment.note,
          source: 'PRODUCT_SALE'
        };

        saleTransactions[saleTransactionId].products.push(productEntry);
      }
    }

    // Convert sale transactions to individual product entries with proper Dofa numbering
    const allProducts = [];
    const sortedTransactions = Object.values(saleTransactions).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    for (const transaction of sortedTransactions) {
      // Sort products within transaction by creation order
      const sortedProducts = transaction.products.sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));

      for (const product of sortedProducts) {
        product.dofaNo = dofaCounter++;
        allProducts.push(product);

        // Add to productSales with unique identifier
        const saleIdentifier = `${product.saleTransactionId}-${product.productName}-${product.saleId}`;
        productSales[saleIdentifier] = product;
      }
    }

    for (const key in productSales) {
      const sale = productSales[key];
      const saleDate = new Date(sale.deliveryDate);

      // Debug disabled for performance

      // Debug: Log product sale info
      console.log(`🔍 Finding payments for: ${sale.productName} (Sale ID: ${sale.saleId}, Dist ID: ${sale.distributionId})`);

      // Find installment payments for this product - enhanced detection
      const payments = sortedInstallments.filter(inst => {
        // Check if this is after the sale date
        if (new Date(inst.createdAt) < saleDate) return false;

        // Must be a payment (not a sale)
        if (inst.installmentType === 'extra' && inst.note?.includes('Product Sale:')) return false;

        // ✅ CRITICAL FIX: Include both COLLECTED and PARTIAL payments
        // For partial: we'll use paidAmount field (auto-paid portion only)
        if (inst.status !== 'collected' && inst.status !== 'partial') return false;

        // Enhanced payment detection - check multiple patterns
        const noteText = inst.note?.toLowerCase() || '';
        const productNameLower = (sale.productName || '').toLowerCase().split('(')[0].trim();

        let isPaymentForThisProduct = false;
        let matchReason = '';

        // Primary match: distributionId (most reliable)
        if (inst.distributionId && sale.distributionId && inst.distributionId === sale.distributionId) {
          isPaymentForThisProduct = true;
          matchReason = 'distributionId exact match';
          console.log(`   ✅ Payment matched by distributionId: ${inst.distributionId}`);
        }
        // Secondary match: saleId exact match
        else if (inst.saleId && sale.saleId && inst.saleId === sale.saleId) {
          isPaymentForThisProduct = true;
          matchReason = 'saleId exact match';
          console.log(`   ✅ Payment matched by saleId: ${inst.saleId}`);
        }
        // Tertiary match: Check if distributionId contains saleId or vice versa
        else if (inst.distributionId && sale.saleId &&
          (inst.distributionId.includes(sale.saleId) || sale.saleId.includes(inst.distributionId))) {
          isPaymentForThisProduct = true;
          matchReason = 'distributionId contains saleId';
          console.log(`   ✅ Payment matched by distributionId contains: ${inst.distributionId} <-> ${sale.saleId}`);
        }
        // Fallback: Match by product name in the note field for older data
        // ⚠️ WARNING: This can cause cross-product contamination if names are similar!
        else if (productNameLower && noteText.includes(productNameLower)) {
          isPaymentForThisProduct = true;
          matchReason = `product name match (${productNameLower})`;
          console.log(`   ⚠️ Payment matched by product name: "${productNameLower}" in note`);
        }

        if (isPaymentForThisProduct) {
          console.log(`      📝 Payment: ৳${inst.amount}, Status: ${inst.status}, DistID: ${inst.distributionId}, Reason: ${matchReason}`);
        }

        return isPaymentForThisProduct;
      });

      // Debug: Log found payments
      console.log(`💰 Found ${payments.length} payments for ${sale.productName}`);
      if (payments.length > 0) {
        console.log('Payment details:', payments.map(p => ({
          note: p.note,
          amount: p.amount,
          status: p.status,
          type: p.installmentType,
          distId: p.distributionId
        })));
      }

      let totalPaid = 0;
      const paidDates = [];

      payments.forEach(payment => {
        // ✅ CRITICAL FIX: For partial payments, use paidAmount (auto-paid portion)
        // For collected payments, use full amount
        let amount = 0;

        if (payment.status === 'partial') {
          // For partial: use paidAmount field (auto-paid portion only)
          amount = payment.paidAmount || 0;
          console.log(`   🔶 Partial payment: ৳${payment.amount} total, ৳${amount} already paid (auto)`);
        } else if (payment.status === 'collected') {
          // For collected: use full amount
          // Try Pattern 1: "Collected: ৳amount" from note
          const collectedMatch = payment.note?.match(/Collected: ৳(\d+(?:\.\d+)?)/);
          if (collectedMatch) {
            amount = parseFloat(collectedMatch[1]);
          }
          // Pattern 2: Direct payment amount from record
          else if (payment.amount && payment.amount > 0) {
            amount = payment.amount;
          }
          console.log(`   ✅ Collected payment: ৳${amount}`);
        }

        if (amount > 0) {
          totalPaid += amount;

          // Add to paidDates for Collection Sheet tracking
          paidDates.push({
            date: payment.createdAt,
            amount: amount,
            type: 'loan', // This is installment payment (loan repayment)
            note: payment.note
          });
        }
      });

      // ✅ CRITICAL FIX: Ensure paidAmount never exceeds totalAmount
      // This prevents over-collection errors
      const cappedPaidAmount = Math.min(totalPaid, sale.totalAmount);

      if (totalPaid > sale.totalAmount) {
        console.warn(`⚠️ Over-collection detected for ${sale.productName}:`);
        console.warn(`   Total Amount: ৳${sale.totalAmount}`);
        console.warn(`   Collected Amount: ৳${totalPaid}`);
        console.warn(`   Over-payment: ৳${totalPaid - sale.totalAmount}`);
        console.warn(`   ✅ Capping at total amount: ৳${cappedPaidAmount}`);
      }

      sale.paidAmount = cappedPaidAmount;
      sale.pendingAmount = Math.max(0, sale.totalAmount - cappedPaidAmount);
      sale.paidDates = paidDates;
      // Calculate installment count - count unique payment dates (one installment per collection date)
      const uniquePaymentDates = new Set();
      payments.forEach(payment => {
        const paymentDate = new Date(payment.collectionDate || payment.createdAt);
        const dateStr = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(paymentDate.getDate()).padStart(2, '0')}`;
        uniquePaymentDates.add(dateStr);
      });
      sale.installmentCount = uniquePaymentDates.size;

      // Debug disabled for performance
    }

    return Object.values(productSales);
  };

  // Function to get collection amounts for a specific date and installment amount
  const getCollectionForDateAndAmount = (member, targetDate, installmentAmount) => {
    try {
      // Ensure targetDate is a Date object
      const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return { loanAmount: 0, savingsInAmount: 0, savingsOutAmount: 0 };
      }

      // Fix timezone issue - use local date instead of UTC
      const targetDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      // Get all installment records for this member
      const allRecords = member.allInstallmentRecords || [];

      // Calculate amounts for different types
      let loanAmount = 0;           // Product installment payments
      let savingsInAmount = 0;      // Member deposits savings  
      let savingsOutAmount = 0;     // Always 0 - functionality removed

      // Process all records to find matches for this date and amount
      const processedRecordIds = new Set();

      allRecords.forEach(record => {
        if (!record) return;

        // Skip if already processed (prevent duplicates)
        const recordId = record._id || record.id || `${record.amount}-${record.note}-${record.createdAt}`;
        if (processedRecordIds.has(recordId)) {
          return;
        }
        processedRecordIds.add(recordId);

        // Get record date in multiple formats
        let recordDateStr = null;
        const recordDate = record.collectionDate || record.date || record.createdAt;

        if (recordDate) {
          try {
            // Try different date parsing approaches
            const parsedDate = new Date(recordDate);
            if (!isNaN(parsedDate.getTime())) {
              recordDateStr = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
            }
          } catch (e) {
            // Skip invalid dates
            return;
          }
        }

        // Enhanced date matching - try multiple date formats and ranges
        const isDateMatch = recordDateStr === targetDateStr ||
          // Also try to match if within same day but different time
          (recordDate && Math.abs(new Date(recordDate) - dateObj) < 24 * 60 * 60 * 1000);

        if (isDateMatch) {
          const amount = record.amount || 0;
          const note = record.note || '';
          const type = record.installmentType || '';

          // Enhanced Loan installment collections detection - ONLY COLLECTED OR PARTIAL STATUS AND MATCHING AMOUNT
          if (type === 'regular' && (record.status === 'collected' || record.status === 'partial') && note && (
            note.includes('Product Loan') ||
            note.includes('Installment') ||
            note.includes('Full payment') ||
            note.includes('Partial payment') ||
            note.includes('Full Payment') ||
            note.includes('Partial Payment')
          )) {
            // Only include if the amount matches the installment amount (within tolerance)
            const tolerance = Math.max(installmentAmount * 0.3, 50); // Increased to 30% tolerance or minimum ৳50
            const amountDifference = Math.abs(amount - installmentAmount);

            if (amountDifference <= tolerance) {
              loanAmount += amount;
            }
          }
          // Enhanced Savings collections detection - be more specific to avoid loan confusion
          else if (type === 'extra' && note && (
            note.includes('Savings Collection') ||
            note.includes('\u09b8\u099e\u09cd\u099a\u09af\u09bc') ||
            (note.toLowerCase().includes('savings') && !note.includes('Product') && !note.includes('Loan') && !note.includes('Withdrawal'))
          )) {
            savingsInAmount += amount;
          }
          // Savings Out - Only for Savings Withdrawal transactions
          else if (type === 'extra' && note && note.includes('Savings Withdrawal')) {
            savingsOutAmount += amount;
            console.log(`\u2705 [Sav Out] Savings withdrawal found: \u09f3${amount} for ${member.name} on ${targetDateStr}`);
          }
        }
      });

      return { loanAmount, savingsInAmount, savingsOutAmount };
    } catch (error) {
      console.error(`âŒ Error in getCollectionForDateAndAmount for ${member.name}:`, error);
      return { loanAmount: 0, savingsInAmount: 0, savingsOutAmount: 0 };
    }
  };

  // Track collections that have been matched to prevent double-counting across rows
  const matchedCollections = React.useRef(new Set());

  // Function to get product-specific collection amounts
  const getProductSpecificCollection = (member, targetDate, consolidatedProductData, products, isFirstTransaction = false) => {
    try {
      // Ensure targetDate is a Date object
      const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return { loanAmount: 0, savingsInAmount: 0, savingsOutAmount: 0 };
      }

      // Fix timezone issue - use local date instead of UTC
      const targetDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      // Get all installment records for this member
      const allRecords = member.allInstallmentRecords || [];

      // CRITICAL: Get all distributionIds for products in this row
      // Each product may have a distributionId field that links it to specific installments
      const distributionIds = products
        .map(p => p.distributionId || p.saleId || p._id)
        .filter(Boolean);

      console.log(`ðŸ” [getProductSpecificCollection] Checking ${member.name} for date ${targetDateStr}`);
      console.log(`   ðŸ“Š Total records: ${allRecords.length}`);
      console.log(`   ðŸ†” Distribution IDs for this row (${distributionIds.length}):`, distributionIds);
      console.log(`   ðŸ“‘ Products in row:`, products.map(p => ({ saleId: p.saleId, distributionId: p.distributionId, name: p.productName })));

      // Special debug for Mehenaj
      if (member.name === 'Mehenaj') {
        console.log(`ðŸ”´ MEHENAJ DEBUG - Checking row for date ${targetDateStr}`);
        console.log(`   ðŸ“‘ Products in this row:`, products);
        console.log(`   ðŸ†” Distribution IDs:`, distributionIds);
        console.log(`   ðŸ“Š All collected/partial loan records:`, allRecords.filter(r =>
          (r.status === 'collected' || r.status === 'partial') &&
          r.installmentType === 'regular' &&
          r.note?.includes('Product Loan')
        ).map(r => ({
          amount: r.amount,
          dueDate: r.dueDate,
          distributionId: r.distributionId,
          note: r.note?.substring(0, 100),
          status: r.status
        })));
      }

      // Debug: Show first 3 records to understand structure
      if (allRecords.length > 0) {
        console.log(`   ðŸ” Sample records:`, allRecords.slice(0, 3).map(r => ({
          type: r.installmentType,
          distributionId: r.distributionId,
          dueDate: r.dueDate,
          collectionDate: r.collectionDate,
          amount: r.amount,
          note: r.note?.substring(0, 50)
        })));
      }

      // Calculate amounts for different types
      let loanAmount = 0;           // Product installment payments
      let savingsInAmount = 0;      // Member deposits savings  
      let savingsOutAmount = 0;     // Always 0 - functionality removed

      // Process all records to find matches for this date and product
      const processedRecordIds = new Set();

      allRecords.forEach(record => {
        if (!record) return;

        // Skip if already processed (prevent duplicates)
        const recordId = record._id || record.id || `${record.amount}-${record.note}-${record.createdAt}`;
        if (processedRecordIds.has(recordId)) {
          return;
        }
        processedRecordIds.add(recordId);

        // Create a unique key for this collection to track cross-row matching
        const collectionKey = `${member._id || member.id}-${targetDateStr}-${recordId}`;

        // Get record details first to determine which date to use
        // CRITICAL: For partial payments, use paidAmount instead of amount
        const amount = (record.paidAmount !== undefined && record.paidAmount > 0)
          ? record.paidAmount
          : (record.amount || 0);
        const note = record.note || '';
        const type = record.installmentType || '';

        // CRITICAL FIX: Use DIFFERENT date matching logic for different transaction types
        // - For LOAN installments: Use DUE DATE (shows when installment was scheduled)
        // - For SAVINGS collections: Use COLLECTION DATE (shows when savings was actually collected)
        // - For AUTO DEDUCTIONS: Use COLLECTION DATE (shows when deduction was processed)
        let recordDateStr = null;
        let recordDate = null;

        // Check if this is a savings collection or deduction
        const isSavingsCollection = type === 'extra' && note && (
          note.includes('Savings Collection') ||
          note.includes('সঞ্চয়') ||
          (note.toLowerCase().includes('savings') && !note.includes('Product') && !note.includes('Loan'))
        );

        const isAutoDeduction = record.paymentMethod === 'savings_deduction' || note.includes('deducted from savings');

        // CRITICAL FIX: Use appropriate date based on transaction type
        if (isAutoDeduction) {
          // For auto deductions: Always use COLLECTION DATE (when deduction was processed)
          recordDate = record.collectionDate || record.date || record.createdAt;
        } else if (record.status === 'collected' || record.status === 'partial') {
          // For collected/partial installments: Use COLLECTION DATE (when it was actually collected)
          recordDate = record.collectionDate || record.date || record.createdAt;
        } else {
          // For pending installments: Use DUE DATE (scheduled installment date)
          recordDate = record.dueDate || record.installmentDate || record.collectionDate || record.date || record.createdAt;
        }

        if (recordDate) {
          try {
            const parsedDate = new Date(recordDate);
            if (!isNaN(parsedDate.getTime())) {
              recordDateStr = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;

              // Debug: Log each record's date and type
              if (record.installmentType === 'regular' && record.note?.includes('Product Loan')) {
                console.log(`  ðŸ“ Loan Record: Due=${recordDateStr}, Type=${record.installmentType}, Status=${record.status}, Amount=à§³${record.amount}, CollectionDate=${record.collectionDate ? new Date(record.collectionDate).toISOString().split('T')[0] : 'N/A'}, DistID=${record.distributionId || 'N/A'}`);
              } else if (isSavingsCollection) {
                console.log(`  ðŸ’° [getProductSpecificCollection] Savings Record Found:`, {
                  memberName: member.name,
                  amount: amount,
                  collectionDate: recordDateStr,
                  targetDate: targetDateStr,
                  matches: recordDateStr === targetDateStr,
                  note: note.substring(0, 50)
                });
              }
            }
          } catch (e) {
            return;
          }
        }

        // Match by the appropriate date
        // CRITICAL FIX: Use FLEXIBLE RANGE matching instead of exact date
        // Collection Sheet columns represent collection periods
        // Allow collections within Â±3 days of the column date to appear

        let isDateMatch = false;

        if (recordDateStr) {
          const recordDateObj = new Date(recordDate);
          recordDateObj.setHours(12, 0, 0, 0); // Noon to avoid timezone issues

          const targetDateObj = new Date(targetDateStr);
          targetDateObj.setHours(12, 0, 0, 0);

          // Calculate date range: Â±3 days from target date
          const rangeStart = new Date(targetDateObj);
          rangeStart.setDate(targetDateObj.getDate() - 3);

          const rangeEnd = new Date(targetDateObj);
          rangeEnd.setDate(targetDateObj.getDate() + 3);

          // Check if record date falls within this range
          isDateMatch = recordDateObj >= rangeStart && recordDateObj <= rangeEnd;

          // Debug range matching for collected installments
          if (isDateMatch && type === 'regular' && record.status === 'collected') {
            const daysDiff = Math.round((recordDateObj - targetDateObj) / (1000 * 60 * 60 * 24));
            console.log(`  âœ… DATE MATCH: Record ${recordDateStr} matches column ${targetDateStr} (${daysDiff} days diff, range Â±3 days)`);
          }
        }

        if (isDateMatch) {
          // Enhanced Loan installment collections detection with distributionId filtering
          // MODIFIED: Show both COLLECTED/PARTIAL and PENDING installments
          if (type === 'regular' && note && (
            note.includes('Product Loan') ||
            note.includes('Installment') ||
            note.includes('Full payment') ||
            note.includes('Partial payment') ||
            note.includes('Full Payment') ||
            note.includes('Partial Payment')
          )) {
            // CRITICAL FIX: Filter by distributionId to prevent cross-contamination between product rows
            const recordDistributionId = record.distributionId;

            // Debug logging for loan collection detection - SIMPLIFIED FORMAT
            console.log(`ðŸ” LOAN COLLECTION: ${member.name} | Date: ${targetDateStr} | Amount: à§³${amount} | Status: ${record.status}`);
            console.log(`   ðŸ†” Record DistID: ${recordDistributionId || 'NONE'}`);
            console.log(`   ðŸ†” Row DistIDs: ${JSON.stringify(distributionIds)}`);
            console.log(`   ðŸ“ Note: "${note.substring(0, 80)}"`);
            console.log(`   ðŸ“‘ Products: ${products.map(p => p.productName).join(', ')}`);

            // Log collection date info
            const recCollDate = record.collectionDate ? new Date(record.collectionDate).toISOString().split('T')[0] : 'N/A';
            const recDueDate = record.dueDate ? new Date(record.dueDate).toISOString().split('T')[0] : 'N/A';
            console.log(`   ðŸ“… CollectionDate: ${recCollDate} | DueDate: ${recDueDate}`);
            console.log(`   ðŸ” Using date for matching: ${recordDateStr}`);
            console.log(`   ðŸ’° PAYMENT AMOUNT: record.amount=à§³${record.amount}, record.paidAmount=à§³${record.paidAmount || 'N/A'}, using amount=à§³${amount}`);

            // Check if this collection belongs to any of the distributions in this row
            let belongsToThisRow = false;

            // PRIMARY FILTER: Check if record has distributionId and it matches this row
            if (recordDistributionId && distributionIds.includes(recordDistributionId)) {
              belongsToThisRow = true;
              console.log(`   âœ… Distribution ID match found: ${recordDistributionId}`);
            } else if (recordDistributionId) {
              // Check if the distributionId contains any of the product saleIds (for backward compatibility)
              // Backend creates distributionIds like: DIST-{saleId}-{serialNumber}
              // Extract the saleId from the distributionId for matching
              let extractedSaleId = null;
              if (recordDistributionId.startsWith('DIST-')) {
                // Extract saleId from DIST-{saleId}-{serial} format
                const parts = recordDistributionId.split('-');
                if (parts.length >= 2) {
                  extractedSaleId = parts[1]; // Get the saleId part
                }
              }

              console.log(`   ðŸ” Extracted Sale ID from ${recordDistributionId}: ${extractedSaleId}`);

              const matchesSaleId = distributionIds.some(id => {
                // Check direct match
                if (id === recordDistributionId) {
                  console.log(`   âœ… Direct match: ${id} === ${recordDistributionId}`);
                  return true;
                }

                // Check if extracted saleId matches any distribution ID
                if (extractedSaleId && id === extractedSaleId) {
                  console.log(`   âœ… Extracted saleId match: ${id} === ${extractedSaleId}`);
                  return true;
                }

                // Check if recordDistributionId contains this saleId (for DIST-{saleId}-{serial} format)
                if (recordDistributionId.includes(id)) {
                  console.log(`   âœ… Contains match: ${recordDistributionId} contains ${id}`);
                  return true;
                }

                // Check reverse: if this id contains the recordDistributionId
                if (id.includes(recordDistributionId)) {
                  console.log(`   âœ… Reverse contains match: ${id} contains ${recordDistributionId}`);
                  return true;
                }

                // Check if this id contains the extracted saleId
                if (extractedSaleId && id.includes(extractedSaleId)) {
                  console.log(`   âœ… ID contains extracted saleId: ${id} contains ${extractedSaleId}`);
                  return true;
                }

                return false;
              });

              if (matchesSaleId) {
                belongsToThisRow = true;
                console.log(`   âœ… Distribution ID partial match found: ${recordDistributionId} matches saleId in`, distributionIds);
              } else {
                // Record has distributionId but doesn't match this row
                console.log(`   âŒ Distribution ID mismatch: ${recordDistributionId} not in`, distributionIds);

                // CRITICAL FALLBACK: If member has multiple product rows, try to match by product name in note
                // This handles cases where backend uses different distribution IDs than expected
                console.log(`   ðŸ”„ Attempting product name fallback for distribution ID mismatch...`);

                // Extract just the product name (before any parentheses or special chars)
                const productNamesInNote = products.map(p => {
                  const name = p.productName || p.name || '';
                  // Extract name before parentheses: "cal (Qty: 28)" -> "cal"
                  const cleanName = name.split('(')[0].trim().toLowerCase();
                  return cleanName;
                }).filter(n => n.length > 0);

                const noteText = note.toLowerCase();

                console.log(`   ðŸ” Product names (lowercase):`, productNamesInNote);
                console.log(`   ðŸ” Note text (lowercase): "${noteText}"`);

                let foundProductMatch = false;
                for (const productName of productNamesInNote) {
                  console.log(`   ðŸ” Checking product: "${productName}"`);

                  // Check for product name or major keywords from product name
                  const productKeywords = productName.split(' ').filter(w => w.length > 3);
                  console.log(`   ðŸ” Keywords (>3 chars): ${JSON.stringify(productKeywords)}`);

                  if (noteText.includes(productName)) {
                    console.log(`   âœ… Product name found in note: "${productName}"`);
                    foundProductMatch = true;
                    break;
                  } else {
                    console.log(`   âŒ Product name NOT in note: "${productName}"`);
                  }

                  for (const keyword of productKeywords) {
                    if (noteText.includes(keyword)) {
                      console.log(`   âœ… Product keyword found in note: "${keyword}" (from "${productName}")`);
                      foundProductMatch = true;
                      break;
                    }
                  }

                  if (foundProductMatch) break;
                }

                if (foundProductMatch) {
                  belongsToThisRow = true;
                  console.log(`   âœ… Product name fallback successful - accepting collection`);
                } else {
                  // Still no match - reject this collection for this row
                  belongsToThisRow = false;
                }
              }
            } else {
              // FALLBACK: For old records without distributionId, use product name matching
              console.log(`   âš ï¸ No distributionId in record, falling back to product name matching`);
              const productNames = consolidatedProductData.productNames.toLowerCase();
              const noteText = note.toLowerCase();

              // Split product names and check each one
              const productNamesArray = consolidatedProductData.productNames.split(',').map(name => name.trim().toLowerCase());
              console.log(`   ðŸ” Checking product names:`, productNamesArray);

              for (const productName of productNamesArray) {
                if (noteText.includes(productName)) {
                  belongsToThisRow = true;
                  console.log(`   âœ… Product name match found: "${productName}" in note`);
                  break;
                }
              }

              // Additional flexible matching for common product variations
              if (!belongsToThisRow && noteText.includes('product loan')) {
                for (const productName of productNamesArray) {
                  const productWords = productName.split(' ').filter(word => word.length > 2);
                  for (const word of productWords) {
                    if (noteText.includes(word)) {
                      belongsToThisRow = true;
                      console.log(`   âœ… Product word match found: "${word}"`);
                      break;
                    }
                  }
                  if (belongsToThisRow) break;
                }
              }

              // Amount-based matching as last resort - Enhanced for better matching
              if (!belongsToThisRow && consolidatedProductData.totalInstallments > 0) {
                const expectedInstallmentAmount = Math.round(consolidatedProductData.totalAmount / consolidatedProductData.totalInstallments);
                const tolerance = Math.max(expectedInstallmentAmount * 0.5, 200); // Increased tolerance to 50% or à§³200
                const amountDifference = Math.abs(amount - expectedInstallmentAmount);

                console.log(`ðŸ’° Enhanced Amount-based matching:`);
                console.log(`   ðŸ“Š Collection Amount: à§³${amount}`);
                console.log(`   ðŸŽ¯ Expected Amount: à§³${expectedInstallmentAmount}`);
                console.log(`   ðŸ“ Tolerance: Â±à§³${tolerance}`);
                console.log(`   ðŸ“ Difference: à§³${amountDifference}`);
                console.log(`   âœ… Within Tolerance: ${amountDifference <= tolerance}`);

                if (amountDifference <= tolerance) {
                  belongsToThisRow = true;
                  console.log(`   âœ… Enhanced amount-based match found: à§³${amount} â‰ˆ à§³${expectedInstallmentAmount}`);
                } else {
                  // Try matching with other possible installment amounts in this row
                  const alternativeAmounts = products.map(p => {
                    if (p.totalAmount && p.totalInstallments) {
                      return Math.round(p.totalAmount / p.totalInstallments);
                    }
                    return null;
                  }).filter(Boolean);

                  console.log(`   ðŸ” Trying alternative amounts:`, alternativeAmounts);

                  for (const altAmount of alternativeAmounts) {
                    const altDifference = Math.abs(amount - altAmount);
                    const altTolerance = Math.max(altAmount * 0.5, 200);
                    console.log(`     - à§³${altAmount}: diff=à§³${altDifference}, tolerance=à§³${altTolerance}`);

                    if (altDifference <= altTolerance) {
                      belongsToThisRow = true;
                      console.log(`   âœ… Alternative amount match found: à§³${amount} â‰ˆ à§³${altAmount}`);
                      break;
                    }
                  }

                  // Ultra-fallback: If this is a typical loan installment amount and no other row has claimed it
                  // This helps catch cases where collections belong to different sales not shown in current rows
                  if (!belongsToThisRow && amount >= 50 && amount <= 5000 && note.includes('Product Loan')) {
                    // Check if this collection might reasonably belong to this member
                    // Apply more generous matching when distribution IDs don't match visible sales
                    const memberHasAnyProducts = products && products.length > 0 && products.some(p => p.totalAmount && p.totalAmount > 0);

                    if (memberHasAnyProducts) {
                      // Additional check: if this looks like a reasonable installment amount for this member's loans
                      const memberTotalLoanAmounts = products.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
                      const estimatedInstallmentRange = {
                        min: Math.floor(memberTotalLoanAmounts / 50), // Very conservative minimum
                        max: Math.ceil(memberTotalLoanAmounts / 5)    // Very liberal maximum
                      };

                      if (amount >= estimatedInstallmentRange.min && amount <= estimatedInstallmentRange.max) {
                        console.log(`   âš ï¸ Ultra-fallback matching applied for orphaned loan collection`);
                        console.log(`   ðŸ”„ Member has product loans (total: à§³${memberTotalLoanAmounts}), estimated installment range: à§³${estimatedInstallmentRange.min}-à§³${estimatedInstallmentRange.max}`);
                        console.log(`   âœ… Collection amount à§³${amount} falls within estimated range, accepting as match`);
                        belongsToThisRow = true;
                      } else {
                        console.log(`   âŒ Ultra-fallback rejected: à§³${amount} outside estimated range à§³${estimatedInstallmentRange.min}-à§³${estimatedInstallmentRange.max}`);
                      }
                    } else {
                      console.log(`   âŒ Ultra-fallback not applied: member has no product loans`);
                    }
                  }
                }
              }
            }

            if (belongsToThisRow) {
              // Check if this collection has already been matched to another row for this member
              if (!matchedCollections.current.has(collectionKey)) {
                let collectionAmount = 0;

                // MODIFIED: Show amounts for all statuses including collected
                if (record.status === 'collected') {
                  // For collected: Show the amount that was collected
                  collectionAmount = record.amount || 0;
                } else if (record.status === 'partial') {
                  // For partial: Show remaining amount (total - paid)
                  const totalAmount = record.amount || 0;
                  const paidAmount = record.paidAmount || 0;
                  collectionAmount = Math.max(0, totalAmount - paidAmount);
                  console.log(`📊 Partial Payment: Total=৳${totalAmount}, Paid=৳${paidAmount}, Due=৳${collectionAmount}`);
                } else if (record.status === 'pending') {
                  // For pending: Show full amount as due
                  collectionAmount = record.amount || 0;
                  console.log(`📋 Pending Installment: Due=৳${collectionAmount}`);
                } else {
                  // Other statuses: show full amount
                  collectionAmount = record.amount || 0;
                }

                loanAmount += collectionAmount;
                matchedCollections.current.add(collectionKey);
                console.log(`💰 Added ৳${collectionAmount} (Status: ${record.status}) to loan collection for this row. Total: ৳${loanAmount}`);
              } else {
                console.log(`⚠️ Skipping ৳${amount} - already matched to another row for this member`);
              }
            } else {
              console.log(`❌ Collection does not belong to this product row`);
            }
          }
          // Savings collections (product-specific matching)
          else if (type === 'extra' && note && (
            note.includes('Savings Collection') ||
            note.includes('সঞ্চয়') ||
            (note.toLowerCase().includes('savings') && !note.includes('Product') && !note.includes('Loan') && !note.includes('Withdrawal'))
          )) {
            // Check if this savings belongs to this product row
            let savingsBelongsToRow = false;
            const noteText = note.toLowerCase();

            // Method 1: Distribution ID match
            if (record.distributionId && distributionIds.includes(record.distributionId)) {
              savingsBelongsToRow = true;
              console.log(`  âœ… Savings matched by distributionId`);
            }
            // Method 2: Product name in note ("Product: Dal")
            else if (noteText.includes('product:')) {
              const productNamesInRow = products.map(p => {
                const name = p.productName || p.name || '';
                return name.split('(')[0].trim().toLowerCase();
              }).filter(n => n.length > 0);

              if (productNamesInRow.some(productName => noteText.includes(`product: ${productName}`))) {
                savingsBelongsToRow = true;
                console.log(`  âœ… Savings matched by product name in note`);
              }
            }
            // Method 3: Old savings without product info - show only in first row
            else if (!record.distributionId && !noteText.includes('product:')) {
              // Show in first transaction row only (avoid duplication)
              if (isFirstTransaction) {
                savingsBelongsToRow = true;
                console.log(`  âš ï¸ Old savings (no product info) - showing in first row only`);
              }
            }

            if (savingsBelongsToRow) {
              savingsInAmount += amount;
              console.log(`âœ… [getProductSpecificCollection] Savings Added: à§³${amount} for ${member.name} on ${targetDateStr}`);
            } else {
              console.log(`âŒ [getProductSpecificCollection] Savings SKIPPED: à§³${amount} (not for this product row)`);
            }
          }
          // Savings Out - Only for Savings Withdrawal transactions (with product-specific matching)
          else if (type === 'extra' && note && note.includes('Savings Withdrawal')) {
            // Check if this withdrawal belongs to this product row
            let withdrawalBelongsToRow = false;
            const noteText = note.toLowerCase();

            // Method 1: Distribution ID match
            if (record.distributionId && distributionIds.includes(record.distributionId)) {
              withdrawalBelongsToRow = true;
              console.log(`  ✅ Savings Withdrawal matched by distributionId`);
            }
            // Method 2: Product name in note ("Product: Dal")
            else if (noteText.includes('product:')) {
              const productNamesInRow = products.map(p => {
                const name = p.productName || p.name || '';
                return name.split('(')[0].trim().toLowerCase();
              }).filter(n => n.length > 0);

              if (productNamesInRow.some(productName => noteText.includes(`product: ${productName}`))) {
                withdrawalBelongsToRow = true;
                console.log(`  ✅ Savings Withdrawal matched by product name in note`);
              }
            }
            // Method 3: Old withdrawals without product info - show only in first row
            else if (!record.distributionId && !noteText.includes('product:')) {
              // Show in first transaction row only (avoid duplication)
              if (isFirstTransaction) {
                withdrawalBelongsToRow = true;
                console.log(`  ⚠️ Old withdrawal (no product info) - showing in first row only`);
              }
            }

            if (withdrawalBelongsToRow) {
              savingsOutAmount += amount;
              console.log(`✅ [getProductSpecificCollection] Savings Withdrawal Added: ৳${amount} for ${member.name} on ${targetDateStr}`);
            } else {
              console.log(`❌ [getProductSpecificCollection] Savings Withdrawal SKIPPED: ৳${amount} (not for this product row)`);
            }
          }
        }
      });

      return { loanAmount, savingsInAmount, savingsOutAmount };
    } catch (error) {
      console.error(`âŒ Error in getProductSpecificCollection for ${member.name}:`, error);
      return { loanAmount: 0, savingsInAmount: 0, savingsOutAmount: 0 };
    }
  };

  // Function to get collection amounts for a specific date from actual database records
  const getCollectionForDate = (member, targetDate, sectionFilter = null) => {
    try {
      // Ensure targetDate is a Date object
      const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return { loanAmount: 0, savingsInAmount: 0, savingsOutAmount: 0 };
      }

      // Fix timezone issue - use local date instead of UTC
      const targetDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      // Get all installment records for this member
      const allRecords = member.allInstallmentRecords || [];

      // Calculate amounts for different types
      let loanAmount = 0;           // Product installment payments
      let savingsInAmount = 0;      // Member deposits savings  
      let savingsOutAmount = 0;     // Always 0 - functionality removed

      // Debug disabled for performance

      // Process all records to find matches for this date - prevent duplicates
      const processedRecordIds = new Set();

      allRecords.forEach(record => {
        if (!record) return;

        // Skip if already processed (prevent duplicates)
        const recordId = record._id || record.id || `${record.amount}-${record.note}-${record.createdAt}`;
        if (processedRecordIds.has(recordId)) {
          return;
        }
        processedRecordIds.add(recordId);

        // Get record details first to determine which date to use
        // CRITICAL: For partial payments, use paidAmount instead of amount
        const amount = (record.paidAmount !== undefined && record.paidAmount > 0)
          ? record.paidAmount
          : (record.amount || 0);
        const note = record.note || '';
        const type = record.installmentType || '';

        // CRITICAL FIX: Use DIFFERENT date matching logic for different transaction types
        // - For LOAN installments: Use DUE DATE (shows when installment was scheduled)
        // - For SAVINGS collections: Use COLLECTION DATE (shows when savings was actually collected)
        // - For AUTO DEDUCTIONS: Use COLLECTION DATE (shows when deduction was processed)
        let recordDateStr = null;
        let recordDate = null;

        // Check if this is a savings collection or auto deduction
        const isSavingsCollection = type === 'extra' && note && (
          note.includes('Savings Collection') ||
          note.includes('সঞ্চয়') ||
          (note.toLowerCase().includes('savings') && !note.includes('Product') && !note.includes('Loan') && !note.includes('Withdrawal'))
        );

        const isAutoDeduction = record.paymentMethod === 'savings_deduction' || note.includes('deducted from savings');

        // Choose date based on transaction type
        if (isAutoDeduction) {
          // For auto deductions: Always use COLLECTION DATE (when deduction was processed)
          recordDate = record.collectionDate || record.date || record.createdAt;
        } else if (isSavingsCollection) {
          // For savings: Use COLLECTION DATE (when it was actually collected)
          recordDate = record.collectionDate || record.date || record.createdAt;
        } else {
          // For loans and others: Use DUE DATE (scheduled installment date)
          recordDate = record.dueDate || record.installmentDate || record.collectionDate || record.date || record.createdAt;
        }

        if (recordDate) {
          try {
            const parsedDate = new Date(recordDate);
            if (!isNaN(parsedDate.getTime())) {
              recordDateStr = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;

              // Debug logging for savings collections
              if (isSavingsCollection) {
                console.log(`ðŸ’° [getCollectionForDate] Savings Collection Found:`, {
                  memberName: member.name,
                  amount: amount,
                  collectionDate: recordDateStr,
                  targetDate: targetDateStr,
                  matches: recordDateStr === targetDateStr,
                  note: note.substring(0, 50)
                });
              }
            }
          } catch (e) {
            // Skip invalid dates
            return;
          }
        }

        // Match by the appropriate date
        // CRITICAL: Only exact date match, no fuzzy matching
        const isDateMatch = recordDateStr === targetDateStr;

        if (isDateMatch) {
          // Enhanced Loan installment collections detection - SUPPORT ALL STATUSES
          if (type === 'regular' && note && (
            note.includes('Product Loan') ||
            note.includes('Installment') ||
            note.includes('Full payment') ||
            note.includes('Partial payment') ||
            note.includes('Mobile') || // Product name matching
            note.includes('Rice') ||
            note.includes('Dal')
          )) {
            // Calculate due amount based on status
            let dueAmount = 0;
            if (record.status === 'collected') {
              // Already collected, don't show in loan column
              dueAmount = 0;
            } else if (record.status === 'partial') {
              // Show remaining amount
              const totalAmount = record.amount || 0;
              const paidAmount = record.paidAmount || 0;
              dueAmount = Math.max(0, totalAmount - paidAmount);
            } else {
              // Pending or other status - show full amount
              dueAmount = record.amount || 0;
            }
            loanAmount += dueAmount;
          }
          // Enhanced Savings collections detection - be more specific to avoid loan confusion
          else if (type === 'extra' && note && (
            note.includes('Savings Collection') ||
            note.includes('সঞ্চয়') ||
            (note.toLowerCase().includes('savings') && !note.includes('Product') && !note.includes('Loan') && !note.includes('Withdrawal'))
          )) {
            savingsInAmount += amount;
            console.log(`✅ [getCollectionForDate] Savings Added: ৳${amount} for ${member.name} on ${targetDateStr}`);
          }
          // Savings Out - Only for Savings Withdrawal transactions
          else if (type === 'extra' && note && note.includes('Savings Withdrawal')) {
            savingsOutAmount += amount;
            console.log(`✅ [getCollectionForDate] Savings withdrawal: ৳${amount} for ${member.name} on ${targetDateStr}`);
          }
        }
      });

      // Debug disabled for performance

      return { loanAmount, savingsInAmount, savingsOutAmount };
    } catch (error) {
      console.error(`âŒ Error in getCollectionForDate for ${member.name}:`, error);
      return { loanAmount: 0, savingsInAmount: 0, savingsOutAmount: 0 };
    }
  };

  const generateInstallmentDates = () => {
    // ✅ STEP 1: Check if this is a daily collector (Daily Kisti)
    let hasDailySchedule = false;

    try {
      // 🎯 CRITICAL FIX: Check collector's collectionType first
      if (selectedCollector?.collectionType === 'daily' || selectedDay?.isDaily) {
        hasDailySchedule = true;
        console.log('✅ DAILY KISTI COLLECTOR DETECTED from collector type!');
      } else {
        // Fallback: Check members' product installments for daily frequency
        console.log('🔍 Checking for daily schedule in', members.length, 'members');

        for (const member of members) {
          if (member.productInstallments && member.productInstallments.length > 0) {
            console.log(`📦 Member ${member.name} has ${member.productInstallments.length} products`);

            for (const product of member.productInstallments) {
              console.log(`  - Product: ${product.productName}, Frequency: ${product.installmentFrequency}`);

              if (product.installmentFrequency === 'daily') {
                hasDailySchedule = true;
                console.log('✅ DAILY SCHEDULE DETECTED from product!');
                break;
              }
            }
            if (hasDailySchedule) break;
          }
        }
      }

      console.log(`📊 Final daily schedule detection result: ${hasDailySchedule}`);
    } catch (error) {
      console.log('❌ Error checking daily schedule:', error);
    }

    // Update state to track if this is daily schedule
    if (hasDailySchedule !== isDailySchedule) {
      console.log(`🔄 Updating isDailySchedule state from ${isDailySchedule} to ${hasDailySchedule}`);
      setIsDailySchedule(hasDailySchedule);
    }

    // ✅ STEP 2: Generate dates based on schedule type
    if (hasDailySchedule) {
      // 📅 DAILY SCHEDULE: Generate all dates in month (excluding Fridays)
      const year = selectedMonthYear.year;
      const month = selectedMonthYear.month;

      // Get number of days in this month
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const dailyDates = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);

        // ✅ Skip Fridays (getDay() === 5)
        if (date.getDay() !== 5) {
          dailyDates.push(date);
        }
      }

      console.log(`📅 Daily schedule detected: Generated ${dailyDates.length} dates (Fridays excluded)`);
      return dailyDates;
    } else {
      // 📅 WEEKLY/MONTHLY SCHEDULE: Use collector's saved schedule
      try {
        const savedSchedule = localStorage.getItem(`collection_schedule_${selectedCollector?.id}`);
        if (savedSchedule) {
          const parsed = JSON.parse(savedSchedule);
          if (parsed.collectionDates && parsed.collectionDates.length > 0) {
            // Convert saved dates to Date objects
            return parsed.collectionDates.map(dateStr => {
              // Parse DD/MM/YYYY format
              const [day, month, year] = dateStr.split('/');
              return new Date(year, month - 1, day);
            });
          }
        }
      } catch (error) {
        console.log('Error loading collector schedule:', error);
      }

      // ✅ FIXED: Generate dates based on selected day of week
      const currentMonth = selectedMonthYear.month;
      const currentYear = selectedMonthYear.year;

      // Get selected day name (e.g., "Saturday")
      const selectedDayName = selectedDay?.name || 'Saturday';

      console.log('📅 Selected Day:', selectedDay);
      console.log('📅 Day Name:', selectedDayName);

      // Map day names to JavaScript day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const dayNameToNumber = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6
      };

      const targetDayNumber = dayNameToNumber[selectedDayName] !== undefined
        ? dayNameToNumber[selectedDayName]
        : 6; // Default to Saturday

      console.log(`📅 Generating dates for ${selectedDayName} (day ${targetDayNumber}) in ${currentMonth + 1}/${currentYear}`);

      // Generate all dates for this day in the selected month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const generatedDates = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        if (date.getDay() === targetDayNumber) {
          generatedDates.push(date);
          console.log(`  ✅ Found ${selectedDayName}: ${day}/${currentMonth + 1}/${currentYear}`);
        }
      }

      console.log(`📊 Generated ${generatedDates.length} ${selectedDayName}s for October 2025`);

      return generatedDates;
    }
  };

  // Filter dates by selected month and year
  const filterDatesByMonth = (dates) => {
    return dates.filter(date => {
      return date.getMonth() === selectedMonthYear.month &&
        date.getFullYear() === selectedMonthYear.year;
    });
  };

  // ✅ NEW: Get paginated dates for daily schedule (9 dates per page)
  const getPaginatedDates = (allDates) => {
    if (!isDailySchedule) {
      // Weekly/Monthly: return all dates
      return allDates;
    }

    // Daily: return only current page (9 dates)
    const startIndex = currentDatePage * DATES_PER_PAGE;
    const endIndex = startIndex + DATES_PER_PAGE;
    const paginatedDates = allDates.slice(startIndex, endIndex);

    console.log(`📅 Showing dates ${startIndex + 1}-${startIndex + paginatedDates.length} of ${allDates.length}`);
    return paginatedDates;
  };

  // ✅ NEW: Navigate to previous 9 dates
  const goToPreviousDates = () => {
    if (currentDatePage > 0) {
      setCurrentDatePage(currentDatePage - 1);
    }
  };

  // ✅ NEW: Navigate to next 9 dates
  const goToNextDates = () => {
    const allDates = filterDatesByMonth(generateInstallmentDates());
    const totalPages = Math.ceil(allDates.length / DATES_PER_PAGE);

    if (currentDatePage < totalPages - 1) {
      setCurrentDatePage(currentDatePage + 1);
    }
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setSelectedMonthYear(prev => {
      const newMonth = prev.month === 0 ? 11 : prev.month - 1;
      const newYear = prev.month === 0 ? prev.year - 1 : prev.year;
      return { month: newMonth, year: newYear };
    });
    // Reset date page when changing month
    setCurrentDatePage(0);
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setSelectedMonthYear(prev => {
      const newMonth = prev.month === 11 ? 0 : prev.month + 1;
      const newYear = prev.month === 11 ? prev.year + 1 : prev.year;
      return { month: newMonth, year: newYear };
    });
    // Reset date page when changing month
    setCurrentDatePage(0);
  };

  // Get month name for display
  const getMonthYearDisplay = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[selectedMonthYear.month]} ${selectedMonthYear.year}`;
  };

  if (!selectedBranch || !selectedCollector) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl border p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600">Please select a branch and collector first.</p>
            <button
              onClick={onGoBack}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl border p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center w-full max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">{loadingMessage}</p>
            <p className="text-sm text-blue-600 mt-1">Loading real database information...</p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2 font-medium">{Math.round(loadingProgress)}% Complete</p>
            <p className="text-xs text-gray-500 mt-1">Fetching member details, sponsor names, addresses, and product sales...</p>

            <button
              onClick={() => {
                setLoading(false);
                setMembers([]);
              }}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all"
            >
              Cancel Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allInstallmentDates = generateInstallmentDates();
  const filteredDates = filterDatesByMonth(allInstallmentDates);
  const installmentDates = getPaginatedDates(filteredDates);

  return (
    <div className="bg-white rounded-xl md:rounded-3xl shadow-2xl border p-3 md:p-6 lg:p-8 print:p-0 print:shadow-none print:border-0 print:rounded-none">
      {/* Controls - Back, Branch and Month Selection */}
      <div className="mb-6 no-print">
        <div className="bg-gray-50 rounded-xl p-3 md:p-4 border space-y-3">
          {/* Row 1: Back and Print Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onGoBack}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm md:text-base">Back to Selection</span>
            </button>

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all w-full sm:w-auto"
              title="Print Collection Sheet (Legal Size)"
            >
              <Printer className="h-4 w-4" />
              <span className="text-sm md:text-base">Print Sheet</span>
            </button>
          </div>

          {/* Row 2: Branch Filter and Month Navigation */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Branch Filter */}
            <div className="flex items-center space-x-2 flex-1">
              <span className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Branch:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="flex-1 px-2 md:px-3 py-1.5 md:py-1 bg-white border border-gray-300 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Branches</option>
                {collectorBranches.map((branch) => (
                  <option key={branch.branchCode} value={branch.branchCode}>
                    ({branch.branchCode}) {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-center space-x-2">
              <button onClick={goToPreviousMonth} className="p-1.5 md:p-2 hover:bg-gray-200 rounded-lg transition-all">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 md:px-3 py-1 bg-white rounded-lg font-medium text-xs md:text-sm border whitespace-nowrap">
                {getMonthYearDisplay()}
              </span>
              <button onClick={goToNextMonth} className="p-1.5 md:p-2 hover:bg-gray-200 rounded-lg transition-all">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Row 3: Daily Schedule Date Navigation (9 dates per page) */}
          {isDailySchedule && (
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 pt-2 border-t">
              <span className="text-xs md:text-sm font-medium text-gray-700 text-center sm:text-left">
                📅 Dates {currentDatePage * DATES_PER_PAGE + 1}-{Math.min((currentDatePage + 1) * DATES_PER_PAGE, filteredDates.length)} of {filteredDates.length}
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={goToPreviousDates}
                  disabled={currentDatePage === 0}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all text-xs md:text-sm"
                >
                  ← Previous 9
                </button>
                <button
                  onClick={goToNextDates}
                  disabled={currentDatePage >= Math.ceil(filteredDates.length / DATES_PER_PAGE) - 1}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all text-xs md:text-sm"
                >
                  Next 9 →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collection Sheet */}
      <div id="collection-sheet-content" className={isDailySchedule ? 'daily-schedule-sheet' : ''}>
        {/* Members Table */}
        {(() => {
          // Filter members by selected branch
          const filteredMembers = selectedBranchFilter === 'all'
            ? members
            : members.filter(m => m.branchCode === selectedBranchFilter);

          // Filter branches for header display
          const displayBranches = selectedBranchFilter === 'all'
            ? collectorBranches
            : collectorBranches.filter(b => b.branchCode === selectedBranchFilter);

          // Calculate total column count for colspan
          const columnCount = 12 + installmentDates.length;

          return filteredMembers.length > 0 && installmentDates.length > 0 ? (
            <div className="overflow-x-auto" style={{ marginTop: '0', paddingTop: '0' }}>
              <table className="w-full border-collapse border border-black text-xs sheet-table">
                <thead>
                  {/* Header Section - 3 Lines Format */}
                  <tr>
                    <td colSpan={12 + installmentDates.length} className="p-0">
                      <table className="w-full">
                        <tbody>
                          {/* Line 1: Title - No border */}
                          <tr>
                            <td className="text-center py-1 border-0">
                              <div className="text-lg font-bold">Satrong Sajghor Traders</div>
                              <div className="text-base">Borobari, Lalmonirhat</div>
                              <div className="text-base font-bold">Collection Sheet - {getMonthYearDisplay()}</div>
                            </td>
                          </tr>
                          {/* Line 2: Somity & Location Info - Same Line */}
                          <tr>
                            <td className="p-1 relative border-0">
                              <div className="flex justify-center">
                                {/* Somity Box - Left Side */}
                                <div className="absolute left-1 border border-black px-2 py-1.5">
                                  <div className="font-bold mb-1 text-[14px]">Somity Name & Code:</div>
                                  <div className="font-bold text-[16px]">
                                    {displayBranches.map((branch, index) => (
                                      <span key={branch.branchCode || index}>
                                        {index > 0 && ', '}
                                        ({branch.branchCode}) {branch.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {/* District, Upazilla, Union - Centered */}
                                <div className="flex gap-1">
                                  <div className="border border-black px-2 py-1 text-[13px]">
                                    <span className="font-bold">District:</span> Lalmonirhat
                                  </div>
                                  <div className="border border-black px-2 py-1 text-[13px]">
                                    <span className="font-bold">Upazilla:</span> Lalmonirhat
                                  </div>
                                  <div className="border border-black px-2 py-1 text-[13px]">
                                    <span className="font-bold">Union:</span> Borobari
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {/* Line 3: Field Officer & Dates - Separate Boxes */}
                          <tr>
                            <td className="p-1 border-0">
                              <div className="flex gap-1 justify-center">
                                {/* Field Officer Box */}
                                <div className="border border-black px-2 py-1 text-[13px]">
                                  <span className="font-bold">Field Officer Name:</span> {selectedCollector?.name || 'N/A'}
                                </div>
                                {/* Start Date Box */}
                                <div className="border border-black px-2 py-1 text-[13px]">
                                  <span className="font-bold">Start Date:</span> {installmentDates.length > 0 ? installmentDates[0].toLocaleDateString('en-GB') : 'N/A'}
                                </div>
                                {/* Day/Month/Year Box */}
                                <div className="border border-black px-2 py-1 text-[13px]">
                                  <span className="font-bold">Day/Month/Year:</span> {(() => {
                                    const today = getCurrentBDDateTime();
                                    return today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                                  })()}
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  {/* Table Header Row */}
                  <tr className="bg-gray-200">
                    <th className="border border-black px-1 py-2 text-center font-bold" style={{ width: '30px' }}>S.L</th>
                    <th className="border border-black px-1.5 py-1.5 text-center font-bold" style={{ minWidth: '120px' }}>
                      <div>Member Name</div>
                      <div>& Code</div>
                    </th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '85px' }}>
                      <div>Mobile</div>
                      <div>Number</div>
                    </th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '90px' }}>
                      <div>Sponsor</div>
                      <div>Name</div>
                    </th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '100px' }}>Address</th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '90px' }}>
                      <div>Product</div>
                      <div>Name</div>
                    </th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '65px' }}>
                      <div>Total</div>
                      <div>Amount</div>
                    </th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '60px' }}>
                      <div>Delivery</div>
                      <div>Date</div>
                    </th>
                    <th className="border border-black px-0.5 py-1.5 text-center font-bold" style={{ width: '35px' }}>
                      <div>Dofa</div>
                      <div>No</div>
                    </th>
                    <th className="border border-black px-0.5 py-1.5 text-center font-bold" style={{ width: '35px' }}>
                      <div>Install</div>
                      <div>ment</div>
                    </th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '70px' }}>
                      <div>Total Collected</div>
                      <div>Amount</div>
                    </th>
                    <th className="border border-black px-1 py-1.5 text-center font-bold" style={{ width: '65px' }}>
                      <div>Total</div>
                      <div>Savings</div>
                    </th>
                    {installmentDates.map((date, index) => (
                      <th key={index} className="border border-black px-0.5 py-1.5 text-center font-bold" style={{ minWidth: '115px', maxWidth: '115px' }}>
                        <div className="font-bold mb-0.5 text-[11px]">{formatBDDateShort(date)}</div>
                        <div className="grid grid-cols-3 gap-0">
                          <div className="text-[9px] font-normal bg-red-100 px-0.5 py-0.5 border-r border-black">
                            Loan
                          </div>
                          <div className="text-[9px] font-normal bg-green-100 px-0.5 py-0.5 border-r border-black">
                            Sav In
                          </div>
                          <div className="text-[9px] font-normal bg-orange-100 px-0.5 py-0.5" title="Savings Deducted (Auto + Manual)">
                            Sav Out
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // ✅ GROUPING LOGIC BASED ON COLLECTOR'S SCHEDULE TYPE
                    let membersWithFrequency;

                    if (isDailySchedule) {
                      // 🔵 DAILY COLLECTOR: সব members-কে "SHORT" group-এ রাখব
                      console.log('📊 Daily collector: All members will be under "SHORT" group');
                      membersWithFrequency = filteredMembers.map(m => ({
                        ...m,
                        _frequency: 'short' // সবাই একই group
                      }));
                    } else {
                      // 🔵 WEEKLY/MONTHLY COLLECTOR: Member-এর frequency অনুযায়ী grouping
                      console.log('📊 Weekly/Monthly collector: Grouping by member frequency');
                      membersWithFrequency = filteredMembers.map(m => ({
                        ...m,
                        _frequency: (m.productInstallments && m.productInstallments.length > 0 &&
                          m.productInstallments.some(p => p.installmentFrequency === 'monthly'))
                          ? 'monthly' : 'weekly'
                      }));
                    }

                    // Sort members
                    const sortedMembers = isDailySchedule
                      ? membersWithFrequency // Daily: no sorting needed (all same group)
                      : membersWithFrequency.sort((a, b) => {
                        // Weekly/Monthly: weekly first, then monthly
                        if (a._frequency === b._frequency) return 0;
                        return a._frequency === 'weekly' ? -1 : 1;
                      });

                    // Render with group headers
                    const allRows = [];
                    let lastGroup = null;

                    sortedMembers.forEach((member, memberIndex) => {
                      // Insert group header when group changes
                      if (member._frequency !== lastGroup) {
                        // ✅ Group names based on collector type
                        let groupName;
                        if (isDailySchedule) {
                          groupName = 'SHORT'; // Daily collector: শুধু SHORT
                        } else {
                          // Weekly/Monthly collector: JAGORON/AGROSOR
                          groupName = member._frequency === 'weekly' ? 'JAGORON' : 'AGROSOR';
                        }

                        allRows.push(
                          <tr key={`group-${member._frequency}`} className="bg-white">
                            <td colSpan={12 + installmentDates.length} className="border border-black py-1.5 font-bold text-black text-sm" style={{ textAlign: 'left', paddingLeft: '140px' }}>
                              {groupName}
                            </td>
                          </tr>
                        );
                        lastGroup = member._frequency;
                      }

                      // Render member rows (keep original logic)
                      const memberRows = (() => {
                        // Clear collection tracking for this member (prevent double-counting only within member's rows)
                        matchedCollections.current.clear();

                        // ✅ FILTER: Remove fully paid products (Total Collected Amount >= Total Amount)
                        let activeProducts = [];

                        // GROUP PRODUCTS BY SALE TRANSACTION: Products from same sale in consecutive rows
                        if (member.productInstallments && member.productInstallments.length > 0) {
                          // 👁️ DEBUG: Log all products before filtering
                          console.log(`📊 Member: ${member.name} - Checking ${member.productInstallments.length} products:`);
                          member.productInstallments.forEach((p, i) => {
                            console.log(`  ${i + 1}. ${p.productName}: Total=৳${p.totalAmount || 0}, Paid=৳${p.paidAmount || 0}, Fully Paid=${(p.paidAmount || 0) >= (p.totalAmount || 0) && (p.totalAmount || 0) > 0}`);
                          });

                          activeProducts = member.productInstallments.filter(product => {
                            const totalAmount = product.totalAmount || 0;
                            const paidAmount = product.paidAmount || 0;

                            // Keep product if not fully paid
                            const isFullyPaid = paidAmount >= totalAmount && totalAmount > 0;

                            if (isFullyPaid) {
                              console.log(`🔒 Product fully paid - removing from sheet: ${product.productName} (Paid: ৳${paidAmount} / Total: ৳${totalAmount})`);
                            }

                            return !isFullyPaid; // Keep only products that are NOT fully paid
                          });

                          console.log(`✅ After filtering: ${activeProducts.length} active products remaining`);
                          activeProducts.forEach((p, i) => {
                            console.log(`  ${i + 1}. ${p.productName}: Total=৳${p.totalAmount || 0}, Paid=৳${p.paidAmount || 0}`);
                          });

                          // ✅ If all products are fully paid, show member with "No Product" (they still need to pay savings)
                          if (activeProducts.length === 0) {
                            console.log(`💰 All products fully paid for ${member.name} - showing as No Product member (savings only)`);
                            // Will fall through to "Member with no products" section below
                          }

                          // Only process products if there are active (unpaid) products
                          if (activeProducts.length > 0) {
                            // Group products by sale transaction ID
                            const saleTransactionGroups = {};

                            activeProducts.forEach(product => {
                              const saleTransactionId = product.saleTransactionId || `LEGACY-${product.saleId}`;
                              if (!saleTransactionGroups[saleTransactionId]) {
                                saleTransactionGroups[saleTransactionId] = [];
                              }
                              saleTransactionGroups[saleTransactionId].push(product);
                            });

                            // Sort transaction groups by creation date (first sale, second sale, etc.)
                            const sortedTransactionGroups = Object.entries(saleTransactionGroups)
                              .sort(([, productsA], [, productsB]) => {
                                const dateA = new Date(productsA[0].deliveryDate);
                                const dateB = new Date(productsB[0].deliveryDate);
                                return dateA - dateB;
                              });

                            // Create rows for all products, grouped by transaction
                            const allRows = [];
                            let totalProductIndex = 0;

                            sortedTransactionGroups.forEach(([saleTransactionId, products], transactionIndex) => {
                              // DEBUG: Log product details
                              console.log(`ðŸ“¦ Transaction ${saleTransactionId}:`, products.map(p => ({
                                name: p.productName,
                                totalInstallments: p.totalInstallments,
                                installmentCount: p.installmentCount
                              })));

                              // Calculate total collected amount for THIS ROW ONLY (not all member collections)
                              const rowDistributionIds = products.map(p => p.distributionId || p.saleId || p._id).filter(Boolean);

                              // Calculate product-specific savings (Sav In - Sav Out for this row)
                              const productSavingsIn = (member.allInstallmentRecords || [])
                                .filter(record => {
                                  if (record.installmentType !== 'extra' || !record.note) return false;
                                  if (!record.note.includes('Savings Collection')) return false;
                                  if (record.status !== 'collected') return false;

                                  // Check if this savings belongs to this product row
                                  // Method 1: distributionId matching (new records)
                                  if (record.distributionId && rowDistributionIds.includes(record.distributionId)) {
                                    console.log(`  ✅ Savings matched by distributionId: ${record.distributionId}`);
                                    return true;
                                  }

                                  // Method 2: Product name in note (new records with "Product: Dal")
                                  const noteText = record.note.toLowerCase();
                                  const productNamesInRow = products.map(p => {
                                    const name = p.productName || p.name || '';
                                    return name.split('(')[0].trim().toLowerCase();
                                  }).filter(n => n.length > 0);

                                  if (productNamesInRow.some(productName => noteText.includes(`product: ${productName}`))) {
                                    console.log(`  ✅ Savings matched by product name in note:`, productNamesInRow);
                                    return true;
                                  }

                                  // Method 3: Fallback for old records without product info
                                  // Show old savings ONLY in the FIRST product row to avoid duplication
                                  if (!record.distributionId && !noteText.includes('product:')) {
                                    // Only include in first transaction (transactionIndex === 0)
                                    if (transactionIndex === 0) {
                                      console.log(`  ⚠️ Old savings (no product info) - showing in first row only`);
                                      return true;
                                    }
                                  }

                                  return false;
                                })
                                .reduce((sum, record) => sum + (record.amount || 0), 0);

                              // Calculate product-specific savings withdrawals (Sav Out for this row)
                              const productSavingsOut = (member.allInstallmentRecords || [])
                                .filter(record => {
                                  if (record.installmentType !== 'extra' || !record.note) return false;
                                  if (!record.note.includes('Savings Withdrawal')) return false;
                                  if (record.status !== 'collected') return false;

                                  // Check if this withdrawal belongs to this product row
                                  // Method 1: distributionId matching (new records)
                                  if (record.distributionId && rowDistributionIds.includes(record.distributionId)) {
                                    console.log(`  ✅ Withdrawal matched by distributionId: ${record.distributionId}`);
                                    return true;
                                  }

                                  // Method 2: Product name in note (new records with "Product: Dal")
                                  const noteText = record.note.toLowerCase();
                                  const productNamesInRow = products.map(p => {
                                    const name = p.productName || p.name || '';
                                    return name.split('(')[0].trim().toLowerCase();
                                  }).filter(n => n.length > 0);

                                  if (productNamesInRow.some(productName => noteText.includes(`product: ${productName}`))) {
                                    console.log(`  ✅ Withdrawal matched by product name in note:`, productNamesInRow);
                                    return true;
                                  }

                                  // Method 3: Fallback for old withdrawals without product info
                                  // Show old withdrawals ONLY in the FIRST product row to avoid duplication
                                  if (!record.distributionId && !noteText.includes('product:')) {
                                    // Only include in first transaction (transactionIndex === 0)
                                    if (transactionIndex === 0) {
                                      console.log(`  ⚠️ Old withdrawal (no product info) - showing in first row only`);
                                      return true;
                                    }
                                  }

                                  return false;
                                })
                                .reduce((sum, record) => sum + (record.amount || 0), 0);

                              // Net savings for this product row (In - Out)
                              const productSavings = Math.max(0, productSavingsIn - productSavingsOut);

                              console.log(`💰 Product Savings for ${member.name} (Transaction: ${saleTransactionId}):`);
                              console.log(`   💚 Savings In: ৳${productSavingsIn}`);
                              console.log(`   💔 Savings Out: ৳${productSavingsOut}`);
                              console.log(`   💵 Net Savings: ৳${productSavings}`);

                              // ✅ FIX: Calculate total collected amount for THIS ROW's products only
                              const totalCollectedAmount = products.reduce((sum, product) => {
                                return sum + (product.paidAmount || 0);
                              }, 0);

                              console.log(`💰 Row Collected Amount for ${member.name} (Transaction: ${saleTransactionId}):`);
                              console.log(`   🆔 Row Distribution IDs:`, rowDistributionIds);
                              console.log(`   📦 Products in row:`, products.map(p => `${p.productName} (Paid: ৳${p.paidAmount || 0})`));
                              console.log(`   💵 Total Collected for this row: ৳${totalCollectedAmount}`);

                              // Get the maximum installment count from products (already calculated in processInstallmentHistory)
                              console.log('Product installment counts:', products.map(p => ({
                                name: p.productName,
                                installmentCount: p.installmentCount,
                                paidAmount: p.paidAmount,
                                distributionId: p.distributionId
                              })));
                              const paidInstallmentCount = Math.max(...products.map(p => p.installmentCount || 0), 0);

                              // ✅ CRITICAL FIX: Calculate savings for THIS product row
                              // Backend totalSavings already contains: initial + all collections - all withdrawals
                              // So we just use it directly for the first row
                              const savingsForThisRow = (() => {
                                const totalTransactions = sortedTransactionGroups.length;

                                // Case 1: Member has ONLY 1 product sale - show TOTAL savings from backend
                                if (totalTransactions === 1) {
                                  const backendTotalSavings = Number(member.totalSavings || 0);
                                  console.log(`💰 Member ${member.name} (Single Sale) Total Savings: ${backendTotalSavings} (from backend - already includes withdrawals)`);
                                  return backendTotalSavings;
                                }

                                // Case 2: Member has MULTIPLE sales
                                // For FIRST product row: show backend total savings (already has withdrawals subtracted)
                                // For OTHER rows: show 0 (to avoid duplication)
                                if (transactionIndex === 0) {
                                  const backendTotalSavings = Number(member.totalSavings || 0);
                                  console.log(`💰 Member ${member.name} Row 1 (Multiple Sales) - Using backend totalSavings: ৳${backendTotalSavings} (already has withdrawals subtracted)`);
                                  return backendTotalSavings;
                                } else {
                                  // Other rows: don't show savings (already shown in first row)
                                  console.log(`💰 Member ${member.name} Row ${transactionIndex + 1} - Savings: ৳0 (shown in first row)`);
                                  return 0;
                                }
                              })();

                              // Consolidate all products from this transaction into one row
                              const consolidatedProductData = {
                                // Extract clean product names without quantity/price details
                                productNames: products.map(p => {
                                  const fullName = p.productName || p.name || 'Unknown Product';
                                  // Remove everything after '(' to get just the product name
                                  return fullName.split('(')[0].trim();
                                }).join(', '),
                                totalAmount: products.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
                                // Use the maximum installment count from all products in this transaction
                                // This handles cases where products have different installment counts
                                totalInstallments: Math.max(...products.map(p => p.totalInstallments || p.installmentCount || 0)),
                                installmentCount: paidInstallmentCount, // Number of paid installments
                                paidAmount: totalCollectedAmount, // Total across all dates
                                totalSavings: savingsForThisRow, // Initial + 1st sale savings (row 1), or only this sale savings (other rows)
                                deliveryDate: products[0].deliveryDate, // Use first product's delivery date
                                dofaNumber: transactionIndex + 1 // ✅ Single Dofa No per sale transaction (1st sale = 1, 2nd sale = 2, etc.)
                              };

                              allRows.push(
                                <tr
                                  key={`${member._id}-${saleTransactionId}`}
                                  className="h-8"
                                >
                                  {/* Show member details only in first transaction row */}
                                  {transactionIndex === 0 && (
                                    <>
                                      <td rowSpan={sortedTransactionGroups.length} className="border border-black px-1 py-1 text-center font-medium text-xs">{memberIndex + 1}</td>
                                      <td rowSpan={sortedTransactionGroups.length} className="border border-black px-1.5 py-1 text-xs">
                                        <div className="font-medium">
                                          ({member.memberCode || String(memberIndex + 1).padStart(3, '0')}) {member.name}
                                        </div>
                                      </td>
                                      <td rowSpan={sortedTransactionGroups.length} className="border border-black px-1 py-1 text-center text-[11px]">
                                        {member.phone}
                                      </td>
                                      <td rowSpan={sortedTransactionGroups.length} className="border border-black px-1 py-1 text-center text-[11px]">
                                        {member.sponsorName || 'N/A'}
                                      </td>
                                      <td rowSpan={sortedTransactionGroups.length} className="border border-black px-1 py-1 text-[11px]">
                                        {member.address || member.village || 'N/A'}
                                      </td>
                                    </>
                                  )}

                                  {/* Consolidated product details for this transaction */}
                                  <td className="border border-black px-1 py-1 text-center font-medium text-[11px]">
                                    {consolidatedProductData.productNames}
                                  </td>
                                  <td className="border border-black px-1 py-1 text-center font-medium text-[11px]">
                                    {formatCurrency(consolidatedProductData.totalAmount)}
                                  </td>
                                  <td className="border border-black px-1 py-1 text-center text-[10px]">
                                    {consolidatedProductData.deliveryDate ? formatBDDateShort(consolidatedProductData.deliveryDate) : 'N/A'}
                                  </td>
                                  <td className="border border-black px-0.5 py-1 text-center text-[11px]">
                                    {consolidatedProductData.dofaNumber}
                                  </td>
                                  <td className="border border-black px-0.5 py-1 text-center text-[11px]">
                                    {consolidatedProductData.installmentCount}
                                  </td>
                                  <td className="border border-black px-1 py-1 text-center font-medium text-green-600 text-[11px]">
                                    {formatCurrency(consolidatedProductData.paidAmount)}
                                  </td>

                                  {/* Show product-specific savings for each row */}
                                  <td className="border border-black px-1 py-1 text-center font-medium text-blue-600 text-[11px]">
                                    {consolidatedProductData.totalSavings > 0 ? formatCurrency(consolidatedProductData.totalSavings) : ''}
                                  </td>

                                  {/* Installment date columns */}
                                  {installmentDates.map((date, dateIndex) => {
                                    // 🆕 CRITICAL: Check if collection date is BEFORE delivery date
                                    // If yes, show EMPTY cells for both Loan and Sav In

                                    // Parse and validate delivery date
                                    let deliveryDateObj = null;
                                    if (consolidatedProductData.deliveryDate) {
                                      try {
                                        deliveryDateObj = new Date(consolidatedProductData.deliveryDate);
                                        // Validate the date object
                                        if (isNaN(deliveryDateObj.getTime())) {
                                          console.warn(`⚠️ Invalid deliveryDate for ${member.name}: ${consolidatedProductData.deliveryDate}`);
                                          deliveryDateObj = null;
                                        }
                                      } catch (e) {
                                        console.error(`❌ Error parsing deliveryDate for ${member.name}:`, e);
                                        deliveryDateObj = null;
                                      }
                                    }

                                    const collectionDateObj = new Date(date);

                                    // Set both dates to midnight for accurate date-only comparison
                                    if (deliveryDateObj) {
                                      deliveryDateObj.setHours(0, 0, 0, 0);
                                    }
                                    collectionDateObj.setHours(0, 0, 0, 0);

                                    // ✅ CRITICAL FIX: Show ONLY if delivery date exists AND collection date is AFTER delivery
                                    // Delivery date MUST exist to show any amounts
                                    // Daily: 20 Nov delivery → 21 Nov থেকে শুরু (collectionDate > deliveryDate)
                                    // Weekly/Monthly: 20 Nov delivery → 22 Nov onwards (next collection date after delivery)

                                    let shouldShowAmount = false;

                                    if (deliveryDateObj) {
                                      // Only show if collection date is AFTER delivery date
                                      shouldShowAmount = collectionDateObj > deliveryDateObj;
                                    }
                                    // If no delivery date, don't show anything (product not delivered yet)

                                    // ✅ FIXED: Show SCHEDULED amounts, not actual collected amounts
                                    // Calculate scheduled installment amount (fixed per installment)
                                    const scheduledInstallmentAmount = consolidatedProductData.totalInstallments > 0
                                      ? Math.round(consolidatedProductData.totalAmount / consolidatedProductData.totalInstallments)
                                      : 0;

                                    // ✅ Determine expected savings based on installment frequency (fixed)
                                    const installmentFrequency = products[0]?.installmentFrequency || 'weekly';
                                    const expectedSavings = installmentFrequency === 'monthly' ? 50 : 20;

                                    // Get actual collection data ONLY for Sav Out (actual withdrawals should show)
                                    const collection = !shouldShowAmount
                                      ? { loanAmount: 0, savingsInAmount: 0, savingsOutAmount: 0 } // Empty if no installment due
                                      : getProductSpecificCollection(member, date, consolidatedProductData, products, transactionIndex === 0);

                                    // ✅ FIXED: Display logic
                                    // - DAILY: Show ONLY if installment due on this date
                                    // - WEEKLY/MONTHLY: Show if delivery has happened
                                    // - Loan box: Show SCHEDULED amount
                                    // - Sav In box: Show EXPECTED savings
                                    // - Sav Out box: Show ACTUAL withdrawals

                                    const displayLoan = !shouldShowAmount
                                      ? '' // Empty if no installment due (daily) or before delivery (weekly/monthly)
                                      : (scheduledInstallmentAmount > 0 ? formatCurrency(scheduledInstallmentAmount) : '');

                                    const displaySavingsIn = !shouldShowAmount
                                      ? '' // Empty if no installment due (daily) or before delivery (weekly/monthly)
                                      : `৳${expectedSavings}`; // Show expected savings when installment is due

                                    return (
                                      <td key={dateIndex} className="border border-black px-0.5 py-0.5">
                                        <div className="grid grid-cols-3 gap-0 h-6">
                                          <div className="text-center text-[9px] flex items-center justify-center bg-red-50 collection-cell border-r border-black">
                                            {displayLoan}
                                          </div>
                                          <div className="text-center text-[9px] flex items-center justify-center bg-green-50 collection-cell border-r border-black">
                                            {displaySavingsIn}
                                          </div>
                                          <div className="text-center text-[9px] flex items-center justify-center bg-orange-50 collection-cell">
                                            {collection.savingsOutAmount > 0 ? formatCurrency(collection.savingsOutAmount) : ''}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            });

                            return allRows;
                          } // End of if (activeProducts.length > 0)
                        } // End of if (member.productInstallments && member.productInstallments.length > 0)

                        // Member with no active products (either never had products OR all products are fully paid)
                        // Show them as "No Product" member (they still need to pay savings)
                        return (
                          <tr key={member._id} className="h-8">
                            <td className="border border-black px-1 py-1 text-center font-medium text-xs">{memberIndex + 1}</td>
                            <td className="border border-black px-1.5 py-1 text-xs">
                              <div className="font-medium">
                                ({member.memberCode || String(memberIndex + 1).padStart(3, '0')}) {member.name}
                              </div>
                            </td>
                            <td className="border border-black px-1 py-1 text-center text-[11px]">
                              {member.phone}
                            </td>
                            <td className="border border-black px-1 py-1 text-center text-[11px]">
                              {member.sponsorName || 'N/A'}
                            </td>
                            <td className="border border-black px-1 py-1 text-[11px]">
                              {member.address || member.village || 'N/A'}
                            </td>
                            <td className="border border-black px-1 py-1 text-center text-gray-500 text-[11px]">
                              No Product
                            </td>
                            <td className="border border-black px-1 py-1 text-center text-gray-500 text-[11px]">
                              {formatCurrency(0)}
                            </td>
                            <td className="border border-black px-1 py-1 text-center text-gray-500 text-[10px]">
                              N/A
                            </td>
                            <td className="border border-black px-0.5 py-1 text-center text-gray-500 text-[11px]">
                              N/A
                            </td>
                            <td className="border border-black px-0.5 py-1 text-center text-gray-500 text-[11px]">
                              0
                            </td>
                            <td className="border border-black px-1 py-1 text-center font-medium text-green-600 text-[11px]">
                              {formatCurrency(member.totalCollectedAmount || 0)}
                            </td>
                            <td className="border border-black px-1 py-1 text-center font-medium text-blue-600 text-[11px]">
                              {(() => {
                                console.log(`💰 [SHEET RENDER] ${member.name} totalSavings: ${member.totalSavings}`);
                                return formatCurrency(member.totalSavings || 0);
                              })()}
                            </td>
                            {installmentDates.map((date, dateIndex) => {
                              // For members with no products, show scheduled savings per frequency (Jagoron/Aggrosor)
                              // Determine expected savings (weekly: 20, monthly: 50)
                              const expectedSavings = (member._frequency === 'monthly') ? 50 : 20;

                              // 🎯 NEW: Check if this date is AFTER member's join date
                              const memberJoinDate = member.joinDate ? new Date(member.joinDate) : null;
                              const collectionDate = new Date(date);

                              // Set time to start of day for proper comparison
                              if (memberJoinDate) {
                                memberJoinDate.setHours(0, 0, 0, 0);
                              }
                              collectionDate.setHours(0, 0, 0, 0);

                              // Show savings only if collection date is AFTER join date
                              const shouldShowSavings = !memberJoinDate || collectionDate > memberJoinDate;

                              // Debug log (only for first date to avoid spam)
                              if (dateIndex === 0) {
                                console.log(`📅 [${member.name}] Join: ${memberJoinDate ? memberJoinDate.toISOString().split('T')[0] : 'N/A'}, First Collection: ${collectionDate.toISOString().split('T')[0]}, Show Savings: ${shouldShowSavings}`);
                              }

                              // Get actual savings withdrawals for Sav Out display
                              const collection = getCollectionForDate(member, date);

                              return (
                                <td key={dateIndex} className="border border-black px-0.5 py-0.5">
                                  <div className="grid grid-cols-3 gap-0 h-6">
                                    <div className="text-center text-[8px] flex items-center justify-center bg-red-50 collection-cell border-r border-black">
                                      {/* Loan: Empty for no-product members */}
                                    </div>
                                    <div className="text-center text-[8px] flex items-center justify-center bg-green-50 collection-cell border-r border-black">
                                      {shouldShowSavings ? `৳${expectedSavings}` : ''}
                                    </div>
                                    <div className="text-center text-[8px] flex items-center justify-center bg-orange-50 collection-cell">
                                      {collection.savingsOutAmount > 0 ? formatCurrency(collection.savingsOutAmount) : ''}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })(); // Close memberRows IIFE

                      // Push member rows to allRows
                      if (Array.isArray(memberRows)) {
                        allRows.push(...memberRows);
                      } else if (memberRows) {
                        allRows.push(memberRows);
                      }
                    });

                    return allRows;
                  })()}
                </tbody>
              </table>

            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Members Found</h3>
              <p className="text-gray-600">
                No members found for selected filter.
              </p>
            </div>
          );
        })()}

        {/* Signature Section */}
        <div className="signature-section mt-16 mb-6 px-8">
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="border-t-2 border-black w-48 mb-2"></div>
              <p className="text-sm font-semibold">Manager Signature</p>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-black w-48 mb-2"></div>
              <p className="text-sm font-semibold">Field Officer Signature</p>
            </div>
          </div>
          <div className="mt-4 text-right">
            <p className="text-xs text-gray-600">Page: 1 of 1</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionSheet;
