import React from 'react';
import { classNames } from '../../../utils/formatters';

/**
 * Main content container component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to display
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} Main content container
 */
export function MainContent({ children, className = '' }) {
  return (
    <main>
      <div className={classNames(
        'mx-auto max-w-7xl py-4 sm:py-0 md:py-10 sm:px-0 lg:px-8 main-container',
        className
      )}>
        {children}
      </div>
    </main>
  );
}

export default MainContent;