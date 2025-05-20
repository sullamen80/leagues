import React from 'react';
import { Link } from 'react-router-dom';
import { Disclosure } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { getColorClass } from '../../../styles/tokens/colors';
import { classNames, userFormatters } from '../../../utils/formatters';
import NavLink from '../navigation/NavLink';
import MobileNavLink from '../navigation/MobileNavLink';
import UserMenu from '../navigation/UserMenu';
import Avatar from '../user/Avatar';

/**
 * Top navigation bar component
 * 
 * @param {Object} props
 * @param {Array} props.navigation - Array of navigation items
 * @param {Array} props.userNavigation - Array of user menu items
 * @param {Object} props.user - User object with display information
 * @param {string} props.logoSrc - Source URL for the logo image
 * @param {Function} props.onSignOut - Function to call when sign out is clicked
 * @returns {JSX.Element} Top navigation bar
 */
export function TopNav({ 
  navigation, 
  userNavigation, 
  user,
  logoSrc,
  onSignOut 
}) {
  // Create a normalized user object from nested structure
  const normalizedUser = {
    displayName: user?.userData?.displayName || user?.currentUser?.displayName,
    username: user?.userData?.username,
    email: user?.currentUser?.email
  };

  // Use the utility function from formatters.js
  const displayName = userFormatters.getUserDisplayName(normalizedUser);
  const identifier = user?.currentUser?.uid || user?.currentUser?.email || displayName;

  return (
    <Disclosure as="nav" className={classNames(
      getColorClass('background', 'default'),
      'border-b',
      getColorClass('border', 'light', 'border')
    )}>
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
            <div className="flex h-16 justify-between">
              {/* Left side: Logo and Navigation */}
              <div className="flex">
                <div className="flex shrink-0 items-center">
                  <Link to="/">
                    <img
                      className="block h-8 w-auto lg:hidden"
                      src={logoSrc}
                      alt="Logo"
                    />
                    <img
                      className="hidden h-8 w-auto lg:block"
                      src={logoSrc}
                      alt="Logo"
                    />
                  </Link>
                </div>
                <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      current={item.current}
                    >
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Right side: User menu */}
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                <UserMenu
                  displayName={displayName}
                  identifier={identifier}
                  menuItems={userNavigation}
                  onSignOut={onSignOut}
                />
              </div>

              {/* Mobile menu button */}
              <div className="-mr-2 flex items-center sm:hidden">
                <Disclosure.Button className={classNames(
                  'inline-flex items-center justify-center rounded-md p-2',
                  getColorClass('background', 'default'),
                  getColorClass('gray', '400', 'text'),
                  `hover:${getColorClass('gray', '100', 'bg')}`,
                  `hover:${getColorClass('gray', '500', 'text')}`,
                  'focus:ring-2',
                  getColorClass('primary', '500', 'focus:ring'),
                  'focus:ring-offset-2'
                )}>
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          <Disclosure.Panel className="sm:hidden">
            <div className="space-y-1 pt-2 pb-3">
              {navigation.map((item) => (
                <MobileNavLink
                  key={item.name}
                  to={item.href}
                  current={item.current}
                >
                  {item.name}
                </MobileNavLink>
              ))}
            </div>
            <div className={classNames(
              'border-t pt-4 pb-3',
              getColorClass('border', 'light', 'border')
            )}>
              <div className="flex items-center px-4">
                <div className="shrink-0">
                  <Avatar 
                    name={displayName} 
                    identifier={identifier}
                    size="md"
                  />
                </div>
                <div className="ml-3">
                  <div className={classNames(
                    'text-base font-medium',
                    getColorClass('text', 'primary', 'text')
                  )}>
                    {normalizedUser.username || normalizedUser.email || "User"}
                  </div>
                  <div className={classNames(
                    'text-sm font-medium',
                    getColorClass('text', 'secondary', 'text')
                  )}>
                    {normalizedUser.email || ""}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {userNavigation.map((item) => (
                  item.name === "Sign out" ? (
                    <Disclosure.Button
                      key={item.name}
                      as="button"
                      onClick={onSignOut}
                      className={classNames(
                        'block w-full text-left px-4 py-2 text-base font-medium',
                        getColorClass('text', 'secondary', 'text'),
                        `hover:${getColorClass('gray', '100', 'bg')}`,
                        `hover:${getColorClass('text', 'primary', 'text')}`
                      )}
                    >
                      {item.name}
                    </Disclosure.Button>
                  ) : (
                    <Disclosure.Button
                      key={item.name}
                      as={Link}
                      to={item.href}
                      className={classNames(
                        'block px-4 py-2 text-base font-medium',
                        getColorClass('text', 'secondary', 'text'),
                        `hover:${getColorClass('gray', '100', 'bg')}`,
                        `hover:${getColorClass('text', 'primary', 'text')}`
                      )}
                    >
                      {item.name}
                    </Disclosure.Button>
                  )
                ))}
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

export default TopNav;