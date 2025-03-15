import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaBasketballBall, FaEdit, FaEye, FaChartLine, FaCog } from 'react-icons/fa';
import BaseDashboard from '../../common/components/BaseDashboard';
import BracketEdit from './BracketEdit';
import BracketView from './BracketView';
import Leaderboard from './Leaderboard';

const BracketDashboard = ({ leagueId, league, isEmbedded = false, onViewBracket }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeParams, setActiveParams] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const userId = searchParams.get('userId');
    return userId ? { userId } : {};
  });
  const [activeTab, setActiveTab] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('tab') || 'edit';
  });
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [gameData, setGameData] = useState(null);

  const loadMarchMadnessData = async (leagueId) => {
    const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
    const gameDataSnap = await getDoc(gameDataRef);
    return gameDataSnap.exists() ? gameDataSnap.data() : null;
  };

  const canEditBracket = (gameData) => !gameData?.Champion;

  const getTournamentStatusInfo = (gameData) => {
    if (!gameData) return { status: "Not Started", canEdit: true, defaultTabWhenComplete: 'view' };
    if (gameData.Champion) return { status: "Completed", canEdit: false, defaultTabWhenComplete: 'view' };
    if (gameData.RoundOf64 && gameData.RoundOf64.some(match => match && match.winner))
      return { status: "In Progress", canEdit: true, defaultTabWhenComplete: null };
    return { status: "Not Started", canEdit: true, defaultTabWhenComplete: null };
  };

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
          console.log("Fog of War Enabled:", settings.fogOfWarEnabled);
        } else {
          console.log("No visibility settings found, defaulting to Fog of War: false");
        }
      } catch (err) {
        console.error("Error fetching settings or game data:", err);
      }
    };

    if (leagueId) fetchSettingsAndData();
  }, [leagueId]);

  const AdminButton = ({ leagueId, navigate }) => (
    <div
      className="rounded-lg shadow-md p-4 border-2 cursor-pointer transition border-gray-200 hover:border-blue-300 bg-white"
      onClick={() => navigate(`/league/${leagueId}/admin`)}
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

  const TournamentLockedComponent = ({ onSwitchTab, fallbackTab }) => (
    <div className="p-6">
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
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
      </div>
    </div>
  );

  const handleParamChange = useCallback((params) => {
    const newParams = {
      ...activeParams,
      ...Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'tab'))
    };
    const newTab = params.tab || activeTab;

    const paramsChanged = Object.keys(newParams).some(key => newParams[key] !== activeParams[key]);
    const tabChanged = newTab !== activeTab;

    if (paramsChanged) setActiveParams(newParams);
    if (tabChanged) setActiveTab(newTab);

    const currentPath = location.pathname;
    if (!isEmbedded && currentPath.startsWith(`/league/${leagueId}`)) {
      const searchParams = new URLSearchParams();
      if (newParams.userId) searchParams.set('userId', newParams.userId);
      if (newTab) searchParams.set('tab', newTab);
      const newUrl = `/league/${leagueId}?${searchParams.toString()}`;
      if (location.pathname + location.search !== newUrl) {
        console.log("Navigating to:", newUrl);
        navigate(newUrl, { replace: true });
      }
    } else {
      console.log("Skipping URL update; embedded or outside league context");
    }
  }, [activeParams, activeTab, leagueId, location, navigate, isEmbedded]);

  const handleViewBracketFromLeaderboard = useCallback((bracketId) => {
    if (isEmbedded && onViewBracket) {
      console.log("Calling parent onViewBracket for bracketId:", bracketId);
      onViewBracket(bracketId);
      return true;
    }
    handleParamChange({ userId: bracketId, tab: 'view' });
    return false;
  }, [isEmbedded, onViewBracket, handleParamChange]);

  const handleBracketSelect = useCallback((bracketId) => {
    if (isEmbedded && onViewBracket) {
      console.log("Calling parent onViewBracket for bracketId:", bracketId);
      onViewBracket(bracketId);
      return true;
    }
    handleParamChange({ userId: bracketId, tab: 'view' });
    return false;
  }, [isEmbedded, onViewBracket, handleParamChange]);

  const tournamentCompleted = gameData?.Champion ? true : false;

  const bracketTabs = {
    'view': {
      title: 'View Bracket',
      description: 'Tournament brackets',
      icon: <FaEye />,
      color: 'blue',
      component: BracketView,
      componentProps: {
        initialBracketId: activeParams.userId || null,
        onBracketSelect: handleBracketSelect,
        fogOfWarEnabled: fogOfWarEnabled,
        tournamentCompleted: tournamentCompleted,
        key: `view-${activeParams.userId || 'tournament'}`
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
  };

  console.log("BracketDashboard passing to Leaderboard - fogOfWarEnabled:", fogOfWarEnabled, "tournamentCompleted:", tournamentCompleted);

  return (
    <BaseDashboard
      leagueId={leagueId}
      league={league}
      tabs={bracketTabs}
      activeTab={activeTab}
      params={activeParams}
      onTabChange={setActiveTab}
      onParamChange={handleParamChange}
      getGameData={loadMarchMadnessData}
      canEditEntry={canEditBracket}
      getStatusInfo={getTournamentStatusInfo}
      AdminButton={AdminButton}
      customUrlParams={['userId']}
    />
  );
};

export default BracketDashboard;