import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { classNames } from '../../../utils/formatters';
import { getColorClass } from '../../../styles/tokens/colors';
import Avatar from '../user/Avatar';

/**
 * User menu dropdown component
 * 
 * @param {Object} props
 * @param {string} props.displayName - User's display name
 * @param {string} props.identifier - Unique identifier for avatar color
 * @param {Array} props.menuItems - Array of menu items
 * @param {Function} props.onSignOut - Function to call when sign out is clicked
 * @returns {JSX.Element} User menu dropdown
 */
export function UserMenu({ 
  displayName, 
  identifier, 
  menuItems,
  onSignOut
}) {
  return (
    <Menu as="div" className="relative ml-3">
      <div>
        <Menu.Button className={classNames(
          `flex max-w-xs items-center rounded-full ${getColorClass('background', 'default')} text-sm`,
          'focus:ring-2',
          getColorClass('primary', '500', 'focus:ring'),
          'focus:ring-offset-2'
        )}>
          <span className="sr-only">Open user menu</span>
          <Avatar 
            name={displayName} 
            identifier={identifier}
            size="sm"
          />
        </Menu.Button>
      </div>
      <Transition
        as={React.Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className={`absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md ${getColorClass('background', 'default')} py-1 shadow-lg ring-1 ring-black/5 focus:outline-none`}>
          {menuItems.map((item) => (
            <Menu.Item key={item.name}>
              {({ active }) =>
                item.name === "Sign out" ? (
                  <button
                    onClick={onSignOut}
                    className={classNames(
                      active ? getColorClass('gray', '100', 'bg') : "",
                      `block w-full text-left px-4 py-2 text-sm ${getColorClass('text', 'primary', 'text')}`
                    )}
                  >
                    {item.name}
                  </button>
                ) : (
                  <Link
                    to={item.href}
                    className={classNames(
                      active ? getColorClass('gray', '100', 'bg') : "",
                      `block px-4 py-2 text-sm ${getColorClass('text', 'primary', 'text')}`
                    )}
                  >
                    {item.name}
                  </Link>
                )
              }
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

export default UserMenu;