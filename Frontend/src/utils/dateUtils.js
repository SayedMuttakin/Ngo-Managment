/**
 * Date utility functions for Bangladesh timezone (UTC+6)
 */

// Bangladesh timezone offset in hours
const BD_TIMEZONE_OFFSET = 6;

/**
 * Convert date to Bangladesh time (returns Date object)
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date object adjusted for Bangladesh timezone
 */
export const toBDTime = (date) => {
  if (!date) return null;
  
  try {
    const inputDate = new Date(date);
    
    // Get the date string in Bangladesh timezone
    const bdDateString = inputDate.toLocaleString("en-CA", {
      timeZone: "Asia/Dhaka",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Convert back to Date object
    return new Date(bdDateString);
  } catch (error) {
    console.error('Error converting to BD time:', error);
    return new Date(date);
  }
};

/**
 * Format date to Bangladesh timezone string
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in BD time
 */
export const formatBDDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  try {
    const inputDate = new Date(date);
    
    // Default options for date formatting with Bangladesh timezone
    const defaultOptions = {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...options
    };
    
    return inputDate.toLocaleDateString('en-GB', defaultOptions);
  } catch (error) {
    console.error('Error formatting BD date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format date and time to Bangladesh timezone string
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted datetime string in BD time
 */
export const formatBDDateTime = (date, options = {}) => {
  if (!date) return 'N/A';
  
  try {
    const inputDate = new Date(date);
    
    // Default options for datetime formatting with Bangladesh timezone
    const defaultOptions = {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    };
    
    return inputDate.toLocaleString('en-GB', defaultOptions);
  } catch (error) {
    console.error('Error formatting BD datetime:', error);
    return 'Invalid Date';
  }
};

/**
 * Get current date in Bangladesh timezone (formatted as YYYY-MM-DD)
 * @returns {string} Current date in BD timezone
 */
export const getCurrentBDDate = () => {
  const now = new Date();
  
  // Get the current date in Bangladesh timezone using Intl API
  const bdDateString = now.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return bdDateString; // Already in YYYY-MM-DD format due to 'en-CA' locale
};

/**
 * Get current datetime in Bangladesh timezone
 * @returns {Date} Current datetime in BD timezone
 */
export const getCurrentBDDateTime = () => {
  const now = new Date();
  // Get current datetime in Bangladesh timezone using Intl API
  const bdDateTimeString = now.toLocaleString('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return new Date(bdDateTimeString);
};

/**
 * Format date in DD/MM/YYYY format (Bangladesh standard)
 * @param {Date|string} date - Date to format
 * @returns {string} Date in DD/MM/YYYY format
 */
export const formatBDDateShort = (date) => {
  if (!date) return 'N/A';
  
  try {
    const inputDate = new Date(date);
    
    // Use toLocaleDateString with Asia/Dhaka timezone directly
    const bdDateString = inputDate.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    return bdDateString; // Already in DD/MM/YYYY format
  } catch (error) {
    console.error('Error formatting BD date short:', error);
    return 'Invalid Date';
  }
};

/**
 * Format date in long format (e.g., "10 October 2025")
 * @param {Date|string} date - Date to format
 * @returns {string} Date in long format
 */
export const formatBDDateLong = (date) => {
  if (!date) return 'N/A';
  
  try {
    const inputDate = new Date(date);
    return inputDate.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting BD date long:', error);
    return 'Invalid Date';
  }
};

/**
 * Get relative time string (e.g., "2 days ago", "in 3 hours")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
  if (!date) return 'N/A';
  
  try {
    const bdNow = getCurrentBDDateTime();
    const bdDate = toBDTime(date);
    const diffMs = bdNow - bdDate;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else {
      return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    }
  } catch (error) {
    console.error('Error getting relative time:', error);
    return 'N/A';
  }
};

/**
 * Check if a date is today in Bangladesh timezone
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is today in BD timezone
 */
export const isBDToday = (date) => {
  if (!date) return false;
  
  try {
    const bdNow = getCurrentBDDateTime();
    const bdDate = toBDTime(date);
    
    return (
      bdDate.getDate() === bdNow.getDate() &&
      bdDate.getMonth() === bdNow.getMonth() &&
      bdDate.getFullYear() === bdNow.getFullYear()
    );
  } catch (error) {
    return false;
  }
};

export default {
  toBDTime,
  formatBDDate,
  formatBDDateTime,
  formatBDDateShort,
  formatBDDateLong,
  getCurrentBDDate,
  getCurrentBDDateTime,
  getRelativeTime,
  isBDToday
};
