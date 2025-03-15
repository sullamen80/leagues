import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { FaCog } from 'react-icons/fa';

const BaseDashboard = ({
  leagueId,
  league,
  tabs = {},
  defaultTab = Object.keys(tabs)[0] || '',
  getGameData = async () => ({}),
  canEditEntry = () => true,
  getStatusInfo = () => ({ canEdit: true, status: 'Active' }),
  AdminButton = null,
  customUrlParams = [],
  onParamChange = () => {}
}) => {
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('tab') || defaultTab;
  });
  const [params, setParams] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialParams = {};
    customUrlParams.forEach(param => {
      const value = searchParams.get(param);
      if (value) initialParams[param] = value;
    });
    return initialParams;
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  // Memoize tab components to prevent remounting on tab switch
  const tabComponents = useMemo(() => {
    return Object.entries(tabs).reduce((acc, [tabId, tab]) => {
      if (tab.component) {
        acc[tabId] = (
          <div style={{ display: activeTab === tabId ? 'block' : 'none' }}>
            {React.createElement(tab.component, {
              isEmbedded: true,
              leagueId: leagueId,
              hideBackButton: true,
              gameData: gameData,
              params: params,
              onParamChange: onParamChange, // Use parent’s onParamChange directly
              ...tab.componentProps
            })}
          </div>
        );
      }
      if (tab.requiresEdit && tab.lockedComponent) {
        acc[tabId + '_locked'] = (
          <div style={{ display: activeTab === tabId ? 'block' : 'none' }}>
            {React.createElement(tab.lockedComponent, {
              onSwitchTab: (newTab) => setActiveTab(newTab), // Simplified switch
              fallbackTab: tab.fallbackTab,
              ...tab.lockedComponentProps
            })}
          </div>
        );
      }
      return acc;
    }, {});
  }, [tabs, activeTab, leagueId, gameData, params, onParamChange]);

  // Sync activeTab and params with URL changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    if (tabParam && tabs[tabParam] && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    
    const extractedParams = {};
    customUrlParams.forEach(param => {
      const value = searchParams.get(param);
      if (value) extractedParams[param] = value;
    });
    
    setParams(prev => {
      const newParams = { ...prev, ...extractedParams };
      const paramsChanged = Object.keys(extractedParams).some(key => prev[key] !== extractedParams[key]);
      if (paramsChanged) {
        onParamChange({ ...newParams, tab: tabParam });
        return newParams;
      }
      return prev;
    });
  }, [location.search, tabs, customUrlParams, onParamChange, activeTab]);

  // Load game data once on mount or leagueId change
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getGameData(leagueId);
        setGameData(data);
        
        const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
        const visibilitySnap = await getDoc(visibilityRef);
        if (visibilitySnap.exists()) {
          const fogOfWarEnabled = visibilitySnap.data().fogOfWarEnabled || false;
          setParams(prev => ({ ...prev, fogOfWarEnabled }));
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setError("Failed to load game data");
        setLoading(false);
      }
    };
    
    if (leagueId) {
      loadData();
    }
  }, [leagueId, getGameData]);

  // Handle game status changes for completed tournaments
  useEffect(() => {
    if (!loading && gameData) {
      const { status, defaultTabWhenComplete } = getStatusInfo(gameData);
      if (status === "Completed" && defaultTabWhenComplete && 
          activeTab === defaultTab && tabs[defaultTabWhenComplete]) {
        setActiveTab(defaultTabWhenComplete);
        updateUrlWithoutRefresh(defaultTabWhenComplete, params);
      }
    }
  }, [loading, gameData, defaultTab, activeTab, getStatusInfo, tabs, params]);

  // Memoized tab click handler to avoid unnecessary updates
  const handleTabClick = useCallback((tabId) => {
    if (tabId === activeTab) return; // Skip if already active
    
    const status = getStatusInfo(gameData);
    const newTab = tabs[tabId].requiresEdit && !canEditEntry(gameData) 
      ? tabs[tabId].fallbackTab || Object.keys(tabs)[0] 
      : tabId;
    
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      updateUrlWithoutRefresh(newTab, params);
      onParamChange({ ...params, tab: newTab });
    }
  }, [activeTab, tabs, gameData, params, onParamChange, getStatusInfo, canEditEntry]);

  // Memoized URL update function to reduce redundant navigations
  const updateUrlWithoutRefresh = useCallback((tab, params = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.set('tab', tab);
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });
    const newUrl = `/league/${leagueId}?${searchParams.toString()}`;
    if (location.pathname + location.search !== newUrl) { // Only navigate if URL changes
      navigate(newUrl, { replace: true });
    }
  }, [leagueId, location.pathname, location.search, navigate]);

  // Handle param changes from parent (simplified)
  const handleParentParamChange = useCallback((newParams) => {
    const newTab = newParams.tab;
    if (newTab && tabs[newTab] && newTab !== activeTab) {
      setActiveTab(newTab);
      updateUrlWithoutRefresh(newTab, newParams);
    }
    
    const filteredParams = { ...newParams };
    delete filteredParams.tab;
    if (Object.keys(filteredParams).length > 0) {
      setParams(prev => {
        const updatedParams = { ...prev, ...filteredParams };
        const paramsChanged = Object.keys(filteredParams).some(key => prev[key] !== filteredParams[key]);
        if (paramsChanged) {
          onParamChange({ ...updatedParams, tab: newTab });
          return updatedParams;
        }
        return prev;
      });
    }
  }, [activeTab, tabs, onParamChange, updateUrlWithoutRefresh]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }
  
  const isAdmin = league && league.ownerId === currentUser?.uid;
  const { canEdit } = getStatusInfo(gameData);
  
  return (
    <div className="space-y-6">
      {isAdmin && AdminButton && (
        <div className="mb-6">
          <AdminButton leagueId={leagueId} navigate={navigate} />
        </div>
      )}
      
      <div className={`grid grid-cols-1 md:grid-cols-${Object.keys(tabs).length} gap-4`}>
        {Object.entries(tabs).map(([tabId, tab]) => (
          <div 
            key={tabId}
            className={`rounded-lg shadow-md p-4 border-2 cursor-pointer transition 
              ${tab.requiresEdit && !canEdit ? 'opacity-75 ' : ''}
              ${activeTab === tabId 
                ? `bg-${tab.color || 'blue'}-50 border-${tab.color || 'blue'}-500` 
                : `bg-white border-gray-200 hover:border-${tab.color || 'blue'}-300`}`}
            onClick={() => handleTabClick(tabId)}
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${
                activeTab === tabId 
                  ? `bg-${tab.color || 'blue'}-100` 
                  : 'bg-gray-100'}`}
              >
                {React.cloneElement(tab.icon, { 
                  className: `${activeTab === tabId ? `text-${tab.color || 'blue'}-500` : 'text-gray-500'}` 
                })}
              </div>
              <div className="ml-3">
                <h3 className={`font-semibold ${
                  activeTab === tabId 
                    ? `text-${tab.color || 'blue'}-700` 
                    : 'text-gray-700'}`}
                >
                  {tab.title}
                </h3>
                <p className="text-sm text-gray-500">
                  {tab.requiresEdit && !canEdit 
                    ? tab.lockedDescription || "Locked" 
                    : tab.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className={`bg-white rounded-lg shadow-md border-t-4 ${
        tabs[activeTab]?.borderColor || `border-${tabs[activeTab]?.color || 'blue'}-500`
      }`}>
        {/* Render pre-memoized tab content */}
        <div className="embedded-component">
          {tabComponents[activeTab] || (tabs[activeTab]?.requiresEdit && !canEdit && tabComponents[activeTab + '_locked'])}
        </div>
      </div>
    </div>
  );
};

export default BaseDashboard;