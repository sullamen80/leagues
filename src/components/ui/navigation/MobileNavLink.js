import React from 'react';
import { Link } from 'react-router-dom';
import { Disclosure } from '@headlessui/react';
import { classNames } from '../../../utils/formatters';
import { getColorClass } from '../../../styles/tokens/colors';

/**
 * Navigation link component for mobile navigation menu
 * 
 * @param {Object} props
 * @param {string} props.to - Link destination
 * @param {string} props.children - Link text content
 * @param {boolean} [props.current=false] - Whether this link is for the current page
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} Styled mobile navigation link
 */
export function MobileNavLink({ to, children, current = false, className = '' }) {
  return (
    <Disclosure.Button
      as={Link}
      to={to}
      className={classNames(
        current
          ? classNames(
              getColorClass('primary', '500', 'border'), 
              getColorClass('primary', '50', 'bg'), 
              getColorClass('primary', '700', 'text')
            )
          : classNames(
              'border-transparent',
              getColorClass('text', 'secondary', 'text'),
              `hover:${getColorClass('border', 'main', 'border')}`,
              `hover:${getColorClass('gray', '50', 'bg')}`,
              `hover:${getColorClass('text', 'primary', 'text')}`
            ),
        'block border-l-4 py-2 pr-4 pl-3 text-base font-medium',
        className
      )}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Disclosure.Button>
  );
}

export default MobileNavLink;