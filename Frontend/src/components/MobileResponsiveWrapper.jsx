import React from 'react';

const MobileResponsiveWrapper = ({ children, className = '', noPadding = false }) => {
  return (
    <div 
      className={`
        ${noPadding ? '' : 'p-2 sm:p-4 md:p-6'} 
        ${className}
        max-w-full overflow-x-hidden
      `}
    >
      {children}
    </div>
  );
};

export default MobileResponsiveWrapper;