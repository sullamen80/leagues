import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaCalculator,
  FaCog,
  FaDownload,
  FaTrophy,
  FaUsers
} from 'react-icons/fa';
import BaseAdminDashboard from '../../common/components/BaseAdminDashboard';
import {
  GROUP_STAGE_LOCK_KEY,
  KNOCKOUT_STAGE_LOCK_KEY,
  getQualifiedTeams,
  normalizeGroups
} from '../services/worldCupService';
import WorldCupEndLeagueStats from '../services/EndLeagueStatsService';

const StatCard = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900'
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
};

const AdminActionCard = ({ title, description, icon: Icon, buttonLabel, buttonClassName, buttonStyle, onClick, disabled = false }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    <div className="mb-3 flex items-center">
      <div className="rounded-lg bg-white p-3 shadow-sm">
        <Icon className="text-gray-600" />
      </div>
      <div className="ml-3">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle}
      className={`flex w-full items-center justify-center rounded px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${buttonClassName}`}
    >
      <Icon className="mr-2" />
      {buttonLabel}
    </button>
  </div>
);

const buildPreviewGameData = (gameData = {}) => ({
  groups: normalizeGroups(gameData.groups || []),
  qualifiedThirdPlaceTeamIds: gameData.qualifiedThirdPlaceTeamIds || [],
  knockoutRounds: gameData.knockoutRounds || {},
  knockoutEnabled: Boolean(gameData.knockoutEnabled)
});

const getWorldCupStatus = (gameData) => {
  const finalWinner = gameData?.knockoutRounds?.final?.[0]?.winnerTeamId;
  const groupsCompleted = normalizeGroups(gameData?.groups || []).filter((group) => (group.officialOrder || []).every(Boolean)).length;

  if (finalWinner) {
    return 'Completed';
  }
  if (gameData?.knockoutEnabled) {
    return 'Knockout Live';
  }
  if (groupsCompleted > 0) {
    return 'Groups In Progress';
  }
  return 'Groups';
};

