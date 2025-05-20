import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaEdit, FaEye, FaChartLine, FaCog, FaFilter } from 'react-icons/fa';
import BaseDashboard from '../../common/components/BaseDashboard';
import BracketEdit from './BracketEdit';
import BracketView from './BracketView';
import Leaderboard from './Leaderboard';
import UserPlayInPanel from './UserPlayInPanel';
import { ROUND_KEYS } from '../constants/playoffConstants';

// Keep this general saveBracket function for the main bracket
const saveBracket = async (leagueId, userId, bracketData) => {
  try {
    const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const userBracketSnap = await getDoc(userBracketRef);
    let currentData = userBracketSnap.exists() ? userBracketSnap.data() : {};

    await setDoc(userBracketRef, {
      ...currentData,
      ...bracketData,
      updatedAt: new Date().toISOString(),
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
  gameTypeId = 'nbaPlayoffs',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultTab = 'edit';

  const gameDataListenerRef = useRef(null);
  const userBracketListenerRef = useRef(null);
  const lockListenerRef = useRef(null);

  const [activeParams, setActiveParams] = useState(() => {
    if (forceTabReset) return {};
    const searchParams = new URLSearchParams(location.search);
    const userId = searchParams.get('userId');
    const bracketId = searchParams.get('bracketId');
    return (userId || bracketId) ? { bracketId: bracketId || userId } : {};
  });

  const [activeTab, setActiveTab] = useState(() => {
    if (forceTabReset) return defaultTab;
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
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (!leagueId) return;

    const storedKeys = [`bracket-dashboard-${leagueId}-return`, `playoffs-dashboard-${leagueId}-return`];
    storedKeys.forEach(key => sessionStorage.removeItem(key));

    if (forceTabReset && location.pathname.startsWith(`/league/${leagueId}`)) {
      const searchParams = new URLSearchParams();
      searchParams.set('view', defaultTab);
      searchParams.set('tab', defaultTab);
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    }

    return () => {
      [gameDataListenerRef, userBracketListenerRef, lockListenerRef].forEach(ref => {
        if (ref.current) ref.current();
        ref.current = null;
      });
    };
  }, [leagueId, dashboardKey, forceTabReset, navigate, location.pathname, defaultTab]);

  const loadPlayoffsData = useCallback(async (leagueId) => {
    if (gameDataListenerRef.current) gameDataListenerRef.current();

    const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
    const gameDataSnap = await getDoc(gameDataRef);

    if (gameDataSnap.exists()) {
      const initialData = gameDataSnap.data();
      setGameData(initialData);
      setDataReady(true);

      gameDataListenerRef.current = onSnapshot(gameDataRef, (doc) => {
        if (doc.exists()) setGameData(doc.data());
      }, (error) => console.error('[NBA Playoffs] Error in game data listener:', error));
      return initialData;
    }

    setDataReady(true);
    return null;
  }, []);

  const loadUserBracket = useCallback(async (leagueId, userId) => {
    if (!leagueId || !userId) return null;

    if (userBracketListenerRef.current) userBracketListenerRef.current();

    const bracketRef = doc(db, "leagues", leagueId, "userData", userId);
    const bracketSnap = await getDoc(bracketRef);

    if (bracketSnap.exists()) {
      const initialUserData = bracketSnap.data();
      setUserBracket(initialUserData);

      userBracketListenerRef.current = onSnapshot(bracketRef, (doc) => {
        if (doc.exists()) setUserBracket(doc.data());
      }, (error) => console.error('[NBA Playoffs] Error in user bracket listener:', error));
      return initialUserData;
    }
    return null;
  }, []);

  useEffect(() => {
    // When switching tabs, ensure we reload the right data
    if (activeTab === 'play-in' || activeTab === 'edit') {
      const userId = auth.currentUser?.uid;
      if (userId) {
        loadUserBracket(leagueId, userId);
      }
    }
  }, [activeTab, loadUserBracket, leagueId]);

  useEffect(() => {
    const fetchSettingsAndData = async () => {
      try {
        await loadPlayoffsData(leagueId);

        const userId = auth.currentUser?.uid;
        if (userId && (activeTab === 'play-in' || activeTab === 'edit')) {
          await loadUserBracket(leagueId, userId);
        }

        const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
        const visibilitySnap = await getDoc(visibilityRef);
        if (visibilitySnap.exists()) {
          setFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
        }

        const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
        lockListenerRef.current = onSnapshot(locksRef, (lockSnap) => {
          if (lockSnap.exists()) {
            const lockData = lockSnap.data();

            const isPlayInLocked = lockData[ROUND_KEYS.PLAY_IN]?.locked || false;
            const isFirstRoundLocked = lockData[ROUND_KEYS.FIRST_ROUND]?.locked || false;

            setIsLocked(activeTab === 'play-in' ? isPlayInLocked : isFirstRoundLocked);
          } else {
            console.log('[BracketDashboard] No lock data found at leagues/', leagueId, '/locks/lockStatus');
            setIsLocked(false);
          }
        }, (error) => {
          console.error('[BracketDashboard] Lock listener error:', error);
          setIsLocked(false);
        });
      } catch (err) {
        console.error("Error fetching settings or game data:", err);
        setDataReady(true);
      }
    };

    if (leagueId) fetchSettingsAndData();
  }, [leagueId, activeTab, loadPlayoffsData, loadUserBracket]);

  const handleUpdateBracket = useCallback((updatedBracket) => {
    setUserBracket(prevBracket => {
      if (!prevBracket) return updatedBracket;
      
      // Create deep copy of the previous bracket to avoid unintended mutations
      const newBracket = JSON.parse(JSON.stringify(prevBracket));
      
      // Check if we're only updating Play-In data
      if (updatedBracket[ROUND_KEYS.PLAY_IN] && Object.keys(updatedBracket).length === 1) {
        newBracket[ROUND_KEYS.PLAY_IN] = updatedBracket[ROUND_KEYS.PLAY_IN];
        return newBracket;
      }
      
      // For main bracket updates, merge everything except Play-In data
      const mergedBracket = { ...newBracket };
      
      // Copy all properties from updatedBracket except Play-In
      Object.keys(updatedBracket).forEach(key => {
        if (key !== ROUND_KEYS.PLAY_IN) {
          mergedBracket[key] = updatedBracket[key];
        }
      });
      
      return mergedBracket;
    });
  }, []);


  const canEditBracket = useCallback((gameData) => {
    if (!gameData) return true;
    if (gameData[ROUND_KEYS.CHAMPION]) return false;
    return !(gameData[ROUND_KEYS.FIRST_ROUND]?.some(match => match?.winner));
  }, []);

  const getTournamentStatusInfo = useCallback((gameData) => {
    if (!gameData) return { status: "Not Started", canEdit: true, defaultTabWhenComplete: null };
    if (gameData[ROUND_KEYS.CHAMPION]) return { status: "Completed", canEdit: false, defaultTabWhenComplete: 'leaderboard' };
    const firstRoundStarted = gameData[ROUND_KEYS.FIRST_ROUND]?.some(match => match?.winner);
    return {
      status: firstRoundStarted ? "In Progress" : "Not Started",
      canEdit: !firstRoundStarted,
      defaultTabWhenComplete: null,
    };
  }, []);

  const AdminButton = useCallback(() => {
    const handleAdminClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const searchParams = new URLSearchParams(location.search);
      const currentTab = searchParams.get('view') || searchParams.get('tab') || 'leaderboard';
      sessionStorage.setItem(`bracket-dashboard-${leagueId}-return`, currentTab);

      searchParams.set('view', 'admin');
      searchParams.set('tab', 'admin');
      navigate(`/league/${leagueId}?${searchParams.toString()}`, { replace: true });
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
            <p className="text-sm text-gray-500">Manage playoff teams, brackets, and settings</p>
          </div>
        </div>
      </div>
    );
  }, [leagueId, location.search, navigate]);


  const TournamentLockedComponent = useCallback(() => (
    <div className="p-6 text-center">
      <p className="text-gray-600">The tournament is locked. No further edits are allowed.</p>
    </div>
  ), []);

  const handleParamChange = useCallback((params) => {
    const newParams = { ...activeParams, ...params };
    const newTab = params.view || params.tab || activeTab;

    setActiveParams(newParams);
    setActiveTab(newTab);

    if (!isEmbedded && location.pathname.startsWith(`/league/${leagueId}`)) {
      const searchParams = new URLSearchParams();
      if (newParams.bracketId) {
        searchParams.set('bracketId', newParams.bracketId);
        searchParams.set('userId', newParams.bracketId);
      }
      if (newTab) {
        searchParams.set('view', newTab);
        searchParams.set('tab', newTab);
      }
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
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

  const tournamentCompleted = !!gameData?.[ROUND_KEYS.CHAMPION];
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
          key: `edit-standard-${dashboardKey}`,
          gameData: gameData // Pass gameData directly to BracketEdit
        }
      }
    };

    if (isPlayInEnabled) {
      baseTabs['play-in'] = {
        title: 'Play-In Tournament',
        description: 'Play-In predictions',
        icon: <FaFilter />,
        component: UserPlayInPanel,
        requiresEdit: true,
        fallbackTab: 'view',
        lockedComponent: TournamentLockedComponent,
        componentProps: {
          gameData: gameData,
          userBracket: userBracket,
          onUpdateBracket: handleUpdateBracket,
          isLocked: isLocked,
          showResults: tournamentCompleted,
          leagueId: leagueId, // Add leagueId prop
          key: `play-in-${dashboardKey}`
        }
      };
    }
    
    // Adding leaderboard last to make it appear as the last tab
    baseTabs['leaderboard'] = {
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
    };

    return baseTabs;
  }, [
    activeParams.bracketId,
    activeTab,
    fogOfWarEnabled,
    handleBracketSelect,
    handleViewBracketFromLeaderboard,
    handleUpdateBracket,
    tournamentCompleted,
    isPlayInEnabled,
    gameData,
    userBracket,
    isLocked,
    TournamentLockedComponent,
    dashboardKey,
    leagueId,
  ]);

  if (!dataReady) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bracket data...</p>
        </div>
      </div>
    );
  }

  return (
    <BaseDashboard
      leagueId={leagueId}
      league={league}
      tabs={bracketTabs}
      activeTab={activeTab}
      params={activeParams}
      onTabChange={setActiveTab}
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