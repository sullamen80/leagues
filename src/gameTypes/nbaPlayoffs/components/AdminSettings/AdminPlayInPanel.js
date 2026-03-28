import React from 'react';
import BasePlayInPanel from '../BasePlayInPanel';

/**
 * Admin panel for managing the NBA Play-In tournament
 * This is a thin wrapper around BasePlayInPanel that passes admin-specific props
 */
const AdminPlayInPanel = ({ 
  data,
  onDataChange,
  isLoading = false, 
  isLeagueArchived = false,
  onBack
}) => {
  return (
    <BasePlayInPanel
      isUserMode={false}
      data={data}
      onDataChange={onDataChange}
      isLoading={isLoading}
      isLeagueArchived={isLeagueArchived}
      onBack={onBack}
    />
  );
};

export default AdminPlayInPanel;