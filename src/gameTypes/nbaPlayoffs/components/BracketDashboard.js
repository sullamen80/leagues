import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaEdit, FaEye, FaChartLine, FaCog, FaFilter } from 'react-icons/fa';
import BaseDashboard from '../../common/components/BaseDashboard';
import BracketEdit from './BracketEdit';
import BracketView from './BracketView';
import Leaderboard from './Leaderboard';
import UserPlayInPanel from './UserPlayInPanel';
import { ROUND_KEYS } from '../constants/playoffConstants';

const saveBracket = async (leagueId, userId, bracketData) => {
  try {
    const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const userBracketSnap = await getDoc(userBracketRef);
    let currentData = userBracketSnap.exists() ? userBracketSnap.data() : {};

    await setDoc(userBracketRef, {
      ...currentData,
      ...bracketData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving bracket:", error);
    throw error;
  }
};

const BracketDashboard = ({ 
  leagueId, 
  league, 
  isEmbedded = false, 
  onViewBracket, 
  urlParams = {},
  dashboardKey = 0,
  forceTabReset = false,
  gameTypeId = 'nbaPlayoffs'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultTab = 'edit';

  const [activeParams, setActiveParams] = useState(() => {
    if (forceTabReset) {
      console.log('[NBA Playoffs] Forcing params reset');
      return {};
    }
    
    const searchParams = new URLSearchParams(location.search);
    const userId = searchParams.get('userId');
    const bracketId = searchParams.get('bracketId');
    return (userId || bracketId) ? { bracketId: bracketId || userId } : {};
  });
  
  const [activeTab, setActiveTab] = useState(() => {
    if (forceTabReset) {
      console.log(`[NBA Playoffs] Forcing tab reset to: ${defaultTab}`);
      return defaultTab;
    }
    
    const searchParams = new URLSearchParams(location.search);
    const tabFromUrl = searchParams.get('view') || searchParams.get('tab');
    return tabFromUrl || defaultTab;
  });
  
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [userBracket, setUserBracket] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  useEffect(() => {
    console.log(`[NBA Playoffs] Dashboard mounted/remounted for league: ${leagueId}, key: ${dashboardKey}`);
    
    if (leagueId) {
      const storedKeys = [
        `bracket-dashboard-${leagueId}-return`,
        `playoffs-dashboard-${leagueId}-return`
      ];
      
      storedKeys.forEach(key => {
        if (sessionStorage.getItem(key)) {
          console.log(`[NBA Playoffs] Clearing stored key: ${key}`);
          sessionStorage.removeItem(key);
        }
      });
    }
    
    if (forceTabReset && leagueId) {
      const currentPath = location.pathname;
      if (currentPath.startsWith(`/league/${leagueId}`)) {
        console.log('[NBA Playoffs] Resetting URL parameters');
        const searchParams = new URLSearchParams();
        searchParams.set('view', defaultTab);
        searchParams.set('tab', defaultTab);
        const newUrl = `${currentPath}?${searchParams.toString()}`;
        navigate(newUrl, { replace: true });
      }
    }
    
    return () => {
      console.log(`[NBA Playoffs] Dashboard unmounting for league: ${leagueId}`);
    };
  }, [leagueId, dashboardKey, forceTabReset, navigate, location.pathname, defaultTab]);

  useEffect(() => {
    console.log("[NBA Playoffs] URL:", location.search, "activeTab:", activeTab);
  }, [location.search, activeTab]);

  const loadPlayoffsData = useCallback(async (leagueId) => {
    console.log(`[NBA Playoffs] Loading game data for: ${leagueId}`);
    const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
    const gameDataSnap = await getDoc(gameDataRef);
    
    if (gameDataSnap.exists()) {
      const data = gameDataSnap.data();
      setGameData(data);
      return data;
    }
    return null;
  }, []);

  const loadUserBracket = useCallback(async (leagueId, userId) => {
    if (!leagueId || !userId) return null;
    
    try {
      const bracketRef = doc(db, "leagues", leagueId, "userData", userId);
      const bracketSnap = await getDoc(bracketRef);
      
      if (bracketSnap.exists()) {
        const userBracketData = bracketSnap.data();
        setUserBracket(userBracketData);
        return userBracketData;
      }
      return null;
    } catch (error) {
      console.error("Error loading user bracket:", error);
      return null;
    }
  }, []);

  const handleUpdateBracket = useCallback((updatedBracket) => {
    setUserBracket(updatedBracket);
    console.log("Updated userBracket locally:", updatedBracket);
  }, []);

  const handleSaveBracket = useCallback(async () => {
    if (!leagueId || !userBracket) return;
    
    try {
      setIsSaving(true);
      setSaveFeedback(null);
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("No authenticated user");
      
      await saveBracket(leagueId, userId, userBracket);
      setSaveFeedback("Saved successfully!");
      setTimeout(() => setSaveFeedback(null), 3000); // Clear feedback after 3s
    } catch (error) {
      console.error("Error saving bracket:", error);
      setSaveFeedback("Failed to save: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }, [leagueId, userBracket]);

  const canEditBracket = useCallback((gameData) => {
    if (!gameData) return true;
    
    if (gameData[ROUND_KEYS.CHAMPION]) return false;
    
    return !(gameData[ROUND_KEYS.FIRST_ROUND] && 
             gameData[ROUND_KEYS.FIRST_ROUND].some(match => match && match.winner));
  }, []);

  const getTournamentStatusInfo = useCallback((gameData) => {
    if (!gameData) return { status: "Not Started", canEdit: true, defaultTabWhenComplete: 'leaderboard' };
    
    if (gameData[ROUND_KEYS.CHAMPION]) {
      return { status: "Completed", canEdit: false, defaultTabWhenComplete: 'leaderboard' };
    }
    
    const firstRoundStarted = gameData[ROUND_KEYS.FIRST_ROUND] && 
                             gameData[ROUND_KEYS.FIRST_ROUND].some(match => match && match.winner);
    
    if (firstRoundStarted) {
      return { status: "In Progress", canEdit: false, defaultTabWhenComplete: null };
    }
    
    return { status: "Not Started", canEdit: true, defaultTabWhenComplete: null };
  }, []);

  useEffect(() => {
    const fetchSettingsAndData = async () => {
      try {
        const gameData = await loadPlayoffsData(leagueId);
        setGameData(gameData);

        if (activeTab === 'play-in') {
          const userId = auth.currentUser?.uid;
          if (userId) {
            await loadUserBracket(leagueId, userId);
          }
        }

        const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
        const visibilitySnap = await getDoc(visibilityRef);
        if (visibilitySnap.exists()) {
          const settings = visibilitySnap.data();
          setFogOfWarEnabled(settings.fogOfWarEnabled || false);
        }

        const lockRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
        const lockSnap = await getDoc(lockRef);
        if (lockSnap.exists()) {
          const lockData = lockSnap.data();
          const isFirstRoundLocked = lockData[ROUND_KEYS.FIRST_ROUND]?.locked || false;
          setIsLocked(isFirstRoundLocked);
        }
      } catch (err) {
        console.error("Error fetching settings or game data:", err);
      }
    };

    if (leagueId) fetchSettingsAndData();
  }, [leagueId, loadPlayoffsData, activeTab, loadUserBracket]);

  const AdminButton = useCallback(({ leagueId, navigate }) => {
    const handleAdminClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const searchParams = new URLSearchParams(location.search);
      const currentTab = searchParams.get('view') || searchParams.get('tab') || 'leaderboard';
      
      sessionStorage.setItem(`bracket-dashboard-${leagueId}-return`, currentTab);
      
      searchParams.set('view', 'admin');
      searchParams.set('tab', 'admin');
      
      const adminUrl = `/league/${leagueId}?${searchParams.toString()}`;
      console.log("[NBA Playoffs] Navigating to admin:", adminUrl);
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
            <p className="text-sm text-gray-500">Manage playoff teams, brackets, and league settings</p>
          </div>
        </div>
      </div>
    );
  }, [location.search, navigate]);

  const TournamentLockedComponent = useCallback(({ onSwitchTab, fallbackTab }) => (
    <div className="p-6">
      {/* Tournament Locked Message */}
    </div>
  ), []);

  const handleParamChange = useCallback((params) => {
    const newParams = {
      ...activeParams,
      ...Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'tab' && key !== 'view'))
    };
    const newTab = params.view || params.tab || activeTab;

    const paramsChanged = Object.keys(newParams).some(key => newParams[key] !== activeParams[key]);
    const tabChanged = newTab !== activeTab;

    if (paramsChanged) setActiveParams(newParams);
    if (tabChanged) setActiveTab(newTab);

    const currentPath = location.pathname;
    if (!isEmbedded && currentPath.startsWith(`/league/${leagueId}`)) {
      const searchParams = new URLSearchParams();
      
      if (newParams.bracketId) {
        searchParams.set('bracketId', newParams.bracketId);
        searchParams.set('userId', newParams.bracketId);
      }
      
      if (newTab) {
        searchParams.set('view', newTab);
        searchParams.set('tab', newTab);
      }
      
      const newUrl = `${currentPath}?${searchParams.toString()}`;
      if (location.pathname + location.search !== newUrl) {
        console.log("[NBA Playoffs] Navigating to:", newUrl);
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

  const tournamentCompleted = gameData?.[ROUND_KEYS.CHAMPION] ? true : false;
  const isPlayInEnabled = gameData?.playInTournamentEnabled || false;

  const bracketTabs = useMemo(() => {
    const baseTabs = {
      'view': {
        title: 'View Bracket',
        description: 'NBA Playoffs brackets',
        icon: <FaEye />,
        color: 'blue',
        component: BracketView,
        componentProps: {
          initialBracketId: activeParams.bracketId || null,
          onBracketSelect: handleBracketSelect,
          fogOfWarEnabled: fogOfWarEnabled,
          tournamentCompleted: tournamentCompleted,
          key: `view-${activeParams.bracketId || 'tournament'}-${dashboardKey}`
        }
      },
      'edit': {
        title: 'Edit My Bracket',
        description: 'Make your predictions',
        lockedDescription: 'Playoffs locked',
        icon: <FaEdit />,
        color: 'green',
        component: BracketEdit,
        requiresEdit: true,
        fallbackTab: 'view',
        lockedComponent: TournamentLockedComponent,
        componentProps: {
          key: `edit-standard-${dashboardKey}`
        }
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
          key: `leaderboard-${activeTab || 'default'}-${dashboardKey}`
        }
      }
    };

    if (isPlayInEnabled) {
      baseTabs['play-in'] = {
        title: 'Play-In Tournament',
        description: 'Play-In predictions',
        icon: <FaFilter />,
        color: 'orange',
        component: UserPlayInPanel,
        requiresEdit: true,
        fallbackTab: 'view',
        lockedComponent: TournamentLockedComponent,
        componentProps: {
          gameData: gameData,
          userBracket: userBracket,
          onUpdateBracket: handleUpdateBracket,
          onSaveBracket: handleSaveBracket,
          isLocked: isLocked,
          showResults: tournamentCompleted,
          isSaving: isSaving,
          saveFeedback: saveFeedback,
          key: `play-in-${dashboardKey}`
        }
      };
    }

    return baseTabs;
  }, [
    activeParams.bracketId, 
    activeTab, 
    fogOfWarEnabled, 
    handleBracketSelect, 
    handleViewBracketFromLeaderboard,
    handleUpdateBracket,
    handleSaveBracket,
    tournamentCompleted,
    isPlayInEnabled,
    gameData,
    userBracket,
    isLocked,
    isSaving,
    saveFeedback,
    TournamentLockedComponent,
    dashboardKey
  ]);

  console.log("[NBA Playoffs] Dashboard rendering with:", { 
    leagueId, 
    isEmbedded, 
    activeTab,
    urlParams,
    dashboardKey,
    forceTabReset
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
      getGameData={loadPlayoffsData}
      canEditEntry={canEditBracket}
      getStatusInfo={getTournamentStatusInfo}
      AdminButton={AdminButton}
      customUrlParams={['bracketId', 'userId']}
      gameTypeId={gameTypeId}
      initialResetTabs={forceTabReset}
      forceTabReset={forceTabReset}
      defaultTab={defaultTab}
      key={`nba-playoffs-dashboard-${dashboardKey}`}
    />
  );
};

export default BracketDashboard;