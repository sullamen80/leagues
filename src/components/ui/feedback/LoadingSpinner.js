// src/components/ui/LoadingSpinner.js
import React from 'react';
import { getColorClass } from '../../../styles/tokens/colors';
import { classNames } from '../../../utils/formatters';

export function LoadingSpinner({ size = 'md', fullScreen = false }) {
  // Size variants
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };
  
  // Container classes
  const containerClasses = fullScreen 
    ? 'flex justify-center items-center h-screen' 
    : 'flex justify-center items-center p-4';
    
  return (
    <div className={containerClasses}>
      <div className={classNames(
        'animate-spin rounded-full',
        sizeClasses[size] || sizeClasses.md,
        'border-b-2',
        getColorClass('primary', '500', 'border')
      )}></div>
    </div>
  );
}

export default LoadingSpinner;