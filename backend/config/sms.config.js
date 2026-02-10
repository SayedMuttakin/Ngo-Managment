// BulkSMSBD Configuration
module.exports = {
  // BulkSMSBD API credentials
  BULKSMSBD_API_KEY: process.env.BULKSMSBD_API_KEY || 'YOUR_API_KEY',
  BULKSMSBD_SENDER_ID: process.env.BULKSMSBD_SENDER_ID || 'YOUR_SENDER_ID',
  
  // BulkSMSBD API endpoints
  BULKSMSBD_API_URL: process.env.BULKSMSBD_API_URL || 'http://bulksmsbd.net/api/smsapi',
  
  // SMS Templates
  templates: {
    dueReminder: {
      bengali: (data) => {
        const { weeklyAmount, totalOverdue, weeksMissed, totalRemaining } = data;
        // ✅ OPTIMIZED SMS - Multi-line format for better readability
        return `কিস্তি ৳${weeklyAmount} বাকি,\nবকেয়া স্থিতি: ৳${totalOverdue},\nমোট পাওনা: ৳${totalRemaining}\n-সাজঘর`;
      },
      
      english: (memberName, amount, dueDate) =>
        `Dear ${memberName},\n` +
        `Your installment of ৳${amount} is due.\n` +
        `Due Date: ${dueDate}\n` +
        `Please pay on time.\n` +
        `- Satrong Sajghor Traders`
    },
    
    overdueReminder: {
      bengali: (data) => {
        const { memberName, totalOverdue, totalRemaining, weeksMissed, productDetails } = data;
        let message = `প্রিয় ${memberName},\n`;
        message += `বকেয়া স্থিতি: ৳${totalOverdue} (${weeksMissed} সপ্তাহ)\n`;
        message += `মোট পাওনা: ৳${totalRemaining}\n`;
        
        // Add product-wise breakdown if available
        if (productDetails && productDetails.length > 0) {
          message += `পণ্য ভিত্তিক বকেয়া:\n`;
          productDetails.forEach(product => {
            message += `- ${product.name}: ৳${product.overdue}\n`;
          });
        }
        
        message += `জরুরি ভিত্তিতে পরিশোধ করুন।\n`;
        message += `- সাত্রং সাজঘর ট্রেডার্স`;
        return message;
      },
      
      english: (memberName, amount, daysOverdue) =>
        `Dear ${memberName},\n` +
        `Your installment of ৳${amount} is overdue by ${daysOverdue} days.\n` +
        `Please pay urgently.\n` +
        `- Satrong Sajghor Traders`
    },
    
    paymentConfirmation: {
      bengali: (data) => {
        const { memberName, paidAmount, remainingOverdue, totalRemaining, paymentType } = data;
        let message = `ধন্যবাদ ${memberName}!\n`;
        
        if (paymentType === 'partial') {
          message += `আংশিক পেমেন্ট: ৳${paidAmount}\n`;
        } else {
          message += `পরিশোধ: ৳${paidAmount}\n`;
        }
        
        if (remainingOverdue > 0) {
          message += `বর্তমান বকেয়া: ৳${remainingOverdue}\n`;
        }
        
        message += `মোট পাওনা: ৳${totalRemaining}\n`;
        message += `- সাত্রং সাজঘর ট্রেডার্স`;
        return message;
      }
    }
  },
  
  // SMS settings
  settings: {
    enableSMS: true,
    testMode: false, // false = Real SMS পাঠাবে (Production Mode ON)
    defaultLanguage: 'bengali',
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    
    // Bangladesh time settings
    timezone: 'Asia/Dhaka',
    scheduledTime: {
      hour: 21, // 9 PM Bangladesh time
      minute: 0
    }
  }
};