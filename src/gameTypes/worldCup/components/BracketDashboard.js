import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { FaChartLine, FaCog, FaEdit, FaEye, FaGlobeAmericas, FaLock, FaLockOpen, FaTrophy } from 'react-icons/fa';
import { auth, db } from '../../../firebase';
import BaseDashboard from '../../common/components/BaseDashboard';
import {
  autoFillFinalGroupSlot,
  getPreferredStageTab,
  GROUP_STAGE_LOCK_KEY,
  KNOCKOUT_STAGE_LOCK_KEY,
  buildUserKnockoutBracket,
  createDefaultScoringSettings,
  createEmptyKnockoutRounds,
  createEmptyUserEntry,
  deriveKnockoutBracket,
  normalizeGroups,
  normalizeOrderForGroup,
  sanitizeBracketForStorage,
  upsertUserEntry
} from '../services/worldCupService';
import Leaderboard from './Leaderboard';
import BracketView from './BracketView';
import WorldCupKnockoutBracket from './WorldCupKnockoutBracket';

const clone = (value) => JSON.parse(JSON.stringify(value));

const resetMatch = (match = {}) => ({
  ...match,
  winnerTeamId: null,
  homeScore: '',
  awayScore: ''
});

const getDependentMatches = (roundKey, index) => {
  switch (roundKey) {
    case 'roundOf32':
      return [{ roundKey: 'roundOf16', index: Math.floor(index / 2) }];
    case 'roundOf16':
      return [{ roundKey: 'quarterfinals', index: Math.floor(index / 2) }];
    case 'quarterfinals':
      return [{ roundKey: 'semifinals', index: Math.floor(index / 2) }];
    case 'semifinals':
      return [
        { roundKey: 'thirdPlace', index: 0 },
        { roundKey: 'final', index: 0 }
      ];
    default:
      return [];
  }
};

const clearDependentMatches = (picks = {}, roundKey, index) => {
  let next = clone(picks);

  getDependentMatches(roundKey, index).forEach((target) => {
    next[target.roundKey] = next[target.roundKey] || [];
    next[target.roundKey][target.index] = resetMatch(next[target.roundKey][target.index] || {});
    next = clearDependentMatches(next, target.roundKey, target.index);
  });

  return next;
};

