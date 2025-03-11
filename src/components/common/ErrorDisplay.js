import React from 'react';

/**
 * Error display component to show error messages consistently
 * @param {Object} props
 * @param {string} props.message - Error message to display
 * @param {string} props.type - Type of error: 'error', 'warning', or 'info'
 * @param {Function} props.onRetry - Optional retry callback
 */
const ErrorDisplay = ({ 
  message = 'An error occurred', 
  type = 'error',
  onRetry = null 
}) => {
  // Styles based on type
  const styles = {
    error: {
      bg: 'bg-red-100',
      border: 'border-red-400',
      text: 'text-red-700',
      icon: 'text-red-500'
    },
    warning: {
      bg: 'bg-yellow-100',
      border: 'border-yellow-400',
      text: 'text-yellow-700',
      icon: 'text-yellow-500'
    },
    info: {
      bg: 'bg-blue-100',
      border: 'border-blue-400',
      text: 'text-blue-700',
      icon: 'text-blue-500'
    }
  };
  
  const style = styles[type] || styles.error;
  
  return (
    <div className={`${style.bg} border ${style.border} ${style.text} px-4 py-3 rounded relative mb-4`} role="alert">
      <div className="flex items-start">
        <div className="py-1">
          <svg className={`fill-current h-6 w-6 ${style.icon} mr-4`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            {type === 'error' && (
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
            )}
            {type === 'warning' && (
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 7a1 1 0 012 0v5a1 1 0 11-2 0V7zm1 9a1 1 0 100-2 1 1 0 000 2z" />
            )}
            {type === 'info' && (
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z" />
            )}
          </svg>
        </div>
        <div>
          <p className="font-bold">{type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info'}</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
      
      {onRetry && (
        <div className="mt-3">
          <button 
            onClick={onRetry}
            className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorDisplay;