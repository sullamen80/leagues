import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { FaCog } from 'react-icons/fa';
// Import our UI utilities
import { getColorClass } from '../../../styles/tokens/colors';
import { classNames } from '../../../utils/formatters';
// Import LoadingSpinner with the correct path
import LoadingSpinner from '../../../components/ui/feedback/LoadingSpinner';

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
  onTabChange = () => {} // Callback for tab changes
}) => {
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    // Use external active tab if provided, otherwise derive from URL
    if (externalActiveTab) return externalActiveTab;
    
    const searchParams = new URLSearchParams(window.location.search);
    // Support both parameter formats - tab for backward compatibility, view for new format
    return searchParams.get('view') || searchParams.get('tab') || defaultTab;
  });
  
  const [params, setParams] = useState(() => {
    // Use external params if provided, otherwise derive from URL
    if (externalParams) return externalParams;
    
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

  // Check for returning from admin view
  useEffect(() => {
    if (leagueId) {
      const returnTab = sessionStorage.getItem(`bracket-dashboard-${leagueId}-return`);
      if (returnTab && returnTab !== 'admin' && activeTab !== returnTab) {
        console.log("Returning from admin, restoring tab:", returnTab);
        // Clear the stored return tab
        sessionStorage.removeItem(`bracket-dashboard-${leagueId}-return`);
        
        // Restore the previous tab
        setActiveTab(returnTab);
        onTabChange(returnTab);
        
        if (location.pathname.startsWith(`/league/${leagueId}`)) {
          updateUrlWithoutRefresh(returnTab, params);
        }
      }
    }
  }, [leagueId]);

  // Sync with external activeTab if it changes
  useEffect(() => {
    if (externalActiveTab && externalActiveTab !== activeTab) {
      setActiveTab(externalActiveTab);
    }
  }, [externalActiveTab, activeTab]);

  // Sync with external params if they change
  useEffect(() => {
    if (externalParams) {
      setParams(externalParams);
    }
  }, [externalParams]);

  // Pre-render all tab components but only show the active one
  // This prevents losing state when switching tabs
  const tabComponents = useMemo(() => {
    return Object.entries(tabs).reduce((acc, [tabId, tab]) => {
      if (tab.component) {
        acc[tabId] = (
          <div key={`tab-${tabId}`} style={{ display: activeTab === tabId ? 'block' : 'none' }}>
            {React.createElement(tab.component, {
              isEmbedded: true,
              leagueId: leagueId,
              hideBackButton: true,
              gameData: gameData,
              params: params,
              onParamChange: onParamChange,
              ...tab.componentProps
            })}
          </div>
        );
      }
      if (tab.requiresEdit && tab.lockedComponent) {
        acc[tabId + '_locked'] = (
          <div key={`tab-${tabId}-locked`} style={{ display: activeTab === tabId ? 'block' : 'none' }}>
            {React.createElement(tab.lockedComponent, {
              onSwitchTab: (newTab) => setActiveTab(newTab),
              fallbackTab: tab.fallbackTab,
              ...tab.lockedComponentProps
            })}
          </div>
        );
      }
      return acc;
    }, {});
  }, [tabs, activeTab, leagueId, gameData, params, onParamChange]);

  // Handle URL parameter changes without full page reload
  useEffect(() => {
    // Only handle URL changes if we're not controlled by a parent component
    if (externalActiveTab !== null && externalParams !== null) return;
    
    const searchParams = new URLSearchParams(location.search);
    // Support both parameter formats
    const viewParam = searchParams.get('view');
    const tabParam = searchParams.get('tab');
    const newTabParam = viewParam || tabParam;
    
    if (newTabParam && tabs[newTabParam] && newTabParam !== activeTab) {
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
        onParamChange({ ...newParams, view: newTabParam });
        return newParams;
      }
      return prev;
    });
  }, [location.search, tabs, customUrlParams, onParamChange, activeTab, externalActiveTab, externalParams, onTabChange]);

  // Load game data once when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
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
        setActiveTab(defaultTabWhenComplete);
        onTabChange(defaultTabWhenComplete);
        if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
          updateUrlWithoutRefresh(defaultTabWhenComplete, params);
        }
      }
    }
  }, [loading, gameData, defaultTab, activeTab, getStatusInfo, tabs, params, leagueId, location.pathname, onTabChange]);

  // Handle tab switching
  const handleTabClick = useCallback((tabId) => {
    if (tabId === activeTab) return;

    const status = getStatusInfo(gameData);
    const newTab = tabs[tabId].requiresEdit && !canEditEntry(gameData) 
      ? tabs[tabId].fallbackTab || Object.keys(tabs)[0] 
      : tabId;

    if (newTab !== activeTab) {
      setActiveTab(newTab);
      onTabChange(newTab);
      
      if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
        updateUrlWithoutRefresh(newTab, params);
        onParamChange({ ...params, view: newTab });
      }
    }
  }, [activeTab, tabs, gameData, params, onParamChange, getStatusInfo, canEditEntry, leagueId, location.pathname, onTabChange]);

  // Update URL without triggering a full page reload
  const updateUrlWithoutRefresh = useCallback((tab, params = {}) => {
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
      console.log("Updating URL without full reload:", newUrl);
      // Use replace: true to avoid adding to browser history
      navigate(newUrl, { replace: true });
    }
  }, [leagueId, location.pathname, location.search, navigate]);

  // Handle parameter changes from child components
  const handleParentParamChange = useCallback((newParams) => {
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
        <LoadingSpinner size="md" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={classNames(
        getColorClass('red', 'light', 'bg'),
        'border',
        getColorClass('red', 'main', 'border'),
        getColorClass('red', 'dark', 'text'),
        'px-4 py-3 rounded mb-4'
      )}>
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
        {Object.entries(tabs).map(([tabId, tab]) => {
          // Map tab.color to our semantic color system, defaulting to primary
          const tabColor = tab.color || 'primary';
          
          return (
            <div 
              key={tabId}
              className={classNames(
                'rounded-lg shadow-md p-4 border-2 cursor-pointer transition',
                tab.requiresEdit && !canEdit ? 'opacity-75' : '',
                activeTab === tabId 
                  ? classNames(
                      getColorClass(tabColor, '50', 'bg'),
                      getColorClass(tabColor, '500', 'border')
                    ) 
                  : classNames(
                      'bg-white',
                      getColorClass('border', 'light', 'border'),
                      `hover:${getColorClass(tabColor, '300', 'border')}`
                    )
              )}
              onClick={() => handleTabClick(tabId)}
            >
              <div className="flex items-center">
                <div className={classNames(
                  'p-3 rounded-full',
                  activeTab === tabId 
                    ? getColorClass(tabColor, '100', 'bg')
                    : getColorClass('background', 'paper')
                )}>
                  {React.cloneElement(tab.icon, { 
                    className: activeTab === tabId
                      ? getColorClass(tabColor, '500', 'text')
                      : getColorClass('text', 'secondary')
                  })}
                </div>
                <div className="ml-3">
                  <h3 className={classNames(
                    'font-semibold',
                    activeTab === tabId
                      ? getColorClass(tabColor, '700', 'text')
                      : getColorClass('text', 'primary')
                  )}>
                    {tab.title}
                  </h3>
                  <p className={getColorClass('text', 'secondary')}>
                    {tab.requiresEdit && !canEdit 
                      ? tab.lockedDescription || "Locked" 
                      : tab.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className={classNames(
        'bg-white rounded-lg shadow-md border-t-4',
        tabs[activeTab]?.borderColor || 
          getColorClass(tabs[activeTab]?.color || 'primary', '500', 'border')
      )}>
        {/* Render all component divs but only show the active one */}
        <div className="embedded-component">
          {Object.values(tabComponents)}
        </div>
      </div>
    </div>
  );
};

export default BaseDashboard;