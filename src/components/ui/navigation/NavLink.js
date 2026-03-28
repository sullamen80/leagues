import React from 'react';
import { Link } from 'react-router-dom';
import { classNames } from '../../../utils/formatters';
import { getColorClass } from '../../../styles/tokens/colors';

/**
 * Navigation link component for desktop navigation
 * 
 * @param {Object} props
 * @param {string} props.to - Link destination
 * @param {string} props.children - Link text content
 * @param {boolean} [props.current=false] - Whether this link is for the current page
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} Styled navigation link
 */
export function NavLink({ to, children, current = false, className = '' }) {
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={classNames(
        current
          ? classNames(getColorClass('primary', '500', 'border'), 'text-gray-900')
          : classNames('border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'),
        'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
        className
      )}
    >
      {children}
    </Link>
  );
}

export default NavLink;