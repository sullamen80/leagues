// src/gameTypes/nbaPlayoffs/components/AdminTeamsWrapper.js
import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AdminTeams from './AdminTeams';

/**
 * Wrapper component for the AdminTeams component
 * Handles URL navigation and passing props to the AdminTeams component
 */
const AdminTeamsWrapper = () => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Function to handle tab changes and update URL
  const handleTabChange = (tabName) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', tabName);
    
    // Update URL with new tab parameter
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };
  
  return (
    <div className="py-6">
      <AdminTeams onTabChange={handleTabChange} />
    </div>
  );
};

export default AdminTeamsWrapper;