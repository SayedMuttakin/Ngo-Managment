import React from 'react';
import { formatBDDateShort, formatBDDateLong, getCurrentBDDateTime } from '../utils/dateUtils';

const DateTest = () => {
  const testDate = new Date('2025-10-10T18:00:00Z'); // 10 Oct 2025, 6 PM UTC
  const now = new Date();
  const bdNow = getCurrentBDDateTime();

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      margin: '20px',
      borderRadius: '10px',
      fontFamily: 'monospace'
    }}>
      <h2 style={{ color: '#333' }}>🕐 Date Utils Test</h2>
      
      <div style={{ marginTop: '15px' }}>
        <h3 style={{ color: '#666' }}>Test Date: 2025-10-10T18:00:00Z (UTC)</h3>
        <p><strong>formatBDDateShort:</strong> {formatBDDateShort(testDate)}</p>
        <p><strong>formatBDDateLong:</strong> {formatBDDateLong(testDate)}</p>
        <p style={{ fontSize: '12px', color: '#999' }}>
          ℹ️ Should show 11/10/2025 because UTC 6 PM = Bangladesh midnight (next day)
        </p>
      </div>

      <div style={{ marginTop: '15px', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
        <h3 style={{ color: '#666' }}>Current Time</h3>
        <p><strong>System UTC:</strong> {now.toISOString()}</p>
        <p><strong>BD Time (converted):</strong> {bdNow.toISOString()}</p>
        <p><strong>BD Date (formatted):</strong> {formatBDDateShort(now)}</p>
        <p style={{ fontSize: '12px', color: '#999' }}>
          ℹ️ Current UTC time: {now.toISOString()}<br/>
          ℹ️ BD Time should be 6 hours ahead
        </p>
      </div>

      <div style={{ marginTop: '15px', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
        <h3 style={{ color: '#666' }}>Debug Info</h3>
        <p><strong>Browser Timezone:</strong> {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        <p><strong>UTC Offset:</strong> {new Date().getTimezoneOffset() / 60} hours</p>
      </div>
    </div>
  );
};

export default DateTest;
