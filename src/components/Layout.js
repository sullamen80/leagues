import React from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { Bars3Icon, BellIcon, XMarkIcon } from "@heroicons/react/24/outline";
// Import the logo
import logo from "../assets/images/icon.png";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Helper function to generate initials from a name
const getInitials = (name) => {
  if (!name) return '?';
  
  // If it's an email, use the first character before the @ symbol
  if (name.includes('@')) {
    const firstPart = name.split('@')[0];
    return firstPart.charAt(0).toUpperCase();
  }
  
  // Otherwise, get initials from the name (up to 2 characters)
  const parts = name.split(' ').filter(part => part.length > 0);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  } else if (parts.length > 1) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  
  return '?';
};

// Generate a consistent color based on a string
const generateColorFromString = (str) => {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to pastel color
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 80%)`; // Light color for light theme
};

const userNavigation = [
  { name: "Your Profile", href: "/profile" },
  // { name: "Settings", href: "/settings" },
  { name: "Sign out", href: "#" },
];

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userData, logout } = useAuth();
  
  // Dynamic navigation based on current path
  const navigation = [
    { name: "Dashboard", href: "/", current: location.pathname === "/" },
    // { name: "Create League", href: "/create-league", current: location.pathname === "/create-league" },
    // { name: "Join League", href: "/join-league", current: location.pathname === "/join-league" },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Get display name to use for avatar
  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.username) return userData.username;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email;
    return "User";
  };

  // Generate avatar color based on user ID or email
  const avatarColor = currentUser 
    ? generateColorFromString(currentUser.uid || currentUser.email) 
    : '#CBD5E1'; // Default light gray

  return (
    <div className="min-h-full">
      <Disclosure as="nav" className="bg-white border-b border-gray-200">
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
                        src={logo}
                        alt="Your Company"
                      />
                      <img
                        className="hidden h-8 w-auto lg:block"
                        src={logo}
                        alt="Your Company"
                      />
                    </Link>
                  </div>
                  <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        aria-current={item.current ? "page" : undefined}
                        className={classNames(
                          item.current
                            ? "border-indigo-500 text-gray-900"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                          "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium"
                        )}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Right side: Notifications and Profile dropdown */}
                <div className="hidden sm:ml-6 sm:flex sm:items-center">
                  {/* <button
                    type="button"
                    className="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <span className="sr-only">View notifications</span>
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button> */}

                  <Menu as="div" className="relative ml-3">
                    <div>
                      <Menu.Button className="flex max-w-xs items-center rounded-full bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                        <span className="sr-only">Open user menu</span>
                        {/* Initials Avatar */}
                        <div 
                          className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium text-gray-700"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {getInitials(getDisplayName())}
                        </div>
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
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                        {userNavigation.map((item) => (
                          <Menu.Item key={item.name}>
                            {({ active }) =>
                              item.name === "Sign out" ? (
                                <button
                                  onClick={handleLogout}
                                  className={classNames(
                                    active ? "bg-gray-100" : "",
                                    "block w-full text-left px-4 py-2 text-sm text-gray-700"
                                  )}
                                >
                                  {item.name}
                                </button>
                              ) : (
                                <Link
                                  to={item.href}
                                  className={classNames(
                                    active ? "bg-gray-100" : "",
                                    "block px-4 py-2 text-sm text-gray-700"
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
                </div>

                {/* Mobile menu button */}
                <div className="-mr-2 flex items-center sm:hidden">
                  <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
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
                  <Disclosure.Button
                    key={item.name}
                    as={Link}
                    to={item.href}
                    className={classNames(
                      item.current
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
                      "block border-l-4 py-2 pr-4 pl-3 text-base font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}
                  >
                    {item.name}
                  </Disclosure.Button>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-4 pb-3">
                <div className="flex items-center px-4">
                  <div className="shrink-0">
                    {/* Initials Avatar for mobile menu */}
                    <div 
                      className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium text-gray-700"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(getDisplayName())}
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">
                      {userData?.username || currentUser?.email || "User"}
                    </div>
                    <div className="text-sm font-medium text-gray-500">
                      {currentUser?.email || ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ml-auto shrink-0 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <span className="sr-only">View notifications</span>
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-3 space-y-1">
                  {userNavigation.map((item) => (
                    item.name === "Sign out" ? (
                      <Disclosure.Button
                        key={item.name}
                        as="button"
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      >
                        {item.name}
                      </Disclosure.Button>
                    ) : (
                      <Disclosure.Button
                        key={item.name}
                        as={Link}
                        to={item.href}
                        className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
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

      {/* Main Content */}
      <main>
        <div className="mx-auto max-w-7xl py-4 sm:py-0 md:py-10 sm:px-0 sm:px-0 lg:px-8 main-container">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;