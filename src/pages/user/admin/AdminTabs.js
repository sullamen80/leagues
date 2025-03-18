import React, { useState } from 'react';
import { 
  FaUsers, 
  FaLayerGroup, 
  FaCog, 
  FaChartLine
} from 'react-icons/fa';
import ManageUsers from './ManageUsers';
import ManageLeagues from './ManageLeagues';
import SiteSettings from './SiteSettings';

const AdminTabs = () => {
  const [activeTab, setActiveTab] = useState('users');
  
  return (
    <div className="space-y-6">
      {/* Tabs navigation */}
      <div className="border-b border-gray-700">
        <nav className="flex -mb-px">
          <button
            className={`py-3 px-4 flex items-center font-medium text-sm border-b-2 focus:outline-none ${
              activeTab === 'users' 
                ? 'border-indigo-500 text-indigo-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('users')}
          >
            <FaUsers className="mr-2" />
            Manage Users
          </button>
          
          <button
            className={`py-3 px-4 flex items-center font-medium text-sm border-b-2 focus:outline-none ${
              activeTab === 'leagues' 
                ? 'border-indigo-500 text-indigo-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('leagues')}
          >
            <FaLayerGroup className="mr-2" />
            Manage Leagues
          </button>
          
          <button
            className={`py-3 px-4 flex items-center font-medium text-sm border-b-2 focus:outline-none ${
              activeTab === 'settings' 
                ? 'border-indigo-500 text-indigo-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('settings')}
          >
            <FaCog className="mr-2" />
            Site Settings
          </button>
          
          <button
            className={`py-3 px-4 flex items-center font-medium text-sm border-b-2 focus:outline-none ${
              activeTab === 'analytics' 
                ? 'border-indigo-500 text-indigo-400' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            <FaChartLine className="mr-2" />
            Analytics
          </button>
        </nav>
      </div>
      
      {/* Tab content */}
      <div>
        {activeTab === 'users' && <ManageUsers />}
        {activeTab === 'leagues' && <ManageLeagues />}
        {activeTab === 'settings' && <SiteSettings />}
        {activeTab === 'analytics' && <div className="text-gray-400 p-4 text-center">Analytics tab will be implemented soon.</div>}
      </div>
    </div>
  );
};

export default AdminTabs;