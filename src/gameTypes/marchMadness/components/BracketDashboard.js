import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaBasketballBall, FaEdit, FaEye, FaChartLine, FaCog } from 'react-icons/fa';
import BaseDashboard from '../../common/components/BaseDashboard';
import BracketEdit from './BracketEdit';
import BracketView from './BracketView';
import Leaderboard from './Leaderboard';

const BracketDashboard = ({ leagueId, league }) => {
  const [activeParams, setActiveParams] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const userId = searchParams.get('userId');
    return userId ? { userId } : {};
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const userId = searchParams.get('userId');
    setActiveParams(prev => {
      if (userId !== prev.userId) {
        return { ...prev, userId };
      }
      return prev;
    });
  }, [location]);

  const loadMarchMadnessData = async (leagueId) => {
    const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
    const gameDataSnap = await getDoc(gameDataRef);
    return gameDataSnap.exists() ? gameDataSnap.data() : null;
  };
  
  const canEditBracket = (gameData) => {
    return !gameData?.Champion;
  };
  
  const getTournamentStatusInfo = (gameData) => {
    if (!gameData) {
      return { status: "Not Started", canEdit: true, defaultTabWhenComplete: 'view' };
    }
    if (gameData.Champion) {
      return { status: "Completed", canEdit: false, defaultTabWhenComplete: 'view' };
    } else if (gameData.RoundOf64 && gameData.RoundOf64.some(match => match && match.winner)) {
      return { status: "In Progress", canEdit: true, defaultTabWhenComplete: null };
    } else {
      return { status: "Not Started", canEdit: true, defaultTabWhenComplete: null };
    }
  };

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

  const handleParamChange = (params) => {
    setActiveParams(prev => {
      const newParams = {
        ...prev,
        ...Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'tab'))
      };
      const paramsChanged = Object.keys(newParams).some(key => newParams[key] !== prev[key]);
      if (paramsChanged) {
        return newParams;
      }
      return prev;
    });
    
    const searchParams = new URLSearchParams();
    if (params.userId || activeParams.userId) {
      searchParams.set('userId', params.userId || activeParams.userId);
    }
    if (params.tab) {
      searchParams.set('tab', params.tab);
    }
    const newUrl = `/league/${leagueId}?${searchParams.toString()}`;
    navigate(newUrl, { replace: true });
  };

  const handleViewBracketFromLeaderboard = (bracketId) => {
    const userId = typeof bracketId === 'object' ? bracketId.id || bracketId : bracketId;
    const newParams = { userId, tab: 'view' };
    handleParamChange(newParams);
    return false;
  };

  const handleBracketSelect = (bracketId) => {
    handleParamChange({ userId: bracketId, tab: 'view' });
    return false;
  };

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
        key: `leaderboard-${activeParams.tab || 'default'}`
      }
    }
  };
  
  const initialTab = new URLSearchParams(location.search).get('tab') || 'edit';
  
  return (
    <BaseDashboard
      leagueId={leagueId}
      league={league}
      tabs={bracketTabs}
      defaultTab={initialTab}
      getGameData={loadMarchMadnessData}
      canEditEntry={canEditBracket}
      getStatusInfo={getTournamentStatusInfo}
      AdminButton={AdminButton}
      customUrlParams={['userId']}
      onParamChange={handleParamChange} // Pass the local handleParamChange
    />
  );
};

export default BracketDashboard;