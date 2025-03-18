import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaBasketballBall, FaEdit, FaEye, FaChartLine, FaCog } from 'react-icons/fa';
import BaseDashboard from '../../common/components/BaseDashboard';
import BracketEdit from './BracketEdit';
import BracketView from './BracketView';
import Leaderboard from './Leaderboard';

const BracketDashboard = ({ leagueId, league, isEmbedded = false, onViewBracket, urlParams = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract params from URL once on component mount or when URL changes significantly
  const [activeParams, setActiveParams] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    const userId = searchParams.get('userId');
    const bracketId = searchParams.get('bracketId');
    // Support both parameter formats - userId for backward compatibility
    return (userId || bracketId) ? { bracketId: bracketId || userId } : {};
  });
  
  const [activeTab, setActiveTab] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    // Support both parameter formats - tab for backward compatibility, view for new format
    return searchParams.get('view') || searchParams.get('tab') || 'edit';
  });
  
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [gameData, setGameData] = useState(null);

  // Log current URL state for debugging
  useEffect(() => {
    console.log("BracketDashboard URL:", location.search, "activeTab:", activeTab);
  }, [location.search, activeTab]);

  // Load game data only once or when leagueId changes
  const loadMarchMadnessData = useCallback(async (leagueId) => {
    const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
    const gameDataSnap = await getDoc(gameDataRef);
    return gameDataSnap.exists() ? gameDataSnap.data() : null;
  }, []);

  const canEditBracket = useCallback((gameData) => !gameData?.Champion, []);

  const getTournamentStatusInfo = useCallback((gameData) => {
    if (!gameData) return { status: "Not Started", canEdit: true, defaultTabWhenComplete: 'view' };
    if (gameData.Champion) return { status: "Completed", canEdit: false, defaultTabWhenComplete: 'view' };
    if (gameData.RoundOf64 && gameData.RoundOf64.some(match => match && match.winner))
      return { status: "In Progress", canEdit: true, defaultTabWhenComplete: null };
    return { status: "Not Started", canEdit: true, defaultTabWhenComplete: null };
  }, []);

  useEffect(() => {
    const fetchSettingsAndData = async () => {
      try {
        const gameData = await loadMarchMadnessData(leagueId);
        setGameData(gameData);

        const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
        const visibilitySnap = await getDoc(visibilityRef);
        if (visibilitySnap.exists()) {
          const settings = visibilitySnap.data();
          setFogOfWarEnabled(settings.fogOfWarEnabled || false);
        }
      } catch (err) {
        console.error("Error fetching settings or game data:", err);
      }
    };

    if (leagueId) fetchSettingsAndData();
  }, [leagueId, loadMarchMadnessData]);

  // AdminButton component with improved parameter navigation
  const AdminButton = useCallback(({ leagueId, navigate }) => {
    const handleAdminClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Store current tab to return to after admin
      const searchParams = new URLSearchParams(location.search);
      const currentTab = searchParams.get('view') || searchParams.get('tab') || 'view';
      
      // Store the return state in sessionStorage
      sessionStorage.setItem(`bracket-dashboard-${leagueId}-return`, currentTab);
      
      // Set admin view and preserve bracketId if present
      searchParams.set('view', 'admin');
      searchParams.set('tab', 'admin'); // For backward compatibility
      
      const adminUrl = `/league/${leagueId}?${searchParams.toString()}`;
      
      console.log("Navigating to admin:", adminUrl);
      navigate(adminUrl, { replace: true });
    };
    
    return (
      <div
        className="rounded-lg shadow-md p-4 border-2 cursor-pointer transition border-gray-200 hover:border-blue-300 bg-white"
        onClick={handleAdminClick}
      >
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-gray-100">
            <FaCog className="text-gray-500" />
          </div>
          <div className="ml-4">
            <h3 className="font-semibold text-gray-700">League Administration</h3>
            <p className="text-sm text-gray-500">Manage tournament teams, brackets, and league settings</p>
          </div>
        </div>
      </div>
    );
  }, [location.search, navigate]);

  const TournamentLockedComponent = useCallback(({ onSwitchTab, fallbackTab }) => (
    <div className="p-6">
      {/* <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h3 className="text-xl font-semibold text-yellow-800 mb-2">Tournament Locked</h3>
        <p className="text-yellow-700">
          The tournament is complete and brackets can no longer be edited. 
          You can view all brackets and check the leaderboard.
        </p>
        <button 
          onClick={() => onSwitchTab(fallbackTab || 'view')} 
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          View Brackets Instead
        </button>
      </div> */}
    </div>
  ), []);

  // Using replace instead of push to avoid adding to browser history
  // This prevents back button from cycling through parameter changes
  const handleParamChange = useCallback((params) => {
    const newParams = {
      ...activeParams,
      ...Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'tab' && key !== 'view'))
    };
    // Support both parameter formats
    const newTab = params.view || params.tab || activeTab;

    const paramsChanged = Object.keys(newParams).some(key => newParams[key] !== activeParams[key]);
    const tabChanged = newTab !== activeTab;

    if (paramsChanged) setActiveParams(newParams);
    if (tabChanged) setActiveTab(newTab);

    const currentPath = location.pathname;
    if (!isEmbedded && currentPath.startsWith(`/league/${leagueId}`)) {
      const searchParams = new URLSearchParams();
      
      // Add parameters to URL
      if (newParams.bracketId) {
        searchParams.set('bracketId', newParams.bracketId);
        // Support legacy userId parameter
        searchParams.set('userId', newParams.bracketId);
      }
      
      if (newTab) {
        searchParams.set('view', newTab);
        // Support legacy tab parameter
        searchParams.set('tab', newTab);
      }
      
      const newUrl = `${currentPath}?${searchParams.toString()}`;
      if (location.pathname + location.search !== newUrl) {
        console.log("Navigating to:", newUrl);
        // Use replace: true to avoid adding to browser history
        navigate(newUrl, { replace: true });
      }
    }
  }, [activeParams, activeTab, leagueId, location, navigate, isEmbedded]);

  const handleViewBracketFromLeaderboard = useCallback((bracketId) => {
    if (isEmbedded && onViewBracket) {
      onViewBracket(bracketId);
      return true;
    }
    handleParamChange({ bracketId, view: 'view' });
    return false;
  }, [isEmbedded, onViewBracket, handleParamChange]);

  const handleBracketSelect = useCallback((bracketId) => {
    if (isEmbedded && onViewBracket) {
      onViewBracket(bracketId);
      return true;
    }
    handleParamChange({ bracketId, view: 'view' });
    return false;
  }, [isEmbedded, onViewBracket, handleParamChange]);

  const tournamentCompleted = gameData?.Champion ? true : false;

  // Define tabs with memoization to prevent unnecessary recreations
  const bracketTabs = useMemo(() => ({
    'view': {
      title: 'View Bracket',
      description: 'Tournament brackets',
      icon: <FaEye />,
      color: 'blue',
      component: BracketView,
      componentProps: {
        initialBracketId: activeParams.bracketId || null,
        onBracketSelect: handleBracketSelect,
        fogOfWarEnabled: fogOfWarEnabled,
        tournamentCompleted: tournamentCompleted,
        key: `view-${activeParams.bracketId || 'tournament'}`
      }
    },
    'edit': {
      title: 'Edit My Bracket',
      description: 'Make your predictions',
      lockedDescription: 'Tournament locked',
      icon: <FaEdit />,
      color: 'green',
      component: BracketEdit,
      requiresEdit: true,
      fallbackTab: 'view',
      lockedComponent: TournamentLockedComponent
    },
    'leaderboard': {
      title: 'Leaderboard',
      description: 'Rankings & scores',
      icon: <FaChartLine />,
      color: 'purple',
      component: Leaderboard,
      componentProps: {
        onViewBracket: handleViewBracketFromLeaderboard,
        fogOfWarEnabled: fogOfWarEnabled,
        tournamentCompleted: tournamentCompleted,
        key: `leaderboard-${activeTab || 'default'}`
      }
    }
  }), [
    activeParams.bracketId, 
    activeTab, 
    fogOfWarEnabled, 
    handleBracketSelect, 
    handleViewBracketFromLeaderboard, 
    tournamentCompleted, 
    TournamentLockedComponent
  ]);

  console.log("BracketDashboard rendering with:", { 
    leagueId, 
    isEmbedded, 
    activeTab,
    urlParams
  });

  return (
    <BaseDashboard
      leagueId={leagueId}
      league={league}
      tabs={bracketTabs}
      activeTab={activeTab}
      params={activeParams}
      onTabChange={(tab) => setActiveTab(tab)}
      onParamChange={handleParamChange}
      getGameData={loadMarchMadnessData}
      canEditEntry={canEditBracket}
      getStatusInfo={getTournamentStatusInfo}
      AdminButton={AdminButton}
      customUrlParams={['bracketId', 'userId']}
    />
  );
};

export default BracketDashboard;