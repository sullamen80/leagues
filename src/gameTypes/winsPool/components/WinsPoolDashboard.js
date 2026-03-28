import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaChartLine, FaClipboardList, FaCog, FaUsers, FaTrophy } from 'react-icons/fa';
import BaseDashboard from '../../common/components/BaseDashboard';
import MyRosterTab from './overview/MyRosterTab';
import StandingsTab from './overview/StandingsTab';
import Leaderboard from './Leaderboard';
import { DRAFT_STATUS, COLLECTION_KEYS, GAME_DATA_DOCUMENTS } from '../constants/winsPoolConstants';
import DraftRoomTab from './draft/DraftRoomTab';

const normalizeDraftSnapshot = (draft) => {
  if (!draft || typeof draft !== 'object') return null;

  const picks = Array.isArray(draft.picks)
    ? draft.picks.map((pick) => ({ ...pick }))
    : [];

  const order = Array.isArray(draft.order) ? [...draft.order] : [];

  const doubleSnakeConfig = draft.doubleSnakeConfig
    ? {
        ...draft.doubleSnakeConfig,
        groups: Array.isArray(draft.doubleSnakeConfig.groups)
          ? draft.doubleSnakeConfig.groups.map((group) => ({
              ...group,
              teamIds: Array.isArray(group.teamIds) ? [...group.teamIds] : []
            }))
          : []
      }
    : draft.doubleSnakeConfig ?? null;

  return {
    ...draft,
    picks,
    order,
    doubleSnakeConfig
  };
};