const getCompletionStatus = (gameData) => {
  const groupsCompleted = normalizeGroups(gameData?.groups || []).filter((group) => (group.officialOrder || []).every(Boolean)).length;
  return {
    completed: groupsCompleted,
    total: 12,
    text: `${groupsCompleted}/12`
  };
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('success');
  const [isCapturingStats, setIsCapturingStats] = useState(false);

  const handleCaptureStats = useCallback(async (leagueId, gameData, leagueData) => {
    if (!leagueId || !gameData || leagueData?.status !== 'archived') {
      return;
    }

    try {
      setIsCapturingStats(true);
      setFeedbackType('info');
      setFeedback('Creating World Cup statistics...');

      const stats = new WorldCupEndLeagueStats(leagueId);
      const result = await stats.captureStats(gameData, leagueData.winners || null);

      if (!result?.success) {
        throw new Error(result?.error || 'Could not create statistics');
      }

      setFeedbackType('success');
      setFeedback('World Cup statistics created. They are now available on the Stats page.');
    } catch (error) {
      console.error('Error creating World Cup statistics:', error);
      setFeedbackType('error');
      setFeedback(`Could not create statistics: ${error.message}`);
    } finally {
      setIsCapturingStats(false);
    }
  }, []);

  const navigateToAdminSubview = useCallback((subview) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', subview);
    searchParams.delete('settingsTab');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const navigateToSettingsTab = useCallback((settingsTab = null) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'settings');
    if (settingsTab) {
      searchParams.set('settingsTab', settingsTab);
    } else {
      searchParams.delete('settingsTab');
    }
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const navigateToSettings = useCallback(() => {
    navigateToSettingsTab('teamSetup');
  }, [navigateToSettingsTab]);

  const WorldCupStatCards = ({ gameData, userCount, lockStatus }) => {
    const previewData = buildPreviewGameData(gameData);
    const qualifiedTeams = getQualifiedTeams(previewData);
    const groupsCompleted = previewData.groups.filter((group) => (group.officialOrder || []).every(Boolean)).length;

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        <StatCard label="Players" value={userCount} tone="slate" />
        <StatCard label="Groups Finalized" value={`${groupsCompleted} / 12`} tone="emerald" />
        <StatCard label="Qualified Teams" value={qualifiedTeams.length} tone="blue" />
        <StatCard label="Knockout Picks" value={previewData.knockoutEnabled ? 'Enabled' : 'Locked'} tone="amber" />
        <StatCard
          label="Phase Locks"
          value={`${lockStatus?.[GROUP_STAGE_LOCK_KEY]?.locked ? 'G' : '-'} / ${lockStatus?.[KNOCKOUT_STAGE_LOCK_KEY]?.locked ? 'K' : '-'}`}
          tone="slate"
        />
      </div>
    );
  };

  const WorldCupActions = ({
    leagueId,
    leagueData,
    gameData,
    onExportData,
    onEndLeague,
    isEndingLeague,
    isArchived
  }) => (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-4">Admin Actions</h2>
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminActionCard
            title="Team Setup"
            description="Set who is in each group, then build the Round of 32 bracket from the qualified field."
            icon={FaCog}
            buttonLabel="Open Setup"
            onClick={() => navigateToSettingsTab('teamSetup')}
            disabled={isArchived}
            buttonClassName="bg-orange-600 hover:bg-orange-700"
            buttonStyle={{ backgroundColor: '#ea580c' }}
          />
          <AdminActionCard
            title="Team Results"
            description="Enter official group results, then record official knockout winners and scores."
            icon={FaTrophy}
            buttonLabel="Open Results"
            onClick={() => navigateToSettingsTab('teamResults')}
            disabled={isArchived}
            buttonClassName="bg-blue-600 hover:bg-blue-700"
          />
          <AdminActionCard
            title="Scoring Settings"
            description="Adjust group points, knockout round values, and score-bonus rules."
            icon={FaCalculator}
            buttonLabel="Open Scoring"
            onClick={() => navigateToSettingsTab('scoring')}
            disabled={isArchived}
            buttonClassName="bg-purple-600 hover:bg-purple-700"
          />
          <AdminActionCard
            title="Manage Participants"
            description="View league participants and remove entries when needed."
            icon={FaUsers}
            buttonLabel="Participants"
            onClick={() => navigateToAdminSubview('teams')}
            disabled={false}
            buttonClassName="bg-emerald-600 hover:bg-emerald-700"
            buttonStyle={{ backgroundColor: '#059669' }}
          />
          <AdminActionCard
            title="Export Data"
            description="Download the current game data as a JSON backup."
            icon={FaDownload}
            buttonLabel="Export Data"
            onClick={onExportData}
            disabled={isArchived}
            buttonClassName="bg-gray-700 hover:bg-gray-800"
          />
          <AdminActionCard
            title="League Stats"
            description={isArchived
              ? 'Create or rebuild the statistics shown on the Stats page.'
              : 'Statistics are automatically created when the league is ended.'}
            icon={FaCalculator}
            buttonLabel={isCapturingStats ? 'Creating Stats...' : 'Create Stats'}
            onClick={() => handleCaptureStats(leagueId, gameData, leagueData)}
            disabled={!isArchived || isCapturingStats}
            buttonClassName={isArchived && !isCapturingStats ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400'}
          />
          <AdminActionCard
            title="End League"
            description="Determine winners, record results, and archive the league."
            icon={FaTrophy}
            buttonLabel={isArchived ? 'Archived' : isEndingLeague ? 'Processing...' : 'End League'}
            onClick={onEndLeague}
            disabled={isArchived || isEndingLeague}
            buttonClassName={isArchived || isEndingLeague ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}
          />
        </div>
      </div>
    </div>
  );

  return (
    <BaseAdminDashboard
      gameType="worldCup"
      rounds={[GROUP_STAGE_LOCK_KEY, KNOCKOUT_STAGE_LOCK_KEY]}
      getGameStatus={getWorldCupStatus}
      getCompletionStatus={getCompletionStatus}
      CustomStatCards={WorldCupStatCards}
      CustomActions={WorldCupActions}
      onGoToSettings={navigateToSettings}
      onGoToTeams={() => navigateToAdminSubview('teams')}
      onGoToScoringSettings={() => navigateToSettingsTab('scoring')}
      useParameterNavigation={true}
      externalFeedback={feedback}
      externalFeedbackType={feedbackType}
    />
  );
};

export default AdminDashboard;
