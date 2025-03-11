import React from 'react';

/**
 * Loading component to display during async operations
 * @param {Object} props
 * @param {string} props.message - Optional loading message
 * @param {string} props.size - Size of the spinner: 'small', 'medium', or 'large'
 */
const Loading = ({ message = 'Loading...', size = 'medium' }) => {
  // Size classes
  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-12 w-12',
    large: 'h-16 w-16',
  };
  
  const spinnerSize = sizeClasses[size] || sizeClasses.medium;
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className={`animate-spin rounded-full ${spinnerSize} border-b-2 border-indigo-500`}></div>
      {message && <p className="mt-4 text-gray-600 text-center">{message}</p>}
    </div>
  );
};

export default Loading;