const WinsPoolDashboard = ({
  leagueId,
  league,
  forceTabReset = false,
  dashboardKey = 0,
  activeTab: externalActiveTab = null
}) => {
  const location = useLocation();
  const defaultTab = 'roster';

  const [activeTab, setActiveTab] = useState(externalActiveTab || defaultTab);
  const [gameData, setGameData] = useState(null);
  const [userRoster, setUserRoster] = useState(null);
  const [allRosters, setAllRosters] = useState([]);
  const [teamPool, setTeamPool] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const currentUserId = auth.currentUser?.uid || null;

  const loadWinsPoolData = useCallback(async (leagueId) => {
    const gameDataRef = doc(db, 'leagues', leagueId, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT);
    const gameDataSnap = await getDoc(gameDataRef);
    if (gameDataSnap.exists()) {
      return gameDataSnap.data();
    }
    return null;
  }, []);

  useEffect(() => {
    if (!leagueId) return;

    const winsPoolKey = `winsPool-dashboard-${leagueId}-return`;
    const bracketKey = `bracket-dashboard-${leagueId}-return`;
    const storedTab = sessionStorage.getItem(winsPoolKey) || sessionStorage.getItem(bracketKey);

    if (forceTabReset) {
      sessionStorage.removeItem(winsPoolKey);
      sessionStorage.removeItem(bracketKey);
      setActiveTab(defaultTab);
      return;
    }

    if (!externalActiveTab) {
      if (storedTab && storedTab !== 'admin' && storedTab !== activeTab) {
        sessionStorage.removeItem(winsPoolKey);
        sessionStorage.removeItem(bracketKey);
        setActiveTab(storedTab);
      } else {
        const searchParams = new URLSearchParams(location.search);
        const tabFromUrl = searchParams.get('view') || searchParams.get('tab');
        if (tabFromUrl && tabFromUrl !== activeTab) {
          setActiveTab(tabFromUrl);
        }
      }
    }
  }, [leagueId, forceTabReset, location.search, externalActiveTab, activeTab, defaultTab]);

  useEffect(() => {
    if (externalActiveTab && externalActiveTab !== activeTab) {
      setActiveTab(externalActiveTab);
    }
  }, [externalActiveTab, activeTab]);

  useEffect(() => {
    if (!leagueId) return;

    const gameDataRef = doc(
      db,
      'leagues',
      leagueId,
      COLLECTION_KEYS.GAME_DATA,
      GAME_DATA_DOCUMENTS.CURRENT
    );
    const unsubscribeGameData = onSnapshot(
      gameDataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const normalizedDraft = normalizeDraftSnapshot(data?.draft);
          const normalizedTeamPool = Array.isArray(data?.teamPool?.teams)
            ? data.teamPool.teams.map((team) => ({ ...team }))
            : [];
          setGameData({
            ...data,
            draft: normalizedDraft
          });
          setTeamPool(normalizedTeamPool);
          setDataReady(true);
        } else {
          setGameData(null);
          setTeamPool([]);
          setDataReady(true);
        }
      },
      (error) => {
        console.error('[WinsPool][Dashboard] Failed to listen to game data:', error);
        setDataReady(true);
      }
    );

    return () => unsubscribeGameData();
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) return;

    const rosterRef = collection(db, 'leagues', leagueId, COLLECTION_KEYS.USER_DATA);
    const unsubscribeRosters = onSnapshot(
      rosterRef,
      (snapshot) => {
        const rosterList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setAllRosters(rosterList);
        if (currentUserId) {
          const currentRoster = rosterList.find((entry) => entry.id === currentUserId) || null;
          setUserRoster(currentRoster);
        } else {
          setUserRoster(null);
        }
      },
      (error) => {
        console.error('[WinsPool][Dashboard] Failed to listen to rosters:', error);
        setAllRosters([]);
        setUserRoster(null);
      }
    );

    return () => unsubscribeRosters();
  }, [leagueId, currentUserId]);

  const canEditRoster = useCallback((data) => {
    if (!data) return false;
    return data?.draft?.status !== DRAFT_STATUS.COMPLETED;
  }, []);

  const getLeagueStatusInfo = useCallback((data) => {
    if (!data) {
      return { status: 'Pending', canEdit: true, defaultTabWhenComplete: 'leaderboard' };
    }

    const draftStatus = data?.draft?.status || DRAFT_STATUS.NOT_STARTED;
    let statusLabel = 'Pre-Draft';
    if (draftStatus === DRAFT_STATUS.IN_PROGRESS) {
      statusLabel = 'Draft In Progress';
    } else if (draftStatus === DRAFT_STATUS.COMPLETED) {
      statusLabel = 'In Season';
    }

    return {
      status: statusLabel,
      canEdit: draftStatus !== DRAFT_STATUS.COMPLETED,
      defaultTabWhenComplete: 'leaderboard'
    };
  }, []);

  const handleParamChange = useCallback(() => {
    // Wins pool dashboard currently does not manage extra query params
  }, []);

  const AdminButton = useCallback(({ leagueId, navigate }) => {
    const handleAdminClick = () => {
      sessionStorage.setItem(`winsPool-dashboard-${leagueId}-return`, activeTab);
      sessionStorage.setItem(`bracket-dashboard-${leagueId}-return`, activeTab);
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('view', 'admin');
      searchParams.set('tab', 'admin');
      navigate(`/league/${leagueId}?${searchParams.toString()}`, { replace: true });
    };

    return (
      <div
        className="rounded-xl shadow-sm p-5 border border-gray-200 cursor-pointer transition bg-white hover:border-indigo-300 hover:shadow-md"
        onClick={handleAdminClick}
      >
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-gray-100">
            <FaCog className="text-gray-500" />
          </div>
          <div className="ml-4">
            <h3 className="font-semibold text-gray-700">League Administration</h3>
            <p className="text-sm text-gray-500">Manage draft order, post picks, update wins</p>
          </div>
        </div>
      </div>
    );
  }, [activeTab, location.search]);

  const winsPoolTabs = useMemo(() => {
    const tabs = {
      roster: {
        title: 'Rosters',
        description: 'Each users drafted teams & points',
        icon: <FaUsers />,
        color: 'green',
        component: MyRosterTab,
        componentProps: {
          gameData,
          roster: userRoster,
          teamPool,
          allRosters,
          currentUserId,
          key: `roster-${userRoster?.id || 'guest'}-${dashboardKey}`
        }
      },
      standings: {
        title: 'Standings',
        description: 'Team stats',
        icon: <FaTrophy />,
        color: 'blue',
        component: StandingsTab,
        componentProps: {
          gameData,
          teamPool,
          key: `standings-${dashboardKey}`
        }
      },
      leaderboard: {
        title: 'Leaderboard',
        description: 'Rankings by total wins',
        icon: <FaChartLine />,
        color: 'purple',
        component: Leaderboard,
        componentProps: {
          leagueId,
          gameData,
          teamPool,
          allRosters,
          key: `leaderboard-${dashboardKey}`
        }
      }
    };

    const draftStatus = gameData?.draft?.status || DRAFT_STATUS.NOT_STARTED;
    const shouldShowDraftTab =
      draftStatus === DRAFT_STATUS.IN_PROGRESS || draftStatus === DRAFT_STATUS.PAUSED;

    if (shouldShowDraftTab) {
      tabs.draft = {
        title: 'Draft',
        description: draftStatus === DRAFT_STATUS.PAUSED ? 'Draft paused, review board' : 'Live draft board and picks',
        icon: <FaClipboardList />,
        color: 'indigo',
        component: DraftRoomTab,
        componentProps: {
          leagueId,
          league,
          gameData,
          teamPool,
          userRoster,
          currentUserId,
          key: `draft-${dashboardKey}`,
          draftStatus
        }
      };
    }

    return tabs;
  }, [gameData, userRoster, teamPool, dashboardKey, leagueId, league, currentUserId, allRosters]);

  if (!dataReady) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Wins Pool data...</p>
        </div>
      </div>
    );
  }

  return (
    <BaseDashboard
      leagueId={leagueId}
      league={league}
      tabs={winsPoolTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onParamChange={handleParamChange}
      getGameData={loadWinsPoolData}
      canEditEntry={canEditRoster}
      getStatusInfo={getLeagueStatusInfo}
      AdminButton={AdminButton}
      customUrlParams={[]}
      defaultTab={defaultTab}
      key={`wins-pool-dashboard-${dashboardKey}`}
    />
  );
};

export default WinsPoolDashboard;
