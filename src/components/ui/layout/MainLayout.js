import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import TopNav from './TopNav';
import MainContent from './MainContent';

// Import the logo - adjust path as needed
import logo from '../../../assets/images/icon.png';

/**
 * Main application layout component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content to display
 * @returns {JSX.Element} Main application layout
 */
export function MainLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userData, logout } = useAuth();
  
  // Dynamic navigation based on current path
  const navigation = [
    { name: "Dashboard", href: "/", current: location.pathname === "/" },
    { name: "Stats", href: "/stats", current: location.pathname.startsWith("/stats") },
    // Add other navigation items as needed
  ];

  // User navigation items
  const userNavigation = [
    { name: "Your Profile", href: "/profile" },
    // { name: "Settings", href: "/settings" },
    { name: "Sign out", href: "#" },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="min-h-full">
      <TopNav
        navigation={navigation}
        userNavigation={userNavigation}
        user={{ currentUser, userData }}
        logoSrc={logo}
        onSignOut={handleLogout}
      />
      <MainContent>
        {children}
      </MainContent>
    </div>
  );
}

export default MainLayout;