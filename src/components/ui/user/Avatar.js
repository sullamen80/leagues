import React from 'react';
import { getInitials, generateColorFromString, classNames } from '../../../utils/formatters';

/**
 * Displays a user avatar with initials
 * 
 * @param {Object} props
 * @param {string} props.name - User name or email to display initials from
 * @param {string} [props.identifier] - Unique identifier for consistent coloring (defaults to name)
 * @param {string} [props.size='md'] - Avatar size (sm, md, lg)
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} Avatar component
 */
export function Avatar({ 
  name, 
  identifier = name, 
  size = 'md',
  className = '' 
}) {
  // Get initials from name
  const initials = getInitials(name);
  
  // Generate background color based on identifier
  const backgroundColor = generateColorFromString(identifier);
  
  // Size variants
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };
  
  return (
    <div 
      className={classNames(
        'rounded-full flex items-center justify-center font-medium text-gray-700',
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      style={{ backgroundColor }}
    >
      {initials}
    </div>
  );
}

export default Avatar;