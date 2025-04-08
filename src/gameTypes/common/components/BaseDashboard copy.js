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
  onParamChange = () => {},
  activeTab: externalActiveTab = null, // Allow parent to control active tab
  params: externalParams = null, // Allow parent to control params
  onTabChange = () => {}, // Callback for tab changes
  initialResetTabs = false, // New prop for initial tab reset
  forceTabReset = false,    // New prop for forcing reset
  gameTypeId = '',          // New prop for game type id
  dashboardKey = 0          // New prop for tracking remounts
}) => {
  console.log(`BaseDashboard mounted for ${gameTypeId} with leagueId ${leagueId}, key: ${dashboardKey}`);
  console.log(`Reset flags: initialResetTabs=${initialResetTabs}, forceTabReset=${forceTabReset}`);
  
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState(null);
  
  // Modify activeTab state to respect reset flags
  const [activeTab, setActiveTab] = useState(() => {
    console.log('Initializing activeTab state');
    
    // If reset is requested, always use default tab
    if (initialResetTabs || forceTabReset) {
      console.log(`Tab reset requested, using defaultTab: ${defaultTab}`);
      return defaultTab;
    }
    
    // Otherwise use external tab if provided
    if (externalActiveTab) {
      console.log(`Using external active tab: ${externalActiveTab}`);
      return externalActiveTab;
    }
    
    // Or derive from URL
    const searchParams = new URLSearchParams(window.location.search);
    // Support both parameter formats - tab for backward compatibility, view for new format
    const viewParam = searchParams.get('view');
    const tabParam = searchParams.get('tab');
    const urlTab = viewParam || tabParam;
    
    // Validate the tab exists
    if (urlTab && tabs[urlTab]) {
      console.log(`Using tab from URL: ${urlTab}`);
      return urlTab;
    }
    
    console.log(`Falling back to default tab: ${defaultTab}`);
    return defaultTab;
  });
  
  // Handle URL params with reset awareness
  const [params, setParams] = useState(() => {
    // Use external params if provided
    if (externalParams) return externalParams;
    
    // Otherwise derive from URL, with reset awareness
    if (initialResetTabs || forceTabReset) {
      // When resetting, only keep essential params
      console.log(`Params reset requested, using empty params`);
      return {};
    }
    
    const searchParams = new URLSearchParams(window.location.search);
    const initialParams = {};
    customUrlParams.forEach(param => {
      const value = searchParams.get(param);
      if (value) initialParams[param] = value;
    });
    console.log(`Using params from URL:`, initialParams);
    return initialParams;
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  // Effect to handle force resets after initial mount
  useEffect(() => {
    if (forceTabReset && defaultTab && activeTab !== defaultTab) {
      console.log(`Force reset activated, switching to default tab: ${defaultTab}`);
      setActiveTab(defaultTab);
      onTabChange(defaultTab);
      
      // Reset params to defaults
      setParams({});
      
      // Update URL if needed
      if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
        updateUrlWithoutRefresh(defaultTab, {});
      }
    }
  }, [forceTabReset, defaultTab, gameTypeId, dashboardKey]);

  // Check for returning from admin view
  useEffect(() => {
    if (leagueId) {
      // Try both potential storage keys for better compatibility
      const returnKeys = [
        `bracket-dashboard-${leagueId}-return`,
        `${gameTypeId}-dashboard-${leagueId}-return`
      ];
      
      let returnTab = null;
      
      // Try each key
      for (const key of returnKeys) {
        const storedTab = sessionStorage.getItem(key);
        if (storedTab && storedTab !== 'admin' && activeTab !== storedTab) {
          console.log(`Returning from admin, restoring tab from ${key}:`, storedTab);
          returnTab = storedTab;
          // Clear the stored return tab
          sessionStorage.removeItem(key);
          break;
        }
      }
      
      if (returnTab) {
        // Restore the previous tab
        setActiveTab(returnTab);
        onTabChange(returnTab);
        
        if (location.pathname.startsWith(`/league/${leagueId}`)) {
          updateUrlWithoutRefresh(returnTab, params);
        }
      }
    }
  }, [leagueId, gameTypeId]);

  // Sync with external activeTab if it changes
  useEffect(() => {
    if (externalActiveTab && externalActiveTab !== activeTab) {
      console.log(`Syncing with external active tab: ${externalActiveTab}`);
      setActiveTab(externalActiveTab);
    }
  }, [externalActiveTab, activeTab]);

  // Sync with external params if they change
  useEffect(() => {
    if (externalParams) {
      console.log(`Syncing with external params:`, externalParams);
      setParams(externalParams);
    }
  }, [externalParams]);

  // Pre-render all tab components but only show the active one
  // This prevents losing state when switching tabs
  const tabComponents = useMemo(() => {
    return Object.entries(tabs).reduce((acc, [tabId, tab]) => {
      if (tab.component) {
        acc[tabId] = (
          <div key={`tab-${tabId}-${dashboardKey}`} style={{ display: activeTab === tabId ? 'block' : 'none' }}>
            {React.createElement(tab.component, {
              isEmbedded: true,
              leagueId: leagueId,
              hideBackButton: true,
              gameData: gameData,
              params: params,
              onParamChange: onParamChange,
              dashboardKey: dashboardKey, // Pass down dashboard key
              gameTypeId: gameTypeId,     // Pass down game type
              ...tab.componentProps
            })}
          </div>
        );
      }
      if (tab.requiresEdit && tab.lockedComponent) {
        acc[tabId + '_locked'] = (
          <div key={`tab-${tabId}-locked-${dashboardKey}`} style={{ display: activeTab === tabId ? 'block' : 'none' }}>
            {React.createElement(tab.lockedComponent, {
              onSwitchTab: (newTab) => {
                console.log(`Locked component switching tab to: ${newTab}`);
                setActiveTab(newTab);
                onTabChange(newTab);
                if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
                  updateUrlWithoutRefresh(newTab, params);
                }
              },
              fallbackTab: tab.fallbackTab,
              ...tab.lockedComponentProps
            })}
          </div>
        );
      }
      return acc;
    }, {});
  }, [tabs, activeTab, leagueId, gameData, params, onParamChange, dashboardKey, gameTypeId, location.pathname, updateUrlWithoutRefresh]);

  // Handle URL parameter changes without full page reload
  useEffect(() => {
    // Only handle URL changes if we're not controlled by a parent component
    // And not during a forced reset
    if (externalActiveTab !== null && externalParams !== null) return;
    if (forceTabReset || initialResetTabs) return;
    
    const searchParams = new URLSearchParams(location.search);
    // Support both parameter formats
    const viewParam = searchParams.get('view');
    const tabParam = searchParams.get('tab');
    const newTabParam = viewParam || tabParam;
    
    if (newTabParam && tabs[newTabParam] && newTabParam !== activeTab) {
      console.log(`Tab change from URL: ${activeTab} -> ${newTabParam}`);
      setActiveTab(newTabParam);
      onTabChange(newTabParam);
    }
    
    const extractedParams = {};
    customUrlParams.forEach(param => {
      const value = searchParams.get(param);
      if (value) extractedParams[param] = value;
    });
    
    // Update local state with URL parameters
    setParams(prev => {
      const newParams = { ...prev, ...extractedParams };
      const paramsChanged = Object.keys(extractedParams).some(key => prev[key] !== extractedParams[key]);
      if (paramsChanged) {
        console.log(`Params changed from URL:`, extractedParams);
        onParamChange({ ...newParams, view: newTabParam });
        return newParams;
      }
      return prev;
    });
  }, [location.search, tabs, customUrlParams, onParamChange, activeTab, externalActiveTab, externalParams, onTabChange, forceTabReset, initialResetTabs]);

  // Load game data once when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log(`Loading game data for league: ${leagueId}`);
        setLoading(true);
        const data = await getGameData(leagueId);
        setGameData(data);
        
        if (leagueId) {
          const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
          const visibilitySnap = await getDoc(visibilityRef);
          if (visibilitySnap.exists()) {
            const fogOfWarEnabled = visibilitySnap.data().fogOfWarEnabled || false;
            setParams(prev => ({ ...prev, fogOfWarEnabled }));
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setError("Failed to load game data");
        setLoading(false);
      }
    };
    
    loadData();
  }, [leagueId, getGameData]);

  // Check if we need to switch to default tab for completed tournaments
  useEffect(() => {
    if (!loading && gameData) {
      const { status, defaultTabWhenComplete } = getStatusInfo(gameData);
      if (status === "Completed" && defaultTabWhenComplete && 
          activeTab === defaultTab && tabs[defaultTabWhenComplete]) {
        console.log(`Tournament completed, switching to default completed tab: ${defaultTabWhenComplete}`);
        setActiveTab(defaultTabWhenComplete);
        onTabChange(defaultTabWhenComplete);
        if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
          updateUrlWithoutRefresh(defaultTabWhenComplete, params);
        }
      }
    }
  }, [loading, gameData, defaultTab, activeTab, getStatusInfo, tabs, params, leagueId, location.pathname, onTabChange, updateUrlWithoutRefresh]);

  // Handle tab switching
  const handleTabClick = useCallback((tabId) => {
    if (tabId === activeTab) return;
    console.log(`Tab click: ${activeTab} -> ${tabId}`);

    const status = getStatusInfo(gameData);
    const newTab = tabs[tabId].requiresEdit && !canEditEntry(gameData) 
      ? tabs[tabId].fallbackTab || Object.keys(tabs)[0] 
      : tabId;

    if (newTab !== activeTab) {
      console.log(`Setting active tab to: ${newTab}`);
      setActiveTab(newTab);
      onTabChange(newTab);
      
      if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
        updateUrlWithoutRefresh(newTab, params);
        onParamChange({ ...params, view: newTab });
      }
    }
  }, [activeTab, tabs, gameData, params, onParamChange, getStatusInfo, canEditEntry, leagueId, location.pathname, onTabChange, updateUrlWithoutRefresh]);

  // Update URL without triggering a full page reload
  const updateUrlWithoutRefresh = useCallback((tab, params = {}) => {
    console.log(`Updating URL without refresh: tab=${tab}, params=`, params);
    
    const searchParams = new URLSearchParams();
    // Use view parameter instead of tab
    searchParams.set('view', tab);
    // For backward compatibility, also set tab
    searchParams.set('tab', tab);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.set(key, value);
      }
    });

    const currentPath = location.pathname;
    let newUrl;
    if (leagueId && currentPath.startsWith(`/league/${leagueId}`)) {
      newUrl = `/league/${leagueId}?${searchParams.toString()}`;
    } else {
      newUrl = `${currentPath}?${searchParams.toString()}`;
    }

    if (location.pathname + location.search !== newUrl) {
      console.log(`URL update: ${location.pathname + location.search} -> ${newUrl}`);
      // Use replace: true to avoid adding to browser history
      navigate(newUrl, { replace: true });
    }
  }, [leagueId, location.pathname, location.search, navigate]);

  // Handle parameter changes from child components
  const handleParentParamChange = useCallback((newParams) => {
    console.log('Parent param change:', newParams);
    
    // Support both parameter formats
    const newTab = newParams.view || newParams.tab || activeTab;
    
    const filteredParams = { ...newParams };
    delete filteredParams.tab;
    delete filteredParams.view;
    
    setParams(prev => {
      const updatedParams = { ...prev, ...filteredParams };
      const paramsChanged = Object.keys(filteredParams).some(key => prev[key] !== filteredParams[key]);
      
      if (paramsChanged || newTab !== activeTab) {
        if (newTab !== activeTab) {
          console.log(`Tab change from parent: ${activeTab} -> ${newTab}`);
          setActiveTab(newTab);
          onTabChange(newTab);
        }
        
        if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
          updateUrlWithoutRefresh(newTab, updatedParams);
        }
        
        onParamChange({ ...updatedParams, view: newTab });
        return updatedParams;
      }
      return prev;
    });
  }, [activeTab, onParamChange, updateUrlWithoutRefresh, leagueId, location.pathname, onTabChange]);

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
            key={`tab-button-${tabId}-${dashboardKey}`}
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
        {/* Render all component divs but only show the active one */}
        <div className="embedded-component">
          {Object.values(tabComponents)}
        </div>
      </div>
    </div>
  );
};

export default BaseDashboard;