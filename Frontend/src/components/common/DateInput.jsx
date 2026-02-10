import React from 'react';

/**
 * Custom Date Input Component
 * Displays date in DD-MM-YYYY format (Bangladesh format)
 * But stores value in YYYY-MM-DD format for consistency
 */
const DateInput = ({ value, onChange, disabled, className, placeholder, min, max, ...rest }) => {
  // Convert YYYY-MM-DD to DD-MM-YYYY for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  // Convert DD-MM-YYYY to YYYY-MM-DD for storage
  const parseInputDate = (displayDate) => {
    if (!displayDate) return '';
    const cleaned = displayDate.replace(/[^\d-]/g, '');
    const parts = cleaned.split('-');
    
    if (parts.length === 3) {
      const [day, month, year] = parts;
      if (year?.length === 4 && month?.length <= 2 && day?.length <= 2) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return '';
  };

  // Handle input change
  const handleChange = (e) => {
    let input = e.target.value;
    
    // Auto-add dashes
    input = input.replace(/\D/g, ''); // Remove non-digits
    
    if (input.length >= 2) {
      input = input.slice(0, 2) + '-' + input.slice(2);
    }
    if (input.length >= 5) {
      input = input.slice(0, 5) + '-' + input.slice(5, 9);
    }
    
    e.target.value = input;
    
    // If complete date (DD-MM-YYYY), convert to YYYY-MM-DD and call onChange
    if (input.length === 10) {
      const isoDate = parseInputDate(input);
      if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        onChange({ target: { value: isoDate } });
      }
    } else if (input.length === 0) {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <input
      type="text"
      value={value ? formatDisplayDate(value) : ''}
      onChange={handleChange}
      disabled={disabled}
      className={className}
      placeholder={placeholder || 'DD-MM-YYYY'}
      maxLength="10"
      {...rest}
    />
  );
};

export default DateInput;
