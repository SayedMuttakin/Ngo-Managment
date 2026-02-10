import React from 'react';

// Responsive Grid Component
export const ResponsiveGrid = ({ children, cols = { sm: 1, md: 2, lg: 3, xl: 4 } }) => {
  const gridClasses = `
    grid 
    grid-cols-${cols.sm || 1} 
    sm:grid-cols-${cols.sm || 1} 
    md:grid-cols-${cols.md || 2} 
    lg:grid-cols-${cols.lg || 3} 
    xl:grid-cols-${cols.xl || 4}
    gap-2 sm:gap-3 md:gap-4
  `;
  
  return <div className={gridClasses}>{children}</div>;
};

// Responsive Card Component
export const ResponsiveCard = ({ children, className = '', onClick = null }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        bg-white rounded-lg sm:rounded-xl 
        shadow-sm sm:shadow-md 
        border border-gray-200
        p-3 sm:p-4 md:p-6
        ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// Responsive Button Component
export const ResponsiveButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium',
  fullWidth = false,
  disabled = false,
  icon = null,
  className = ''
}) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white'
  };
  
  const sizes = {
    small: 'px-2 py-1 text-xs sm:text-sm',
    medium: 'px-3 py-2 text-sm sm:text-base',
    large: 'px-4 py-3 text-base sm:text-lg'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        rounded-md sm:rounded-lg
        font-medium
        transition-all
        flex items-center justify-center
        space-x-2
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

// Responsive Table Component
export const ResponsiveTable = ({ children, className = '' }) => {
  return (
    <div className="overflow-x-auto -mx-2 sm:-mx-4 md:-mx-6">
      <div className="inline-block min-w-full align-middle px-2 sm:px-4 md:px-6">
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
            {children}
          </table>
        </div>
      </div>
    </div>
  );
};

// Responsive Modal Component
export const ResponsiveModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <div className="inline-block align-bottom bg-white rounded-t-xl sm:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full sm:max-w-lg">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                {title && (
                  <h3 className="text-lg sm:text-xl leading-6 font-medium text-gray-900 mb-4">
                    {title}
                  </h3>
                )}
                <div className="mt-2">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Responsive Stats Card Component
export const ResponsiveStatsCard = ({ title, value, icon, trend, className = '' }) => {
  return (
    <div className={`bg-white p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl shadow-sm border ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-600">{title}</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-900 mt-1">
            {value}
          </p>
          {trend && (
            <p className={`text-xs sm:text-sm mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-2 sm:ml-4">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Responsive Form Input Component
export const ResponsiveInput = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  placeholder = '',
  required = false,
  className = '' 
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md sm:rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
      />
    </div>
  );
};

// Responsive Text Component
export const ResponsiveText = ({ 
  children, 
  variant = 'body', 
  className = '' 
}) => {
  const variants = {
    h1: 'text-2xl sm:text-3xl md:text-4xl font-bold',
    h2: 'text-xl sm:text-2xl md:text-3xl font-bold',
    h3: 'text-lg sm:text-xl md:text-2xl font-semibold',
    h4: 'text-base sm:text-lg md:text-xl font-semibold',
    body: 'text-sm sm:text-base',
    small: 'text-xs sm:text-sm',
    tiny: 'text-xs'
  };
  
  const Component = variant.startsWith('h') ? variant : 'p';
  
  return (
    <Component className={`${variants[variant]} ${className}`}>
      {children}
    </Component>
  );
};

// Responsive Loading Spinner
export const ResponsiveSpinner = ({ size = 'medium' }) => {
  const sizes = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };
  
  return (
    <div className="flex justify-center items-center p-4">
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizes[size]}`}></div>
    </div>
  );
};

export default {
  ResponsiveGrid,
  ResponsiveCard,
  ResponsiveButton,
  ResponsiveTable,
  ResponsiveModal,
  ResponsiveStatsCard,
  ResponsiveInput,
  ResponsiveText,
  ResponsiveSpinner
};