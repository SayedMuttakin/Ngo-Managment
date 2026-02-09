import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { installmentsAPI } from '../../utils/api';

const CollectInstallmentForm = ({ selectedMember, selectedBranch, onClose, onInstallmentCollected }) => {
  const [installmentData, setInstallmentData] = useState({
    amount: '',
    notes: '',
    type: 'installment',
    paymentType: 'full' // 'full' or 'partial'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberInstallments, setMemberInstallments] = useState([]);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  // Load member installments on component mount
  useEffect(() => {
    loadMemberInstallments();
  }, [selectedMember]);

  // Auto-focus on amount input
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = document.querySelector('input[name="amount"]');
      if (input) input.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const loadMemberInstallments = async () => {
    try {
      setLoading(true);
      console.log('📋 Loading installments for member:', selectedMember._id);
      
      // Load member's installment history from API
      const response = await installmentsAPI.getByMember(selectedMember._id);
      
      if (response.success && response.data) {
        console.log('📦 Raw installment data:', response.data);
        console.log('📊 Data breakdown by type:');
        
        // Log all installment types for debugging
        const typeBreakdown = {};
        response.data.forEach(installment => {
          const type = installment.installmentType || 'undefined';
          typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
        });
        console.log('📊 Installment types found:', typeBreakdown);
        
        // Check for loan installments (could be 'regular', 'loan', or other types)
        const loanInstallments = response.data.filter(installment => 
          installment.installmentType === 'regular' || 
          installment.installmentType === 'loan' ||
          (installment.note && installment.note.toLowerCase().includes('loan')) ||
          (installment.note && installment.note.toLowerCase().includes('kisti'))
        );
        
        console.log('💰 Found loan installments:', loanInstallments);
        console.log('💰 Loan installments count:', loanInstallments.length);
        
        // If we have loan installments, use those instead of generating from product sales
        if (loanInstallments.length > 0) {
          console.log('✅ Using actual loan installments from database');
          console.log('🔧 FORCING all loan installments to use collector schedule dates');
          
          // Apply collected payments and savings from localStorage
          const collectionKey = `collected_${selectedMember._id}`;
          const collectedPayments = JSON.parse(localStorage.getItem(collectionKey) || '[]');
          
          const savingsKey = `savings_${selectedMember._id}`;
          const collectedSavings = JSON.parse(localStorage.getItem(savingsKey) || '[]');
          
          console.log('💾 Found collected payments in localStorage:', collectedPayments);
          console.log('💰 Found collected savings in localStorage:', collectedSavings);
          
          // Count collection records for THIS MEMBER to determine how many installments have been paid
          const collectionRecords = response.data.filter(record => {
            // Handle object references for member field
            let memberIdField;
            if (record.memberId) {
              memberIdField = record.memberId;
            } else if (record.member) {
              memberIdField = typeof record.member === 'object' ? record.member._id || record.member.id : record.member;
            } else if (record.memberID) {
              memberIdField = record.memberID;
            } else if (record.Member) {
              memberIdField = typeof record.Member === 'object' ? record.Member._id || record.Member.id : record.Member;
            }
            
            const typeMatch = record.installmentType === 'regular';
            const memberMatch = memberIdField === selectedMember._id;
            
            // Very specific note matching - only ACTUAL collections, not loan installment records
            const noteMatch = record.note && (
              (record.note.includes('Product Loan:') && record.note.includes('Installment') && record.note.includes('/') && (record.note.includes('Full payment') || record.note.includes('Partial payment'))) || // "Product Loan: Rice cooker - Installment 1/12 (weekly) - Full payment" or "Partial payment"
              (record.note.includes('Loan Installment') && (record.note.includes('Full payment') || record.note.includes('Partial payment'))) // "Loan Installment - Installment 1/16 - Full payment" or "Partial payment"
            );
            
            // Additional check: exclude old/different loan records by checking recent creation
            const isRecent = record.createdAt && (new Date() - new Date(record.createdAt)) < (30 * 24 * 60 * 60 * 1000); // Within 30 days
            
            if (typeMatch && memberMatch) {
              console.log(`🔍 Collection: ${record.note}, Recent: ${isRecent}, Member: ${memberMatch}, Note Match: ${noteMatch}`);
            }
            
            return typeMatch && memberMatch && noteMatch && isRecent;
          });
          
          console.log(`📊 Found collection records for member ${selectedMember.name}:`, collectionRecords.length);
          console.log('📋 Member ID filter:', selectedMember._id);
          console.log('🔍 Collection records details:', collectionRecords.map(r => ({
            amount: r.amount,
            memberField: r.member,
            memberType: typeof r.member,
            memberId: typeof r.member === 'object' ? r.member._id : r.member,
            note: r.note
          })));
          
          console.log('🔍 Processing loan installments:', loanInstallments.length, 'installments');
          console.log('🔍 Sample installment data:', loanInstallments[0]);
          
          const updatedInstallments = loanInstallments.map((installment, index) => {
            const installmentId = `${installment._id}-${index}`;
            const collections = collectedPayments.filter(c => c.installmentId === installmentId);
            const savings = collectedSavings.filter(s => s.installmentId === installmentId);
            
            console.log(`🔍 Processing installment #${index + 1}: Base amount = ৳${installment.amount}`);
            
            // Calculate actual collected amount from database for this specific installment
            const installmentCollections = collectionRecords.filter(record => {
              // Try to match this installment with database records with more patterns
              if (!record.note) return false;
              
              const installmentNum = index + 1;
              const patterns = [
                `Installment ${installmentNum}/`,     // "Installment 3/20"
                `Installment ${installmentNum} `,     // "Installment 3 "
                `- Installment ${installmentNum}`,    // "- Installment 3"
                `Installment ${installmentNum}-`,     // "Installment 3-"
                ` ${installmentNum}/`,                // " 3/20"
                ` ${installmentNum} `,                // " 3 "
              ];
              
              const matches = patterns.some(pattern => record.note.includes(pattern));
              
              if (matches) {
                console.log(`🎯 Matched installment ${installmentNum} with note: "${record.note}" (Amount: ৳${record.amount})`);
              }
              
              return matches;
            });
            
            const totalCollectedFromDB = installmentCollections.reduce((sum, record) => sum + (record.amount || 0), 0);
            console.log(`💰 Installment #${index + 1}: Found ${installmentCollections.length} DB collections totaling ৳${totalCollectedFromDB}`);
            
            // Determine status based on actual amounts
            let paidAmount = totalCollectedFromDB;
            let remainingAmount = Math.max(0, installment.amount - totalCollectedFromDB);
            let status = 'due';
            
            if (totalCollectedFromDB >= installment.amount) {
              // Only mark as paid if collected amount equals or exceeds installment amount
              status = 'paid';
              remainingAmount = 0;
              paidAmount = installment.amount; // Cap paid amount to installment amount
            } else if (totalCollectedFromDB > 0) {
              // If there's still remaining amount but some payment made, it's partial
              status = 'partial';
              // Keep the actual remaining amount, don't set to 0
              remainingAmount = installment.amount - totalCollectedFromDB;
              paidAmount = totalCollectedFromDB;
            } else {
              // No payment made
              status = 'due';
              remainingAmount = installment.amount;
              paidAmount = 0;
            }
            
            console.log(`🔍 Installment #${index + 1} Status Check:`);
            console.log(`   - Original Amount: ৳${installment.amount}`);
            console.log(`   - Collections Found: ${installmentCollections.length}`);
            console.log(`   - Total Collected: ৳${totalCollectedFromDB}`);
            console.log(`   - Calculated Remaining: ৳${remainingAmount}`);
            console.log(`   - Final Status: ${status}`);
            console.log(`   - Collection Details:`, installmentCollections.map(c => ({note: c.note, amount: c.amount})));
            
            // Get proper due date from Collection Schedule - ALWAYS use collector schedule
            let dueDate = new Date().toISOString().split('T')[0]; // Default fallback
            
            // Try to get collection schedule dates and spread installments
            try {
              // Get collector ID from localStorage state (from Installments component)
              const selectedCollectorData = JSON.parse(localStorage.getItem('selectedCollector') || '{}');
              const collectorId = selectedCollectorData.id || selectedCollectorData._id || 'hayat';
              
              console.log(`🔍 Getting collection schedule for collector: ${collectorId}`);
              console.log(`🔍 Selected collector data:`, selectedCollectorData);
              
              // Try to get collector-specific schedule
              let scheduleDates = [];
              const savedSchedule = localStorage.getItem(`collection_schedule_${collectorId}`);
              
              if (savedSchedule) {
                const parsed = JSON.parse(savedSchedule);
                scheduleDates = parsed.collectionDates || [];
                console.log(`📅 Found collector schedule for ${collectorId}:`, scheduleDates);
              } else {
                // Try alternative storage format
                const alternativeSchedule = localStorage.getItem(`collectionSchedule_${collectorId}`);
                if (alternativeSchedule) {
                  const parsed = JSON.parse(alternativeSchedule);
                  scheduleDates = parsed.dates || parsed.collectionDates || [];
                  console.log(`📅 Found alternative collector schedule for ${collectorId}:`, scheduleDates);
                } else {
                  // Use current month's dates from the collector's schedule
                  scheduleDates = [
                    '02/09/2025', // Week 1 - September
                    '09/09/2025', // Week 2 - September  
                    '16/09/2025', // Week 3 - September
                    '23/09/2025', // Week 4 - September
                    '30/09/2025'  // Week 5 - September
                  ];
                  console.log(`📅 Using default September schedule for collector ${collectorId}:`, scheduleDates);
                }
              }
              
              console.log(`📅 Applying ${selectedMember?.name}'s installments to collector ${collectorId}'s schedule`);
              console.log(`🏢 Branch: ${selectedBranch?.name} (${selectedBranch?.code}) - All branches under collector ${collectorId} use the same schedule`);
              
              // ALWAYS apply collector schedule (don't check if scheduleDates.length > 0)
              // Spread installments across collection dates
              const dateIndex = index % scheduleDates.length;
              const dateStr = scheduleDates[dateIndex];
              
              // Parse date format DD/MM/YYYY
              const [parsedDay, parsedMonth, parsedYear] = dateStr.split('/');
              const scheduleDate = new Date(parseInt(parsedYear), parseInt(parsedMonth) - 1, parseInt(parsedDay));
              
              console.log(`🔧 Date parsing: ${dateStr} → Day: ${parsedDay}, Month: ${parsedMonth}, Year: ${parsedYear}`);
              console.log(`🔧 Date object created: ${scheduleDate.toString()}`);
              console.log(`🔧 ISO string: ${scheduleDate.toISOString().split('T')[0]}`);
              
              // If we need more installments than available dates, add weeks
              if (index >= scheduleDates.length) {
                const cycleNumber = Math.floor(index / scheduleDates.length);
                scheduleDate.setDate(scheduleDate.getDate() + (cycleNumber * 7 * scheduleDates.length));
              }
              
              // Fix timezone issue - use local date format instead of ISO
              const finalYear = scheduleDate.getFullYear();
              const finalMonth = String(scheduleDate.getMonth() + 1).padStart(2, '0');
              const finalDay = String(scheduleDate.getDate()).padStart(2, '0');
              dueDate = `${finalYear}-${finalMonth}-${finalDay}`;
              
              console.log(`🔧 Fixed timezone: ${scheduleDate.toString()} → ${dueDate}`);
              console.log(`📅 LOAN Installment #${index + 1} FORCED to collector schedule: ${dueDate} (using collector date: ${dateStr}, cycle: ${Math.floor(index / scheduleDates.length)})`);
              console.log(`🔧 Original installment date was: ${installment.date}, now using collector schedule: ${dueDate}`);
              
            } catch (error) {
              console.log('❌ Error in date scheduling:', error);
              console.log('📅 Using original date for installment', index + 1);
            }

            let updatedInstallment = {
              id: installmentId,
              serialNumber: index + 1,
              productName: 'Loan Installment',
              installmentNumber: index + 1,
              totalInstallments: loanInstallments.length,
              installmentType: 'loan',
              dueDate: dueDate,
              amount: installment.amount,
              paidAmount: paidAmount,
              remainingAmount: remainingAmount,
              status: status
            };
            
            console.log(`📋 Installment #${index + 1}: Amount ৳${installment.amount}, Paid: ৳${paidAmount}, Remaining: ৳${remainingAmount}, Status: ${status}`);
            
            
            // Apply additional localStorage collections (if any) on top of database collections
            // BUT ONLY if they don't conflict with database data
            if (collections.length > 0) {
              const localStorageCollected = collections.reduce((sum, c) => sum + c.amount, 0);
              console.log(`💾 Found localStorage collections: ৳${localStorageCollected} for installment #${index + 1}`);
              
              // Only apply localStorage if there are no database collections for this installment
              // This prevents double-counting when database already has the collection
              if (installmentCollections.length === 0) {
                const newPaidAmount = paidAmount + localStorageCollected;
                const newRemainingAmount = Math.max(0, installment.amount - newPaidAmount);
                
                let newStatus = 'due';
                if (newRemainingAmount <= 0) {
                  newStatus = 'paid';
                } else if (newPaidAmount > 0) {
                  newStatus = 'partial';
                }
                
                console.log(`💾 Applying localStorage (no DB conflict): ৳${localStorageCollected}, New total paid: ৳${newPaidAmount}, New remaining: ৳${newRemainingAmount}, Status: ${newStatus}`);
                
                updatedInstallment = {
                  ...updatedInstallment,
                  paidAmount: newPaidAmount,
                  remainingAmount: newRemainingAmount,
                  status: newStatus
                };
              } else {
                console.log(`💾 Skipping localStorage collections - database already has collections for installment #${index + 1}`);
              }
            }
            
            // Apply savings collections
            if (savings.length > 0) {
              const totalSavings = savings.reduce((sum, s) => sum + s.amount, 0);
              updatedInstallment = {
                ...updatedInstallment,
                savingsCollected: totalSavings,
                hasSavings: true
              };
            }
            
            return updatedInstallment;
          });
          
          console.log('✅ Using actual loan installments:', updatedInstallments);
          setMemberInstallments(updatedInstallments);
          setLoading(false);
          return;
        }
        
        // Filter product sales (installmentType: 'extra' and note contains 'Product Sale')
        const productSaleInstallments = response.data.filter(installment => 
          installment.installmentType === 'extra' && 
          installment.note && 
          installment.note.includes('Product Sale')
        );
        
        console.log('📦 Found product sale installments:', productSaleInstallments);
        
        // If no loan installments found, we're generating from product sales
        if (productSaleInstallments.length > 0) {
          console.log('⚠️ No loan installments found in database - generating schedule from product sales');
          console.log('💡 To show actual loan installments, loan data must be created in the system first');
        }
        
        // Process multiple products from single sale or multiple sales
        const allInstallments = [];
        let globalSerialCounter = 1;
        
        // Group products by sale date to handle multiple products in single sale
        const productSalesByDate = {};
        
        for (const productSale of productSaleInstallments) {
          const saleDate = new Date(productSale.collectionDate || productSale.createdAt).toDateString();
          if (!productSalesByDate[saleDate]) {
            productSalesByDate[saleDate] = [];
          }
          productSalesByDate[saleDate].push(productSale);
        }
        
        // Process each sale date
        for (const [saleDate, salesOnDate] of Object.entries(productSalesByDate)) {
          const baseSaleDate = new Date(saleDate);
          
          // Extract all products from this sale
          const productsInSale = [];
          
          for (const productSale of salesOnDate) {
            console.log('🔍 Processing product sale note:', productSale.note);
            
            // Try multiple note formats
            let productName = 'Unknown Product';
            let installmentCount = 12; // Default to 12 installments for demo
            let installmentAmount = productSale.amount;
            let installmentType = 'weekly';
            
            // Format 1: "Product Sale: Dal (Qty: 50, ৳7499.5), Rice cooker (Qty: 2, ৳5000) | Payment: installment (12 weekly installments)"
            const format1Match = productSale.note.match(/Product Sale: (.+?) \| Payment: (\w+) \((\d+) (\w+) installments\)/);
            
            // Format 2: "Product Sale: Rice Cooker | Qty: 2 kg | Payment: weekly (12 weekly installments)"
            const format2Match = productSale.note.match(/Product Sale: (.+?) \| Qty: (.+?) \| Payment: (\w+) \((\d+) (\w+) installments\)/);
            
            // Format 3: Simple format "Product Sale: Rice Cooker"
            const format3Match = productSale.note.match(/Product Sale: ([^|]+)/);
            
            if (format1Match) {
              console.log('📝 Using Format 1 parsing');
              productName = format1Match[1].trim();
              installmentType = format1Match[2];
              installmentCount = parseInt(format1Match[3]);
              installmentAmount = Math.ceil(productSale.amount / installmentCount);
            } else if (format2Match) {
              console.log('📝 Using Format 2 parsing');
              productName = format2Match[1].trim();
              installmentType = format2Match[3];
              installmentCount = parseInt(format2Match[4]);
              installmentAmount = Math.ceil(productSale.amount / installmentCount);
            } else if (format3Match) {
              console.log('📝 Using Format 3 parsing - defaulting to 12 weekly installments');
              productName = format3Match[1].trim();
              // Default to 12 weekly installments if no installment info found
              installmentCount = 12;
              installmentType = 'weekly';
              installmentAmount = Math.ceil(productSale.amount / installmentCount);
            } else {
              console.log('📝 Using fallback parsing');
              // Fallback - use the entire note as product name and default to 12 installments
              productName = productSale.note || 'Unknown Product';
              installmentCount = 12;
              installmentType = 'weekly';
              installmentAmount = Math.ceil(productSale.amount / installmentCount);
            }
            
            console.log(`📊 Parsed: Product: ${productName}, Count: ${installmentCount}, Type: ${installmentType}, Amount per installment: ${installmentAmount}`);
            
            productsInSale.push({
              productName: productName,
              installmentCount: installmentCount,
              installmentType: installmentType,
              installmentAmount: installmentAmount,
              totalAmount: productSale.amount,
              saleId: productSale._id,
              saleDate: baseSaleDate
            });
          }
          
          // Generate installments for all products in this sale
          const maxInstallments = Math.max(...productsInSale.map(p => p.installmentCount));
          console.log(`🔢 Max installments for this sale: ${maxInstallments}`);
          console.log('📦 Products in sale:', productsInSale);
          
          for (let i = 0; i < maxInstallments; i++) {
            for (const product of productsInSale) {
              if (i < product.installmentCount) {
                console.log(`📅 Creating installment ${i + 1}/${product.installmentCount} for ${product.productName}`);
                let dueDate = new Date(product.saleDate);
                
                // Apply collector schedule for weekly installments
                if (product.installmentType === 'weekly') {
                  try {
                    // Get collector schedule
                    const selectedCollectorData = JSON.parse(localStorage.getItem('selectedCollector') || '{}');
                    const collectorId = selectedCollectorData.id || selectedCollectorData._id || 'hayat';
                    
                    let scheduleDates = [];
                    const savedSchedule = localStorage.getItem(`collection_schedule_${collectorId}`);
                    
                    if (savedSchedule) {
                      const parsed = JSON.parse(savedSchedule);
                      scheduleDates = parsed.collectionDates || [];
                    } else {
                      // Use default collector schedule
                      scheduleDates = [
                        '02/09/2025', '09/09/2025', '16/09/2025', '23/09/2025', '30/09/2025'
                      ];
                    }
                    
                    if (scheduleDates.length > 0) {
                      // Use collector schedule dates
                      const dateIndex = i % scheduleDates.length;
                      const dateStr = scheduleDates[dateIndex];
                      const [productParsedDay, productParsedMonth, productParsedYear] = dateStr.split('/');
                      const scheduleDate = new Date(parseInt(productParsedYear), parseInt(productParsedMonth) - 1, parseInt(productParsedDay));
                      
                      console.log(`🔧 Product date parsing: ${dateStr} → Day: ${productParsedDay}, Month: ${productParsedMonth}, Year: ${productParsedYear} → Result: ${scheduleDate.toISOString().split('T')[0]}`);
                      
                      // Add weeks for cycling
                      if (i >= scheduleDates.length) {
                        const cycleNumber = Math.floor(i / scheduleDates.length);
                        scheduleDate.setDate(scheduleDate.getDate() + (cycleNumber * 7 * scheduleDates.length));
                      }
                      
                      // Fix timezone issue for product installments too
                      const productYear = scheduleDate.getFullYear();
                      const productMonth = String(scheduleDate.getMonth() + 1).padStart(2, '0');
                      const productDay = String(scheduleDate.getDate()).padStart(2, '0');
                      const fixedDate = `${productYear}-${productMonth}-${productDay}`;
                      
                      dueDate = new Date(fixedDate + 'T00:00:00');
                      console.log(`📅 Product installment #${i + 1} using collector schedule: ${fixedDate} (from ${dateStr})`);
                    } else {
                      // Fallback to regular weekly calculation
                      dueDate.setDate(product.saleDate.getDate() + (i * 7));
                    }
                  } catch (error) {
                    console.log('❌ Error applying collector schedule to product installment:', error);
                    // Fallback to regular weekly calculation
                    dueDate.setDate(product.saleDate.getDate() + (i * 7));
                  }
                } else if (product.installmentType === 'daily') {
                  dueDate.setDate(product.saleDate.getDate() + (i * 1));
                } else if (product.installmentType === 'monthly') {
                  dueDate.setMonth(product.saleDate.getMonth() + i);
                }
                
                // Determine status based on due date
                const today = new Date();
                const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                
                let status = 'upcoming';
                if (daysDiff >= 0 && daysDiff <= 7) {
                  status = 'due';
                } else if (daysDiff > 7) {
                  status = 'overdue';
                }
                
                // Demo: Some installments might be partial or paid
                let paidAmount = 0;
                let remainingAmount = product.installmentAmount;
                
                if (i === 0 && Math.random() > 0.7) {
                  paidAmount = Math.floor(product.installmentAmount * 0.6);
                  remainingAmount = product.installmentAmount - paidAmount;
                  status = paidAmount > 0 ? (remainingAmount > 0 ? 'partial' : 'paid') : status;
                }
                
                const installment = {
                  id: `${product.saleId}-${i}`,
                  serialNumber: globalSerialCounter++,
                  amount: product.installmentAmount,
                  dueDate: dueDate.toISOString().split('T')[0],
                  status: status,
                  paidAmount: paidAmount,
                  remainingAmount: remainingAmount,
                  type: 'Product Installment',
                  productName: product.productName,
                  productSaleId: product.saleId,
                  installmentNumber: i + 1,
                  totalInstallments: product.installmentCount,
                  installmentType: product.installmentType
                };
                
                allInstallments.push(installment);
              }
            }
          }
        }
        
        // Sort by due date
        allInstallments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        
        // Apply collected payments from localStorage
        const collectionKey = `collected_${selectedMember._id}`;
        const collectedPayments = JSON.parse(localStorage.getItem(collectionKey) || '[]');
        
        // Apply collected savings from localStorage
        const savingsKey = `savings_${selectedMember._id}`;
        const collectedSavings = JSON.parse(localStorage.getItem(savingsKey) || '[]');
        
        console.log('💾 Found collected payments in localStorage:', collectedPayments);
        console.log('💰 Found collected savings in localStorage:', collectedSavings);
        
        // Update installments with collected payments and savings
        const updatedInstallments = allInstallments.map(installment => {
          const collections = collectedPayments.filter(c => c.installmentId === installment.id);
          const savings = collectedSavings.filter(s => s.installmentId === installment.id);
          
          let updatedInstallment = { ...installment };
          
          // Apply installment collections
          if (collections.length > 0) {
            const totalCollected = collections.reduce((sum, c) => sum + c.amount, 0);
            const newRemainingAmount = installment.amount - totalCollected;
            
            let newStatus = 'paid';
            if (newRemainingAmount > 0) {
              newStatus = 'partial';
            }
            
            console.log(`💰 Applying collections to installment #${installment.serialNumber}: Collected: ৳${totalCollected}, Remaining: ৳${newRemainingAmount}`);
            
            updatedInstallment = {
              ...updatedInstallment,
              paidAmount: totalCollected,
              remainingAmount: Math.max(0, newRemainingAmount),
              status: newStatus
            };
          }
          
          // Apply savings collections
          if (savings.length > 0) {
            const totalSavings = savings.reduce((sum, s) => sum + s.amount, 0);
            console.log(`💰 Applying savings to installment #${installment.serialNumber}: Savings: ৳${totalSavings}`);
            
            updatedInstallment = {
              ...updatedInstallment,
              savingsCollected: totalSavings,
              hasSavings: true
            };
          }
          
          return updatedInstallment;
        });
        
        console.log('✅ Generated installment schedule with collections applied:', updatedInstallments);
        setMemberInstallments(updatedInstallments);
      } else {
        console.log('❌ No installment data found');
        setMemberInstallments([]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading member installments:', error);
      setMemberInstallments([]);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInstallmentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInstallmentSelect = (installment) => {
    setSelectedInstallment(installment);
    setInstallmentData(prev => ({
      ...prev,
      amount: installment.remainingAmount.toString(),
      type: installment.type.toLowerCase().replace(' ', '_'),
      notes: `${installment.productName} - Installment ${installment.installmentNumber}/${installment.totalInstallments} (${installment.installmentType}) - Serial #${installment.serialNumber}`
    }));
  };

  const handlePaymentTypeChange = (type) => {
    setInstallmentData(prev => ({
      ...prev,
      paymentType: type,
      amount: type === 'full' && selectedInstallment 
        ? selectedInstallment.remainingAmount.toString() 
        : ''
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'due': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'partial': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'due': return '⏰';
      case 'overdue': return '🚨';
      case 'partial': return '⚠️';
      case 'upcoming': return '📅';
      case 'paid': return '✅';
      default: return '📋';
    }
  };

  const handleInstallmentCollection = async (installment, paymentType) => {
    if (paymentType === 'partial') {
      // Show partial payment modal
      setSelectedInstallment(installment);
      setShowPartialModal(true);
    } else {
      // Collect full payment
      await collectInstallment(installment, installment.remainingAmount, 'Full payment');
    }
  };

  const handleSavingsCollection = async (installment) => {
    // Show a prompt to enter savings amount
    const amount = prompt(`Enter savings amount for ${installment.productName} - Installment #${installment.serialNumber}:`);
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      if (amount !== null) { // Only show error if user didn't cancel
        toast.error('Please enter a valid savings amount');
      }
      return;
    }

    const savingsAmount = parseFloat(amount);
    const description = `Savings collection for ${installment.productName} - Installment #${installment.serialNumber}`;
    
    await collectInstallment(null, savingsAmount, description, 'savings');
  };

  const updateInstallmentStatus = (installmentId, collectedAmount) => {
    console.log(`🔍 Looking for installment ID: ${installmentId} to update with amount: ${collectedAmount}`);
    
    setMemberInstallments(prevInstallments => {
      console.log('📋 Current installments before update:', prevInstallments.length);
      
      const updatedInstallments = prevInstallments.map(installment => {
        if (installment.id === installmentId) {
          const newPaidAmount = installment.paidAmount + collectedAmount;
          const newRemainingAmount = installment.amount - newPaidAmount;
          
          let newStatus = 'paid';
          if (newRemainingAmount > 0) {
            newStatus = 'partial';
          }
          
          console.log(`📊 FOUND & UPDATING installment #${installment.serialNumber}:`);
          console.log(`   - Previous: Paid: ৳${installment.paidAmount}, Remaining: ৳${installment.remainingAmount}, Status: ${installment.status}`);
          console.log(`   - New: Paid: ৳${newPaidAmount}, Remaining: ৳${Math.max(0, newRemainingAmount)}, Status: ${newStatus}`);
          
          return {
            ...installment,
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(0, newRemainingAmount),
            status: newStatus
          };
        }
        return installment;
      });
      
      console.log('✅ Installments updated, returning new state');
      return updatedInstallments;
    });
  };

  const collectInstallment = async (installment, amount, description, type = 'installment') => {
    setIsSubmitting(true);
    const loadingToast = toast.loading(`Collecting ${type}...`);

    try {
      // Get current date info for required fields
      const currentDate = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[currentDate.getDay()];
      const weekNumber = Math.ceil(currentDate.getDate() / 7);
      const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      const collectionData = {
        memberId: selectedMember._id,
        amount: amount,
        installmentType: type === 'savings' ? 'extra' : 'regular',
        collectionDay: currentDay,
        paymentMethod: 'cash',
        weekNumber: weekNumber,
        monthYear: monthYear,
        note: installment ? 
          `${installment.productName} - Installment ${installment.installmentNumber}/${installment.totalInstallments} - ${description}` :
          `Savings Collection: ${description}`,
        receiptNumber: `RC-${Date.now()}`,
        branchCode: selectedBranch.code || selectedBranch.branchCode,
        branch: selectedBranch.name
      };

      console.log('📤 Collecting:', collectionData);

      const response = await installmentsAPI.collect(collectionData);
      toast.dismiss(loadingToast);

      if (response.success) {
        let successMessage = '';
        if (type === 'savings') {
          successMessage = `Savings of ৳${amount} collected successfully! 💰`;
        } else if (installment && amount < installment.remainingAmount) {
          const remaining = installment.remainingAmount - amount;
          successMessage = `Partial payment of ৳${amount} collected! Remaining due: ৳${remaining.toFixed(2)}`;
        } else {
          successMessage = `Installment of ৳${amount} collected successfully!`;
        }
        
        toast.success(successMessage);
        
        // Update installment status locally for immediate feedback
        if (installment) {
          console.log(`🎯 Updating installment status for ID: ${installment.id}, Amount: ${amount}`);
          updateInstallmentStatus(installment.id, amount);
          console.log('✅ Local status updated successfully');
          
          // Store collection in localStorage for immediate UI feedback (temporary)
          const collectionKey = `collected_${selectedMember._id}`;
          const existingCollections = JSON.parse(localStorage.getItem(collectionKey) || '[]');
          
          const newCollection = {
            installmentId: installment.id,
            amount: amount,
            collectedAt: new Date().toISOString(),
            serialNumber: installment.serialNumber
          };
          
          existingCollections.push(newCollection);
          localStorage.setItem(collectionKey, JSON.stringify(existingCollections));
          
          console.log('💾 Temporarily saved collection to localStorage for UI feedback:', newCollection);
        }
        
        // For savings collection, track which installment it was collected from
        if (type === 'savings' && installment) {
          const savingsKey = `savings_${selectedMember._id}`;
          const existingSavings = JSON.parse(localStorage.getItem(savingsKey) || '[]');
          
          const newSavingsCollection = {
            installmentId: installment.id,
            amount: amount,
            collectedAt: new Date().toISOString(),
            serialNumber: installment.serialNumber,
            description: description
          };
          
          existingSavings.push(newSavingsCollection);
          localStorage.setItem(savingsKey, JSON.stringify(existingSavings));
          
          console.log('💰 Saved savings collection to localStorage:', newSavingsCollection);
          console.log('💰 Refreshing member data to update current savings...');
          onInstallmentCollected(); // This will refresh member data including current savings
        }
        
        // Always refresh installment data from server to get updated status
        console.log('🔄 Refreshing installment data from server...');
        setTimeout(async () => {
          try {
            // First reload from database without clearing localStorage
            console.log('🔄 Reloading fresh data from database...');
            await loadMemberInstallments();
            
            // Wait a bit more for database to fully process
            setTimeout(async () => {
              // Verify database has the collection before clearing localStorage
              try {
                const verifyResponse = await installmentsAPI.getByMember(selectedMember._id);
                if (verifyResponse.success && verifyResponse.data) {
                  console.log('🔍 Verifying collection in database...');
                  console.log('🔍 Looking for amount:', amount, 'for member:', selectedMember.name);
                  console.log('🔍 Database records:', verifyResponse.data.length);
                  
                  // Check if our collection is in the database
                  const hasCollection = verifyResponse.data.some(record => {
                    const amountMatch = record.amount === amount;
                    const timeMatch = Math.abs(new Date(record.createdAt || record.date) - new Date()) < 120000; // Within last 2 minutes
                    
                    // Check multiple possible member ID field names and handle object references
                    let memberIdField;
                    if (record.memberId) {
                      memberIdField = record.memberId;
                    } else if (record.member) {
                      // Handle both string ID and object reference
                      memberIdField = typeof record.member === 'object' ? record.member._id || record.member.id : record.member;
                    } else if (record.memberID) {
                      memberIdField = record.memberID;
                    } else if (record.Member) {
                      memberIdField = typeof record.Member === 'object' ? record.Member._id || record.Member.id : record.Member;
                    }
                    
                    const memberMatch = memberIdField === selectedMember._id;
                    
                    console.log(`🔍 Checking record: Amount ${record.amount} (match: ${amountMatch}), Member ${memberIdField} (match: ${memberMatch}), Time match: ${timeMatch}`);
                    console.log(`🔍 Record member field type:`, typeof record.member, record.member);
                    
                    return amountMatch && timeMatch && memberMatch;
                  });
                  
                  if (hasCollection) {
                    console.log('✅ Collection verified in database - safe to clear localStorage');
                    
                    // Clear localStorage only after verification
                    const collectionKey = `collected_${selectedMember._id}`;
                    const savingsKey = `savings_${selectedMember._id}`;
                    
                    localStorage.removeItem(collectionKey);
                    localStorage.removeItem(savingsKey);
                    
                    // Final reload to ensure clean state
                    await loadMemberInstallments();
                    console.log('✅ Final refresh completed - localStorage cleared');
                  } else {
                    console.log('⚠️ Collection not yet in database - keeping localStorage for persistence');
                    console.log('⚠️ This ensures UI shows COLLECTED status until database is ready');
                  }
                }
              } catch (error) {
                console.error('❌ Error verifying database:', error);
                console.log('⚠️ Keeping localStorage due to verification error');
                // Keep localStorage if verification fails
              }
            }, 3000);
            
          } catch (error) {
            console.error('❌ Error during database refresh:', error);
            // Keep localStorage if database refresh fails
          }
        }, 2000);
        
        // Close partial modal if open
        if (showPartialModal) {
          setShowPartialModal(false);
          setSelectedInstallment(null);
        }
      } else {
        toast.error(response.message || 'Failed to collect payment');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error collecting payment:', error);
      toast.error('Failed to collect payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-3xl mx-4 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <h3 className="text-xl font-bold text-gray-800">Collect Installment</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Member Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
                👤
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">Member</p>
                <p className="text-green-800 font-semibold">{selectedMember.name}</p>
              </div>
            </div>
            
            {/* Total Due Amount */}
            <div className="text-right">
              <p className="text-sm text-red-600 font-medium">Total Due Amount</p>
              <p className="text-red-800 font-bold text-lg">
                ৳{memberInstallments.reduce((total, installment) => 
                  total + (installment.remainingAmount || 0), 0
                )}
              </p>
              <p className="text-xs text-red-600">
                {memberInstallments.filter(inst => inst.status !== 'paid').length} installments pending
              </p>
            </div>
          </div>
        </div>

        {/* Branch Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
          <div className="flex items-center">
            <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
              🏢
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Branch</p>
              <p className="text-blue-800 font-semibold">{selectedBranch.code} - {selectedBranch.name}</p>
            </div>
          </div>
        </div>

        {/* Collector Schedule Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
          <div className="flex items-center">
            <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
              📅
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-600 font-medium">Collector Schedule Applied</p>
              <p className="text-green-800 font-semibold">All branches under this collector use the same installment dates</p>
              <p className="text-xs text-green-600 mt-1">
                Dates: {(() => {
                  try {
                    const selectedCollectorData = JSON.parse(localStorage.getItem('selectedCollector') || '{}');
                    const collectorId = selectedCollectorData.id || selectedCollectorData._id || 'hayat';
                    const savedSchedule = localStorage.getItem(`collection_schedule_${collectorId}`);
                    
                    if (savedSchedule) {
                      const parsed = JSON.parse(savedSchedule);
                      const scheduleDates = parsed.collectionDates || [];
                      if (scheduleDates.length > 0) {
                        return scheduleDates.join(', ');
                      }
                    }
                    return '02/09/2025, 09/09/2025, 16/09/2025, 23/09/2025, 30/09/2025';
                  } catch (error) {
                    return '02/09/2025, 09/09/2025, 16/09/2025, 23/09/2025, 30/09/2025';
                  }
                })()}
              </p>
            </div>
          </div>
        </div>


  
        {/* Enhanced Installment Schedule - Full Page Display */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="text-gray-600 mt-4 text-lg">Loading installments...</p>
          </div>
        ) : memberInstallments.length > 0 ? (
          <div className="space-y-6">
            {/* Group installments by product name */}
            {(() => {
              // Group by product name
              const grouped = memberInstallments.reduce((acc, inst) => {
                const productName = inst.productName || 'Unknown Product';
                if (!acc[productName]) {
                  acc[productName] = [];
                }
                acc[productName].push(inst);
                return acc;
              }, {});
              
              // Render each product group
              return Object.entries(grouped).map(([productName, installments], groupIndex) => (
                <div key={productName} className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                  {/* Product Group Header */}
                  <div className="mb-4 pb-3 border-b-2 border-gray-300">
                    <h3 className="text-lg font-bold text-gray-800">
                      Type {groupIndex + 1}: {productName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {installments.length} installments • ৳{installments[0]?.amount || 0} each
                    </p>
                  </div>
                  
                  {/* Installments in this group */}
                  <div className="space-y-3">
                    {installments.map((installment) => (
            <div
              key={installment.id}
              className={`p-4 border rounded-lg transition-all ${getStatusColor(installment.status)} hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getStatusIcon(installment.status)}</span>
                    <span className="text-xl font-bold text-gray-800">#{installment.serialNumber}</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-800 text-lg">{installment.productName}</h5>
                    <p className="text-sm text-gray-600">
                      Due: {installment.dueDate} • ({installment.installmentNumber}/{installment.totalInstallments} - {installment.installmentType})
                    </p>
                    {installment.paidAmount > 0 && (
                      <p className="text-sm text-green-600">Paid: ৳{installment.paidAmount}</p>
                    )}
                    {installment.hasSavings && (
                      <p className="text-sm text-purple-600">💰 Savings Collected: ৳{installment.savingsCollected}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-800">৳{installment.remainingAmount}</p>
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(installment.status)}`}>
                      {installment.status.toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                  {installment.status !== 'paid' && installment.remainingAmount > 0 ? (
                    <>
                      <button
                        onClick={() => handleInstallmentCollection(installment, 'full')}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        Full Payment (৳{installment.remainingAmount})
                      </button>
                      {installment.remainingAmount > 1 && (
                        <button
                          onClick={() => handleInstallmentCollection(installment, 'partial')}
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          Partial Payment
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">✅</span>
                      <span className="text-green-600 font-medium">COLLECTED</span>
                    </div>
                  )}
                  
                  {/* Individual Savings Collection Button for each installment */}
                  <button
                    onClick={() => handleSavingsCollection(installment)}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    💰 Collect Savings
                  </button>
                </div>
                </div>
              </div>
            </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">📋 No installments found for this member</p>
          </div>
        )}
        
        {/* Partial Payment Modal */}
        {showPartialModal && selectedInstallment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Partial Payment</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  {selectedInstallment.productName} - Installment #{selectedInstallment.serialNumber}
                </p>
                <p className="text-sm text-gray-600">
                  Total Due: ৳{selectedInstallment.remainingAmount}
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Partial Amount (৳) *
                </label>
                <input
                  type="number"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter partial amount"
                  min="0.01"
                  max={selectedInstallment.remainingAmount}
                  step="0.01"
                />
                {partialAmount && parseFloat(partialAmount) > 0 && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                    <p className="text-orange-800">
                      Collecting: ৳{partialAmount}
                    </p>
                    <p className="text-orange-600">
                      Remaining: ৳{(selectedInstallment.remainingAmount - parseFloat(partialAmount)).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowPartialModal(false);
                    setSelectedInstallment(null);
                    setPartialAmount('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const amount = parseFloat(partialAmount);
                    if (amount > 0 && amount <= selectedInstallment.remainingAmount) {
                      collectInstallment(selectedInstallment, amount, 'Partial payment');
                      setPartialAmount('');
                    } else {
                      toast.error('Please enter a valid amount');
                    }
                  }}
                  disabled={!partialAmount || parseFloat(partialAmount) <= 0}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  Collect Partial
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectInstallmentForm;
