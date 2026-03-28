import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
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
  const [isMobileTabs, setIsMobileTabs] = useState(false);
  const updateUrlWithoutRefresh = useCallback((tab, params = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.set('view', tab);
    searchParams.set('tab', tab);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.set(key, value);
      }
    });

    const currentPath = location.pathname;
    const newUrl = leagueId && currentPath.startsWith(`/league/${leagueId}`)
      ? `/league/${leagueId}?${searchParams.toString()}`
      : `${currentPath}?${searchParams.toString()}`;

    if (location.pathname + location.search !== newUrl) {
      console.log('Updating URL without full reload:', newUrl);
      navigate(newUrl, { replace: true });
    }
  }, [leagueId, location.pathname, location.search, navigate]);

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
  }, [leagueId, activeTab, onTabChange, params, location.pathname, updateUrlWithoutRefresh]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsMobileTabs(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { canEdit: statusCanEdit } = getStatusInfo(gameData);
  const canEditEntryTab = canEditEntry(gameData);

  // Pre-render all tab components but only show the active one
  // This prevents losing state when switching tabs
  const tabComponents = useMemo(() => {
    return Object.entries(tabs).reduce((acc, [tabId, tab]) => {
      const showLocked = tab.requiresEdit && !canEditEntryTab;
      if (tab.component && !showLocked) {
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
      if (showLocked && tab.lockedComponent) {
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
  }, [tabs, activeTab, leagueId, gameData, params, onParamChange, canEditEntryTab]);

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
  }, [loading, gameData, defaultTab, activeTab, getStatusInfo, tabs, params, leagueId, location.pathname, onTabChange, updateUrlWithoutRefresh]);

  // Handle tab switching
  const handleTabClick = useCallback((tabId) => {
    if (tabId === activeTab) return;

    if (!tabs[tabId]) return;

    setActiveTab(tabId);
    onTabChange(tabId);
    
    if (leagueId && location.pathname.startsWith(`/league/${leagueId}`)) {
      updateUrlWithoutRefresh(tabId, params);
      onParamChange({ ...params, view: tabId });
    }
  }, [activeTab, tabs, params, onParamChange, leagueId, location.pathname, onTabChange, updateUrlWithoutRefresh]);

  const isAdmin = league && league.ownerId === currentUser?.uid;
  const tabEntries = useMemo(() => Object.entries(tabs), [tabs]);
  const tabKeys = useMemo(() => tabEntries.map(([tabId]) => tabId), [tabEntries]);
  const activeIndex = tabKeys.length > 0 ? Math.max(0, tabKeys.indexOf(activeTab)) : 0;
  const activeTabId = tabKeys[activeIndex] || null;
  const accessibleTabKeys = tabKeys;

  const renderTabCard = useCallback((tabId, tab) => {
    if (!tab) return null;
    const tabColor = tab.color || 'primary';
    const isActive = activeTab === tabId;

    return (
      <div
        key={tabId}
        className={classNames(
          'rounded-lg shadow-md p-4 border-2 cursor-pointer transition h-full',
          tab.requiresEdit && !canEditEntryTab ? 'opacity-75' : '',
          isActive
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
          <div
            className={classNames(
              'p-3 rounded-full',
              isActive
                ? getColorClass(tabColor, '100', 'bg')
                : getColorClass('background', 'paper')
            )}
          >
            {React.cloneElement(tab.icon, {
              className: isActive
                ? getColorClass(tabColor, '500', 'text')
                : getColorClass('text', 'secondary')
            })}
          </div>
          <div className="ml-3">
            <h3
              className={classNames(
                'font-semibold',
                isActive
                  ? getColorClass(tabColor, '700', 'text')
                  : getColorClass('text', 'primary')
              )}
            >
              {tab.title}
            </h3>
            <p className={getColorClass('text', 'secondary')}>
              {tab.requiresEdit && !canEditEntryTab
                ? tab.lockedDescription || 'Locked'
                : tab.description}
            </p>
          </div>
        </div>
      </div>
    );
  }, [activeTab, canEditEntryTab, handleTabClick]);

  const activeAccessibleIndex = accessibleTabKeys.indexOf(activeTab);
  const normalizedAccessibleIndex = activeAccessibleIndex >= 0 ? activeAccessibleIndex : 0;
  const hasPrevious = normalizedAccessibleIndex > 0;
  const hasNext = normalizedAccessibleIndex >= 0 && normalizedAccessibleIndex < accessibleTabKeys.length - 1;

  const handleStepTab = useCallback(
    (direction) => {
      if (!accessibleTabKeys.length) return;
      const targetIndex =
        direction < 0
          ? Math.max(0, normalizedAccessibleIndex - 1)
          : Math.min(accessibleTabKeys.length - 1, normalizedAccessibleIndex + 1);
      const nextTabId = accessibleTabKeys[targetIndex];
      if (nextTabId && nextTabId !== activeTab) {
        handleTabClick(nextTabId);
      }
    },
    [accessibleTabKeys, normalizedAccessibleIndex, activeTab, handleTabClick]
  );

  const gridColumnsClass = `grid grid-cols-1 md:grid-cols-${Math.max(1, tabKeys.length)} gap-4`;

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
        getColorClass('error', 'light', 'bg'),
        'border',
        getColorClass('error', 'main', 'border'),
        getColorClass('error', 'dark', 'text'),
        'px-4 py-3 rounded mb-4'
      )}>
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && AdminButton && (
        <div className="mb-6">
          <AdminButton leagueId={leagueId} navigate={navigate} />
        </div>
      )}
      
      {isMobileTabs ? (
        <div className="flex items-stretch gap-3">
          <button
            type="button"
            className={classNames(
              'px-3 py-4 rounded-lg border transition h-full flex items-center justify-center',
              hasPrevious
                ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            )}
            onClick={() => handleStepTab(-1)}
            disabled={!hasPrevious}
            aria-label="Previous tab"
          >
            <FaChevronLeft />
          </button>
          <div className="flex-1">
            {activeTabId && renderTabCard(activeTabId, tabs[activeTabId])}
            <div className="mt-2 text-center text-xs text-gray-500">
              {accessibleTabKeys.length ? `${normalizedAccessibleIndex + 1} / ${accessibleTabKeys.length}` : ''}
            </div>
          </div>
          <button
            type="button"
            className={classNames(
              'px-3 py-4 rounded-lg border transition h-full flex items-center justify-center',
              hasNext
                ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            )}
            onClick={() => handleStepTab(1)}
            disabled={!hasNext}
            aria-label="Next tab"
          >
            <FaChevronRight />
          </button>
        </div>
      ) : (
        <div className={gridColumnsClass}>
          {tabEntries.map(([tabId, tab]) => renderTabCard(tabId, tab))}
        </div>
      )}
      
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
