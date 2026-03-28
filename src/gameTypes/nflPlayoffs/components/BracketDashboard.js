import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaEdit, FaEye, FaChartLine, FaCog } from 'react-icons/fa';
import BaseDashboard from '../../common/components/BaseDashboard';
import BracketEdit from './BracketEdit';
import BracketView from './BracketView';
import Leaderboard from './Leaderboard';
import { ROUND_KEYS } from '../constants/playoffConstants';
import { ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

const BracketDashboard = ({
  leagueId,
  league,
  isEmbedded = false,
  onViewBracket,
  urlParams = {},
  dashboardKey = 0,
  forceTabReset = false,
  gameTypeId = 'nflPlayoffs'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultTab = 'edit';

  const gameDataListenerRef = useRef(null);
  const lockListenerRef = useRef(null);

  const [activeParams, setActiveParams] = useState(() => {
    if (forceTabReset) return {};
    const searchParams = new URLSearchParams(location.search);
    const userId = searchParams.get('userId');
    const bracketId = searchParams.get('bracketId');
    return userId || bracketId ? { bracketId: bracketId || userId } : {};
  });

  const [activeTab, setActiveTab] = useState(() => {
    if (forceTabReset) return defaultTab;
    const searchParams = new URLSearchParams(location.search);
    const tabFromUrl = searchParams.get('view') || searchParams.get('tab');
    return tabFromUrl || defaultTab;
  });

  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [lockStatus, setLockStatus] = useState({});
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (!leagueId) return;

    const storedKeys = [`bracket-dashboard-${leagueId}-return`, `playoffs-dashboard-${leagueId}-return`];
    storedKeys.forEach((key) => sessionStorage.removeItem(key));

    if (forceTabReset && location.pathname.startsWith(`/league/${leagueId}`)) {
      const searchParams = new URLSearchParams();
      searchParams.set('view', defaultTab);
      searchParams.set('tab', defaultTab);
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    }

    return () => {
      [gameDataListenerRef, lockListenerRef].forEach((ref) => {
        if (ref.current) ref.current();
        ref.current = null;
      });
    };
  }, [leagueId, dashboardKey, forceTabReset, navigate, location.pathname, defaultTab]);

  const loadPlayoffsData = useCallback(async (leagueId) => {
    if (gameDataListenerRef.current) gameDataListenerRef.current();

    const gameDataRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
    const gameDataSnap = await getDoc(gameDataRef);

    if (gameDataSnap.exists()) {
      const initialData = gameDataSnap.data();
      setGameData(initialData);
      setDataReady(true);

      gameDataListenerRef.current = onSnapshot(
        gameDataRef,
        (docSnap) => {
          if (docSnap.exists()) setGameData(docSnap.data());
        },
        (error) => console.error('[NFL Playoffs] Error in game data listener:', error)
      );
      return initialData;
    }

    setDataReady(true);
    return null;
  }, []);

  useEffect(() => {
    const fetchSettingsAndData = async () => {
      try {
        await loadPlayoffsData(leagueId);

        const visibilityRef = doc(db, 'leagues', leagueId, 'settings', 'visibility');
        const visibilitySnap = await getDoc(visibilityRef);
        if (visibilitySnap.exists()) {
          setFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
        }

        const locksRef = doc(db, 'leagues', leagueId, 'locks', 'lockStatus');
        lockListenerRef.current = onSnapshot(
          locksRef,
          (lockSnap) => {
            if (lockSnap.exists()) {
              setLockStatus(lockSnap.data() || {});
            } else {
              setLockStatus({});
            }
          },
          (error) => {
            console.error('[BracketDashboard] Lock listener error:', error);
            setLockStatus({});
          }
        );
      } catch (err) {
        console.error('Error fetching settings or game data:', err);
        setDataReady(true);
      }
    };

    if (leagueId) fetchSettingsAndData();
  }, [leagueId, loadPlayoffsData]);

  const canEditBracket = useCallback(
    (gameData) => {
      if (!gameData) return true;
      if (gameData[ROUND_KEYS.CHAMPION]) return false;
      const roundsInOrder = [
        ROUND_KEYS.FIRST_ROUND,
        ROUND_KEYS.CONF_SEMIS,
        ROUND_KEYS.CONF_FINALS,
        ROUND_KEYS.SUPER_BOWL
      ];
      return roundsInOrder.some((roundKey) => !lockStatus?.[roundKey]?.locked);
    },
    [lockStatus]
  );

  const getTournamentStatusInfo = useCallback((gameData) => {
    if (!gameData) return { status: 'Not Started', canEdit: true, defaultTabWhenComplete: null };
    if (gameData[ROUND_KEYS.CHAMPION]) return { status: 'Completed', canEdit: false, defaultTabWhenComplete: 'leaderboard' };
    const firstRoundStarted = gameData[ROUND_KEYS.FIRST_ROUND]?.some((match) => match?.winner);
    return {
      status: firstRoundStarted ? 'In Progress' : 'Not Started',
      canEdit: !firstRoundStarted,
      defaultTabWhenComplete: null
    };
  }, []);

  const AdminButton = useCallback(() => {
    const handleAdminClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const searchParams = new URLSearchParams(location.search);
      const currentTab = searchParams.get('view') || searchParams.get('tab') || defaultTab;
      sessionStorage.setItem(`bracket-dashboard-${leagueId}-return`, currentTab);

      searchParams.set('view', 'admin');
      searchParams.delete('tab');
      searchParams.delete('subview');
      searchParams.delete('bracketId');
      searchParams.delete('userId');
      navigate(`/league/${leagueId}?${searchParams.toString()}`);
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

  const lockedDescription = useMemo(() => {
    const roundsInOrder = [
      ROUND_KEYS.FIRST_ROUND,
      ROUND_KEYS.CONF_SEMIS,
      ROUND_KEYS.CONF_FINALS,
      ROUND_KEYS.SUPER_BOWL
    ];
    const openRounds = roundsInOrder.filter(
      (roundKey) => !lockStatus?.[roundKey]?.locked
    );
    if (openRounds.length === 0) {
      return 'All rounds are locked by admin';
    }
    const openLabels = openRounds.map(
      (roundKey) => ROUND_DISPLAY_NAMES[roundKey] || roundKey
    );
    return `Open rounds: ${openLabels.join(', ')}`;
  }, [lockStatus]);

  const TournamentLockedComponent = useCallback(
    () => (
      <div className="p-6 text-center">
        <p className="text-gray-600">{lockedDescription}</p>
      </div>
    ),
    [lockedDescription]
  );

  const handleParamChange = useCallback(
    (params) => {
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
    },
    [activeParams, activeTab, leagueId, location, navigate, isEmbedded]
  );

  const handleViewBracketFromLeaderboard = useCallback(
    (bracketId) => {
      if (isEmbedded && onViewBracket) {
        onViewBracket(bracketId);
        return true;
      }
      handleParamChange({ bracketId, view: 'view' });
      return false;
    },
    [isEmbedded, onViewBracket, handleParamChange]
  );

  const handleBracketSelect = useCallback(
    (bracketId) => {
      if (isEmbedded && onViewBracket) {
        onViewBracket(bracketId);
        return true;
      }
      handleParamChange({ bracketId, view: 'view' });
      return false;
    },
    [isEmbedded, onViewBracket, handleParamChange]
  );

  const tournamentCompleted = !!gameData?.[ROUND_KEYS.CHAMPION];

  const bracketTabs = useMemo(() => {
    const baseTabs = {
      view: {
        title: 'View Bracket',
        description: 'NFL Playoffs brackets',
        icon: <FaEye />,
        color: 'blue',
        component: BracketView,
        componentProps: {
          initialBracketId: activeParams.bracketId || null,
          onBracketSelect: handleBracketSelect,
          fogOfWarEnabled,
          tournamentCompleted,
          key: `view-${activeParams.bracketId || 'tournament'}-${dashboardKey}`
        }
      },
      edit: {
        title: 'Edit My Bracket',
        description: 'Make your predictions',
        lockedDescription,
        icon: <FaEdit />,
        color: 'green',
        component: BracketEdit,
        requiresEdit: true,
        fallbackTab: 'view',
        lockedComponent: TournamentLockedComponent,
        componentProps: {
          key: `edit-standard-${dashboardKey}`,
          gameData,
          lockStatus
        }
      },
      leaderboard: {
        title: 'Leaderboard',
        description: 'Rankings & scores',
        icon: <FaChartLine />,
        color: 'purple',
        component: Leaderboard,
        componentProps: {
          onViewBracket: handleViewBracketFromLeaderboard,
          fogOfWarEnabled,
          tournamentCompleted,
          key: `leaderboard-${activeTab || 'default'}-${dashboardKey}`
        }
      }
    };

    return baseTabs;
  }, [
    activeParams.bracketId,
    activeTab,
    fogOfWarEnabled,
    handleBracketSelect,
    handleViewBracketFromLeaderboard,
    tournamentCompleted,
    gameData,
    TournamentLockedComponent,
    dashboardKey,
    lockStatus
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
      key={`nfl-playoffs-dashboard-${dashboardKey}`}
    />
  );
};

export default BracketDashboard;