const StageSwitch = ({ current, onChange }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {[
      {
        key: 'groups',
        title: 'Group Stage Picks',
        description: 'Predict final order in all 12 groups',
        icon: FaGlobeAmericas,
        color: 'emerald'
      },
      {
        key: 'knockout',
        title: 'Knockout Bracket',
        description: 'Fresh entry once the official bracket is released',
        icon: FaTrophy,
        color: 'blue'
      }
    ].map((item) => {
      const Icon = item.icon;
      const active = current === item.key;
      const colors = item.color === 'emerald'
        ? { active: 'border-emerald-500 bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600' }
        : { active: 'border-blue-500 bg-blue-50', icon: 'bg-blue-100 text-blue-600' };

      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded-xl border p-4 text-left transition hover:border-gray-300 hover:bg-gray-50 ${
            active ? colors.active : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-3 ${colors.icon}`}>
              <Icon />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{item.title}</div>
              <div className="mt-1 text-sm text-gray-500">{item.description}</div>
            </div>
          </div>
        </button>
      );
    })}
  </div>
);

const GroupOrderEditor = ({ groups, values, onChange, disabled = false }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    {groups.map((group) => {
      const currentOrder = values[group.id] || [];

      return (
        <div key={group.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
              <p className="text-xs text-gray-500">
                Teams: {group.teams.map((team) => team.shortName || team.name).join(', ')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {group.teams.map((team, index) => {
              const availableTeams = group.teams.filter(
                (candidate) => !currentOrder.includes(candidate.id) || currentOrder[index] === candidate.id
              );

              return (
                <label key={`${group.id}-slot-${index}`} className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Position {index + 1}
                  </span>
                  <select
                    value={currentOrder[index] || ''}
                    onChange={(event) => onChange(group.id, index, event.target.value)}
                    disabled={disabled}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  >
                    <option value="">Select team</option>
                    {availableTeams.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

const EditPanel = ({ leagueId }) => {
  const currentUser = auth.currentUser;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [gameData, setGameData] = useState(null);
  const [locks, setLocks] = useState({});
  const [settings, setSettings] = useState(createDefaultScoringSettings());
  const [groupPicks, setGroupPicks] = useState({});
  const [knockoutPicks, setKnockoutPicks] = useState(createEmptyKnockoutRounds());
  const [stageTab, setStageTab] = useState('groups');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const [gameDataSnap, userSnap, lockSnap, scoringSnap] = await Promise.all([
          getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current')),
          getDoc(doc(db, 'leagues', leagueId, 'userData', currentUser.uid)),
          getDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus')),
          getDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring'))
        ]);

        if (!mounted) {
          return;
        }

        const nextGameData = gameDataSnap.exists() ? gameDataSnap.data() : null;
        const nextLocks = lockSnap.exists() ? lockSnap.data() : {};
        const userData = userSnap.exists() ? userSnap.data() : createEmptyUserEntry(nextGameData || {}, currentUser);

        setGameData(nextGameData);
        setGroupPicks(userData.groupPicks || {});
        setKnockoutPicks(userData.knockoutPicks || createEmptyKnockoutRounds());
        setLocks(nextLocks);
        setSettings(scoringSnap.exists() ? scoringSnap.data() : createDefaultScoringSettings());
        setStageTab(getPreferredStageTab(nextGameData, nextLocks));
        setError(null);
      } catch (err) {
        console.error('[WorldCup][Edit] Failed to load data:', err);
        if (mounted) {
          setError(err.message || 'Failed to load your picks');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (leagueId && currentUser?.uid) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [leagueId, currentUser]);

  useEffect(() => {
    setStageTab(getPreferredStageTab(gameData, locks));
  }, [gameData, locks]);

  const groups = useMemo(() => normalizeGroups(gameData?.groups || []), [gameData]);
  const derivedUserBracket = useMemo(
    () => (gameData ? buildUserKnockoutBracket(gameData, knockoutPicks) : createEmptyKnockoutRounds()),
    [gameData, knockoutPicks]
  );
  const officialKnockoutBracket = useMemo(
    () => (gameData ? deriveKnockoutBracket(gameData.knockoutRounds || {}, gameData.groups || []) : createEmptyKnockoutRounds()),
    [gameData]
  );

  useEffect(() => {
    if (!groups.length) {
      return;
    }

    setGroupPicks((current) => {
      let didChange = false;
      const nextPicks = { ...current };

      groups.forEach((group) => {
        const normalizedOrder = normalizeOrderForGroup(current[group.id] || [], group);
        const autoCompletedOrder = autoFillFinalGroupSlot(normalizedOrder, group);
        if (JSON.stringify(autoCompletedOrder) !== JSON.stringify(normalizedOrder)) {
          nextPicks[group.id] = autoCompletedOrder;
          didChange = true;
        }
      });

      return didChange ? nextPicks : current;
    });
  }, [groupPicks, groups]);

  const updateGroupPick = (groupId, index, teamId) => {
    const group = groups.find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }

    setGroupPicks((current) => {
      const nextOrder = [...(current[groupId] || [])];
      nextOrder[index] = teamId;

      nextOrder.forEach((value, orderIndex) => {
        if (orderIndex !== index && value === teamId) {
          nextOrder[orderIndex] = '';
        }
      });

      return {
        ...current,
        [groupId]: autoFillFinalGroupSlot(nextOrder, group)
      };
    });
  };

  const handleKnockoutMatchChange = (roundKey, index, updates) => {
    setKnockoutPicks((current) => {
      const next = clone(current);
      next[roundKey] = next[roundKey] || [];
      const previousWinner = next[roundKey][index]?.winnerTeamId ?? null;
      next[roundKey][index] = {
        ...(next[roundKey][index] || {}),
        ...updates
      };

      if (
        Object.prototype.hasOwnProperty.call(updates, 'winnerTeamId') &&
        updates.winnerTeamId !== previousWinner
      ) {
        return clearDependentMatches(next, roundKey, index);
      }

      return next;
    });
  };

  const handleSaveGroups = async () => {
    try {
      setSaving(true);
      await upsertUserEntry(
        leagueId,
        currentUser.uid,
        gameData,
        {
          displayName: currentUser.displayName,
          email: currentUser.email
        },
        { groupPicks }
      );
      setFeedback('Group picks saved.');
    } catch (err) {
      console.error('[WorldCup][Edit] Failed to save group picks:', err);
      setError(err.message || 'Failed to save group picks');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKnockout = async () => {
    try {
      setSaving(true);
      await upsertUserEntry(
        leagueId,
        currentUser.uid,
        gameData,
        {
          displayName: currentUser.displayName,
          email: currentUser.email
        },
        { knockoutPicks: sanitizeBracketForStorage(derivedUserBracket) }
      );
      setFeedback('Knockout picks saved.');
    } catch (err) {
      console.error('[WorldCup][Edit] Failed to save knockout picks:', err);
      setError(err.message || 'Failed to save knockout picks');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading your World Cup entry...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-600">{error}</div>;
  }

  const groupsLocked = Boolean(locks?.[GROUP_STAGE_LOCK_KEY]?.locked);
  const knockoutLocked = Boolean(locks?.[KNOCKOUT_STAGE_LOCK_KEY]?.locked);
  const showThirdPlace = Boolean(settings.scoreThirdPlaceMatch);
  const saveButtonLabel = stageTab === 'groups' ? 'Save Group Picks' : 'Save Knockout Picks';
  const handleTopSave = stageTab === 'groups' ? handleSaveGroups : handleSaveKnockout;
  const saveDisabled = stageTab === 'groups'
    ? saving || groupsLocked
    : saving || knockoutLocked;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {feedback ? (
          <div className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700">{feedback}</div>
        ) : <div />}
        <button
          type="button"
          onClick={handleTopSave}
          disabled={saveDisabled}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saveButtonLabel}
        </button>
      </div>

      <StageSwitch current={stageTab} onChange={setStageTab} />

      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            groupsLocked ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {groupsLocked ? <FaLock className="mr-2" /> : <FaLockOpen className="mr-2" />}
          Group phase {groupsLocked ? 'locked' : 'open'}
        </div>
        <div
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            knockoutLocked ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {knockoutLocked ? <FaLock className="mr-2" /> : <FaLockOpen className="mr-2" />}
          Knockout phase {knockoutLocked ? 'locked' : 'open'}
        </div>
      </div>

      {stageTab === 'groups' ? (
        <div className="space-y-4">
          {groupsLocked ? (
            <div className="rounded-md bg-amber-100 px-4 py-3 text-sm text-amber-800">
              Group picks are locked.
            </div>
          ) : null}
          <GroupOrderEditor groups={groups} values={groupPicks} onChange={updateGroupPick} disabled={groupsLocked} />
        </div>
      ) : (
        <div className="space-y-4">
          {knockoutLocked ? (
            <div className="rounded-md bg-amber-100 px-4 py-3 text-sm text-amber-800">
              Knockout picks are locked.
            </div>
          ) : null}
          <WorldCupKnockoutBracket
            groups={gameData?.groups || []}
            rounds={derivedUserBracket}
            officialRounds={officialKnockoutBracket}
            showThirdPlace={showThirdPlace}
            readOnly={false}
            isLocked={knockoutLocked}
            onMatchChange={handleKnockoutMatchChange}
            showLockedMessage={true}
            scoringSettings={settings}
          />
        </div>
      )}
    </div>
  );
};

const BracketDashboard = ({
  leagueId,
  league,
  isEmbedded = false,
  onViewBracket = null,
  urlParams = {},
  activeTab: externalActiveTab = null,
  dashboardKey = 0,
  forceTabReset = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultTab = 'edit';

  const [activeParams, setActiveParams] = useState(() => {
    if (forceTabReset) return {};
    const userId = urlParams.userId;
    const bracketId = urlParams.bracketId;
    return userId || bracketId ? { bracketId: bracketId || userId } : {};
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (forceTabReset) return defaultTab;
    return externalActiveTab || urlParams.view || defaultTab;
  });

  useEffect(() => {
    if (leagueId) {
      sessionStorage.removeItem(`bracket-dashboard-${leagueId}-return`);
    }
  }, [leagueId]);

  useEffect(() => {
    if (forceTabReset) {
      setActiveParams({});
      setActiveTab(defaultTab);
      return;
    }

    const userId = urlParams.userId;
    const bracketId = urlParams.bracketId;
    setActiveParams((current) => {
      const next = userId || bracketId ? { bracketId: bracketId || userId } : {};
      const currentBracketId = current.bracketId || null;
      const nextBracketId = next.bracketId || null;
      return currentBracketId === nextBracketId ? current : next;
    });
    setActiveTab(externalActiveTab || urlParams.view || defaultTab);
  }, [defaultTab, externalActiveTab, forceTabReset, urlParams.bracketId, urlParams.userId, urlParams.view]);

  const loadWorldCupData = useCallback(async () => {
    if (!leagueId) {
      return null;
    }

    const gameDataSnap = await getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'));
    return gameDataSnap.exists() ? gameDataSnap.data() : null;
  }, [leagueId]);

  const canEditEntry = useCallback(() => true, []);

  const getStatusInfo = useCallback(
    (gameData) => ({
      canEdit: true,
      status: gameData?.status || 'Active',
      defaultTabWhenComplete: null
    }),
    []
  );

  const AdminButton = useCallback(() => {
    const handleAdminClick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const searchParams = new URLSearchParams(location.search);
      searchParams.set('view', 'admin');
      searchParams.set('tab', 'admin');
      window.location.assign(`/league/${leagueId}?${searchParams.toString()}`);
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
            <p className="text-sm text-gray-500">Manage groups, bracket, scoring, and locks</p>
          </div>
        </div>
      </div>
    );
  }, [leagueId, location.search]);

  const handleParamChange = useCallback(
    (params) => {
      const nextParams = { ...activeParams, ...params };
      const nextTab = params.view || params.tab || activeTab;

      setActiveParams(nextParams);
      setActiveTab(nextTab);

      const searchParams = new URLSearchParams();
      if (nextParams.bracketId) {
        searchParams.set('bracketId', nextParams.bracketId);
        searchParams.set('userId', nextParams.bracketId);
      }
      if (nextTab) {
        searchParams.set('view', nextTab);
        searchParams.set('tab', nextTab);
      }

      if (!isEmbedded && location.pathname.startsWith(`/league/${leagueId}`)) {
        navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
      }
    },
    [activeParams, activeTab, isEmbedded, leagueId, location.pathname, navigate]
  );

  const handleViewBracketFromLeaderboard = useCallback(
    (bracketId) => {
      if (isEmbedded && onViewBracket) {
        onViewBracket(bracketId);
        return true;
      }

      handleParamChange({ bracketId, view: 'view' });
      return true;
    },
    [handleParamChange, isEmbedded, onViewBracket]
  );

  const bracketTabs = useMemo(
    () => ({
      view: {
        title: 'View Bracket',
        description: 'World Cup entries and results',
        icon: <FaEye />,
        color: 'blue',
        component: BracketView,
        componentProps: {
          initialBracketId: activeParams.bracketId || 'tournament',
          onBracketSelect: handleViewBracketFromLeaderboard,
          key: `view-${activeParams.bracketId || 'tournament'}-${dashboardKey}`
        }
      },
      edit: {
        title: 'Edit My Bracket',
        description: 'Group standings and knockout picks',
        icon: <FaEdit />,
        color: 'green',
        component: EditPanel,
        componentProps: {
          key: `edit-${dashboardKey}`
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
          key: `leaderboard-${activeTab}-${dashboardKey}`
        }
      }
    }),
    [activeParams.bracketId, activeTab, dashboardKey, handleViewBracketFromLeaderboard]
  );

  return (
    <BaseDashboard
      leagueId={leagueId}
      league={league}
      tabs={bracketTabs}
      activeTab={activeTab}
      params={activeParams}
      onTabChange={setActiveTab}
      onParamChange={handleParamChange}
      getGameData={loadWorldCupData}
      canEditEntry={canEditEntry}
      getStatusInfo={getStatusInfo}
      AdminButton={AdminButton}
      customUrlParams={['bracketId', 'userId']}
      defaultTab={defaultTab}
      key={`world-cup-dashboard-${dashboardKey}`}
    />
  );
};

export default BracketDashboard;
