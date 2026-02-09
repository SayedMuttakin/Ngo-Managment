const axios = require('axios');
const smsConfig = require('../config/sms.config');

class SMSService {
  constructor() {
    this.apiKey = smsConfig.BULKSMSBD_API_KEY;
    this.senderId = smsConfig.BULKSMSBD_SENDER_ID;
    this.apiUrl = smsConfig.BULKSMSBD_API_URL;
    this.settings = smsConfig.settings;
  }

  /**
   * Format phone number for BulkSMSBD (Local Bangladesh format: 01XXXXXXXX)
   */
  formatPhoneNumber(phone) {
    // Remove all non-digits
    phone = phone.replace(/\D/g, '');
    
    // Convert to local Bangladesh format (01XXXXXXXX)
    if (phone.startsWith('88')) {
      // Remove country code 88 if present
      phone = phone.substring(2);
    }
    
    // Ensure it starts with 0 (local format)
    if (!phone.startsWith('0')) {
      phone = '0' + phone;
    }
    
    // BulkSMSBD works with local format: 01XXXXXXXX (tested and confirmed)
    return phone;
  }

  /**
   * Send SMS via BulkSMSBD API
   */
  async sendSMS(phoneNumber, message) {
    try {
      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Check if SMS is enabled
      if (!this.settings.enableSMS) {
        console.log('SMS disabled - would have sent:', { phone: formattedPhone, message });
        return { success: true, testMode: true };
      }

      // Test mode - don't actually send
      if (this.settings.testMode) {
        console.log('TEST MODE - SMS Details:');
        console.log('Phone:', formattedPhone);
        console.log('Message:', message);
        return { success: true, testMode: true };
      }

      // Prepare request data for BulkSMSBD
      const requestData = {
        api_key: this.apiKey,
        senderid: this.senderId,
        number: formattedPhone,  // Use 'number' for single SMS (not 'numbers')
        message: message,
        type: 'text'  // Adding type parameter as recommended by BulkSMSBD
      };

      // Send SMS via BulkSMSBD API
      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Log the response
      console.log('SMS sent successfully:', {
        phone: formattedPhone,
        response: response.data
      });

      return {
        success: true,
        data: response.data,
        phone: formattedPhone
      };

    } catch (error) {
      console.error('SMS sending failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   */
  async sendBulkSMS(recipients, messageTemplate) {
    const results = [];
    
    for (const recipient of recipients) {
      const { phone, ...data } = recipient;
      const message = typeof messageTemplate === 'function' 
        ? messageTemplate(data)
        : messageTemplate;
      
      const result = await this.sendSMS(phone, message);
      results.push({
        phone,
        ...result
      });
      
      // Add delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Send due reminder SMS with detailed information
   */
  async sendDueReminder(data, language = 'bengali') {
    const template = smsConfig.templates.dueReminder[language];
    const message = typeof template === 'function' ? template(data) : template;
    return await this.sendSMS(data.phone, message);
  }

  /**
   * Send overdue reminder SMS with detailed breakdown
   */
  async sendOverdueReminder(data, language = 'bengali') {
    const template = smsConfig.templates.overdueReminder[language];
    const message = typeof template === 'function' ? template(data) : template;
    return await this.sendSMS(data.phone, message);
  }

  /**
   * Send payment confirmation SMS with payment type
   */
  async sendPaymentConfirmation(data) {
    const template = smsConfig.templates.paymentConfirmation.bengali;
    const message = typeof template === 'function' ? template(data) : template;
    return await this.sendSMS(data.phone, message);
  }

  /**
   * Get SMS statistics (for dashboard)
   */
  async getSMSStats() {
    // This would typically query a database of sent messages
    return {
      sentToday: 0,
      sentThisWeek: 0,
      sentThisMonth: 0,
      failedToday: 0
    };
  }

  /**
   * Check SMS balance from BulkSMSBD
   */
  async checkBalance() {
    try {
      // BulkSMSBD balance check endpoint
      const balanceUrl = 'http://bulksmsbd.net/api/getBalanceApi';
      
      const response = await axios.get(balanceUrl, {
        params: {
          api_key: this.apiKey
        }
      });

      console.log('SMS Balance Response:', response.data);

      // BulkSMSBD returns balance in different formats
      // Usually returns: {"balance":"500"} or {"balance":500}
      let balance = 0;
      
      if (response.data.balance !== undefined) {
        balance = parseFloat(response.data.balance);
      } else if (typeof response.data === 'string') {
        // Sometimes it returns plain text
        const match = response.data.match(/\d+/);
        if (match) balance = parseFloat(match[0]);
      }

      return {
        success: true,
        balance: balance,
        currency: 'BDT',
        provider: 'BulkSMSBD'
      };

    } catch (error) {
      console.error('Balance check failed:', error.message);
      return {
        success: false,
        error: error.message,
        balance: 0
      };
    }
  }
}

module.exports = new SMSService();
