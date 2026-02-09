/**
 * Calculate all dates for a specific day of week in a given month
 * @param {string} dayName - Day name (e.g., 'Saturday', 'Sunday')
 * @param {number} month - Month (0-11, where 0 = January)
 * @param {number} year - Year (e.g., 2025)
 * @returns {Array<string>} Array of dates in DD/MM/YYYY format
 */
function getDatesForDayInMonth(dayName, month, year) {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.indexOf(dayName);
  
  if (targetDayIndex === -1) {
    throw new Error(`Invalid day name: ${dayName}`);
  }

  const dates = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Find all occurrences of the target day in the month
  for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    if (date.getDay() === targetDayIndex) {
      const day = String(date.getDate()).padStart(2, '0');
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const yearStr = date.getFullYear();
      dates.push(`${day}/${monthStr}/${yearStr}`);
    }
  }

  return dates;
}

/**
 * Calculate all dates for a specific day of week starting from a date
 * @param {string} dayName - Day name (e.g., 'Saturday', 'Sunday')
 * @param {Date} startDate - Starting date
 * @param {number} count - Number of dates to generate
 * @returns {Array<string>} Array of dates in DD/MM/YYYY format
 */
function getNextDatesForDay(dayName, startDate, count) {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.indexOf(dayName);
  
  if (targetDayIndex === -1) {
    throw new Error(`Invalid day name: ${dayName}`);
  }

  const dates = [];
  let currentDate = new Date(startDate);
  
  // Find the next occurrence of target day
  while (currentDate.getDay() !== targetDayIndex) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Generate the requested number of dates
  for (let i = 0; i < count; i++) {
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    dates.push(`${day}/${month}/${year}`);
    
    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return dates;
}

/**
 * Parse date string in DD/MM/YYYY format to Date object
 * @param {string} dateStr - Date string in DD/MM/YYYY format
 * @returns {Date} Date object
 */
function parseDateString(dateStr) {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format Date object to DD/MM/YYYY string
 * @param {Date} date - Date object
 * @returns {string} Date string in DD/MM/YYYY format
 */
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = {
  getDatesForDayInMonth,
  getNextDatesForDay,
  parseDateString,
  formatDate
};
