import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import BaseAdminSettings from '../../common/components/BaseAdminSettings';
import WorldCupKnockoutBracket from './WorldCupKnockoutBracket';
import {
  FIFA_TEAM_GROUPS,
  FIFA_TEAM_LOOKUP,
  getFifaTeamIcon,
  getFifaTeamLabel
} from '../constants/fifaTeams';
import {
  autoFillFinalGroupSlot,
  createEmptyKnockoutRounds,
  createDefaultScoringSettings,
  deriveKnockoutBracket,
  getOfficialGroupOrder,
  normalizeGroups,
  normalizeOrderForGroup,
  sanitizeBracketForStorage
} from '../services/worldCupService';

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

const clearDependentMatches = (rounds, roundKey, index) => {
  let next = clone(rounds);

  getDependentMatches(roundKey, index).forEach((target) => {
    next[target.roundKey] = next[target.roundKey] || [];
    next[target.roundKey][target.index] = resetMatch(next[target.roundKey][target.index] || {});
    next = clearDependentMatches(next, target.roundKey, target.index);
  });

  return next;
};

const updateOrderValue = (order = [], index, teamId, group) => {
  const next = [...order];
  next[index] = teamId;

  next.forEach((value, currentIndex) => {
    if (currentIndex !== index && value === teamId) {
      next[currentIndex] = '';
    }
  });

  return autoFillFinalGroupSlot(next, group);
};

const getKnockoutSetupTeams = (groups = []) => {
  const normalizedGroups = normalizeGroups(groups);

  return normalizedGroups.flatMap((group) => {
    const officialOrder = getOfficialGroupOrder(group);
    return officialOrder
      .slice(0, 3)
      .map((teamId) => group.teams.find((team) => team.id === teamId))
      .filter(Boolean)
      .map((team) => ({ ...team, groupId: group.id }));
  });
};

const persistWorldCupGameData = async (leagueId, currentData, patch = {}) => {
  const nextGroups = patch.groups ?? currentData.groups ?? [];
  const nextQualifiedThirdPlaceTeamIds =
    patch.qualifiedThirdPlaceTeamIds ?? currentData.qualifiedThirdPlaceTeamIds ?? [];
  const nextKnockoutEnabled = patch.knockoutEnabled ?? currentData.knockoutEnabled ?? false;
  const nextKnockoutRounds = patch.knockoutRounds ?? currentData.knockoutRounds ?? {};
  const finalWinner = nextKnockoutRounds?.final?.[0]?.winnerTeamId;

  await updateDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), {
    groups: nextGroups,
    qualifiedThirdPlaceTeamIds: nextQualifiedThirdPlaceTeamIds,
    knockoutEnabled: nextKnockoutEnabled,
    knockoutRounds: sanitizeBracketForStorage(nextKnockoutRounds),
    status: finalWinner ? 'completed' : nextKnockoutEnabled ? 'knockout' : 'groups',
    updatedAt: new Date().toISOString()
  });

  return {
    ...currentData,
    groups: nextGroups,
    qualifiedThirdPlaceTeamIds: nextQualifiedThirdPlaceTeamIds,
    knockoutEnabled: nextKnockoutEnabled,
    knockoutRounds: nextKnockoutRounds
  };
};

const SettingsShell = ({ title, description, actions = null, children }) => (
  <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const NestedTabSwitcher = ({ tabs, defaultTabId, panelProps }) => {
  const [activeTab, setActiveTab] = useState(defaultTabId || tabs[0]?.id || '');
  const activeConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  if (!activeConfig) {
    return null;
  }

  const ActivePanel = activeConfig.panel;

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>
      <ActivePanel {...panelProps} />
    </div>
  );
};

const TeamsPanel = ({ data, setData, isArchived, setFeedback, leagueId }) => {
  const groups = data?.groups || [];
  const selectedTeamIds = new Set(
    groups.flatMap((group) => (group.teams || []).map((team) => team.id)).filter(Boolean)
  );

  const updateTeamAtIndex = (groupId, teamIndex, updater) => {
    setData((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              teams: (group.teams || []).map((team, index) =>
                index !== teamIndex ? team : updater(team)
              )
            }
      )
    }));
  };

  const applyCatalogTeam = (groupId, teamIndex, teamId) => {
    if (!teamId) {
      updateTeamAtIndex(groupId, teamIndex, (team) => ({
        ...team,
        id: '',
        name: '',
        shortName: '',
        iconCode: ''
      }));
      return;
    }

    const selectedTeam = FIFA_TEAM_LOOKUP[teamId];
    if (!selectedTeam) {
      return;
    }

    updateTeamAtIndex(groupId, teamIndex, (team) => ({
      ...team,
      id: selectedTeam.id,
      name: selectedTeam.name,
      shortName: selectedTeam.shortName,
      iconCode: selectedTeam.iconCode
    }));
  };

  const handleSaveTeams = async () => {
    try {
      const nextData = await persistWorldCupGameData(leagueId, data, { groups: data.groups });
      setData(nextData);
      setFeedback('Tournament teams saved.');
    } catch (error) {
      setFeedback(error.message || 'Failed to save tournament teams.', true);
    }
  };

  return (
    <SettingsShell
      title="Tournament Teams"
      description="Input the teams in each group before you lock in official standings and knockout results."
      actions={(
        <button
          type="button"
          onClick={handleSaveTeams}
          disabled={isArchived}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save Teams
        </button>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id} className="rounded-lg border border-gray-200 p-4">
            <h4 className="text-base font-semibold text-gray-900">{group.name}</h4>

            <div className="mt-4 space-y-3">
              {(group.teams || []).map((team, index) => (
                <div key={`${group.id}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Team {index + 1}
                  </div>
                  {(() => {
                    const availableTeams = FIFA_TEAM_GROUPS.map((catalogGroup) => ({
                      ...catalogGroup,
                      teams: catalogGroup.teams.filter(
                        (catalogTeam) => !selectedTeamIds.has(catalogTeam.id) || catalogTeam.id === team.id
                      )
                    })).filter((catalogGroup) => catalogGroup.teams.length > 0);

                    return (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      FIFA Team Catalog
                    </span>
                    <select
                      value={FIFA_TEAM_LOOKUP[team.id] ? team.id : ''}
                      disabled={isArchived}
                      onChange={(event) => applyCatalogTeam(group.id, index, event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select a FIFA team</option>
                      {availableTeams.map((catalogGroup) => (
                        <optgroup key={catalogGroup.label} label={catalogGroup.label}>
                          {catalogGroup.teams.map((catalogTeam) => (
                            <option key={catalogTeam.id} value={catalogTeam.id}>
                              {getFifaTeamLabel(catalogTeam)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                    );
                  })()}
                  <div className="mt-2 text-xs text-gray-500">
                    {team.iconCode ? `${getFifaTeamIcon(team.iconCode)} ` : ''}
                    {team.name || 'No team selected'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SettingsShell>
  );
};

const GroupsPanel = ({ data, setData, isArchived, setFeedback, leagueId }) => {
  const groups = useMemo(() => data?.groups || [], [data?.groups]);

  useEffect(() => {
    if (!groups.length) {
      return;
    }

    setData((current) => {
      let didChange = false;
      const nextGroups = (current.groups || []).map((group) => {
        const normalizedOrder = normalizeOrderForGroup(group.officialOrder || [], group);
        const autoCompletedOrder = autoFillFinalGroupSlot(normalizedOrder, group);
        if (JSON.stringify(autoCompletedOrder) === JSON.stringify(normalizedOrder)) {
          return group;
        }

        didChange = true;
        return {
          ...group,
          officialOrder: autoCompletedOrder
        };
      });

      return didChange
        ? {
            ...current,
            groups: nextGroups
          }
        : current;
    });
  }, [groups, setData]);

  const updateOfficialOrder = (groupId, index, teamId) => {
    setData((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              officialOrder: updateOrderValue(group.officialOrder || [], index, teamId, group)
            }
      )
    }));
  };

  const handleSaveGroups = async () => {
    try {
      const nextData = await persistWorldCupGameData(leagueId, data, { groups: data.groups });
      setData(nextData);
      setFeedback('Official group standings saved.');
    } catch (error) {
      setFeedback(error.message || 'Failed to save official group standings.', true);
    }
  };

  const handleClearGroups = () => {
    setData((current) => ({
      ...current,
      groups: (current.groups || []).map((group) => ({
        ...group,
        officialOrder: []
      }))
    }));
    setFeedback('Official group standings cleared. Save to persist changes.');
  };

  return (
    <div className="space-y-6">
      <SettingsShell
        title="Official Group Standings"
        description="Set the final order for each group."
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearGroups}
              disabled={isArchived}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSaveGroups}
              disabled={isArchived}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save Groups
            </button>
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => {
            const currentOrder = group.officialOrder || [];
            return (
              <div key={group.id} className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 text-base font-semibold text-gray-900">{group.name}</h4>
                <div className="space-y-3">
                  {group.teams.map((team, index) => {
                    const availableTeams = group.teams.filter(
                      (candidate) => !currentOrder.includes(candidate.id) || currentOrder[index] === candidate.id
                    );

                    return (
                      <label key={`${group.id}-${index}`} className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Position {index + 1}
                        </span>
                        <select
                          value={currentOrder[index] || ''}
                          onChange={(event) => updateOfficialOrder(group.id, index, event.target.value)}
                          disabled={isArchived}
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
      </SettingsShell>
    </div>
  );
};

const KnockoutSetupPanel = ({ data, setData, isArchived, setFeedback, leagueId }) => {
  const [editingSetupMatch, setEditingSetupMatch] = useState(null);
  const [draftHomeTeamId, setDraftHomeTeamId] = useState('');
  const [draftAwayTeamId, setDraftAwayTeamId] = useState('');
  const qualifiedTeams = useMemo(() => getKnockoutSetupTeams(data?.groups || []), [data?.groups]);
  const derivedKnockoutBracket = deriveKnockoutBracket(data?.knockoutRounds || {}, data?.groups || []);
  const roundOf32Matches = data?.knockoutRounds?.roundOf32 || [];
  const usedRoundOf32Teams = new Set(
    roundOf32Matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean)
  );

  const updateRoundOf32Slot = (index, side, teamId) => {
    setData((current) => {
      const nextRounds = clone(current.knockoutRounds || {});
      nextRounds.roundOf32 = nextRounds.roundOf32 || [];
      nextRounds.roundOf32[index] = {
        ...(nextRounds.roundOf32[index] || {}),
        [side]: teamId || null
      };

      return {
        ...current,
        knockoutRounds: clearDependentMatches(nextRounds, 'roundOf32', index)
      };
    });
  };

  const handleSaveRoundOf32 = async () => {
    try {
      const roundOf32 = data?.knockoutRounds?.roundOf32 || [];
      const uniqueTeams = new Set();
      const complete = roundOf32.every((match) => {
        if (!match.homeTeamId || !match.awayTeamId || match.homeTeamId === match.awayTeamId) {
          return false;
        }
        uniqueTeams.add(match.homeTeamId);
        uniqueTeams.add(match.awayTeamId);
        return true;
      });

      if (!complete || uniqueTeams.size !== 32) {
        throw new Error('Round of 32 must contain 16 complete matches with 32 unique teams.');
      }

      const nextData = await persistWorldCupGameData(leagueId, data, {
        knockoutRounds: data.knockoutRounds
      });
      setData(nextData);
      setFeedback('Round of 32 saved.');
    } catch (error) {
      setFeedback(error.message || 'Failed to save the Round of 32.', true);
    }
  };

  const handleClearRoundOf32 = () => {
    setData((current) => ({
      ...current,
      knockoutRounds: createEmptyKnockoutRounds()
    }));
    closeSetupMatchEditor();
    setFeedback('Knockout setup cleared. Save to persist changes.');
  };

  const openSetupMatchEditor = (index, matchup, availableTeams) => {
    setEditingSetupMatch({
      index,
      matchup,
      availableTeams
    });
    setDraftHomeTeamId(matchup.homeTeamId || '');
    setDraftAwayTeamId(matchup.awayTeamId || '');
  };

  const closeSetupMatchEditor = () => {
    setEditingSetupMatch(null);
    setDraftHomeTeamId('');
    setDraftAwayTeamId('');
  };

  const saveSetupMatchEditor = () => {
    if (!editingSetupMatch) {
      return;
    }

    updateRoundOf32Slot(editingSetupMatch.index, 'homeTeamId', draftHomeTeamId || null);
    updateRoundOf32Slot(editingSetupMatch.index, 'awayTeamId', draftAwayTeamId || null);
    closeSetupMatchEditor();
  };

  const renderSetupMatchup = ({ roundKey, index, matchup, title, defaultMatchup }) => {
    if (roundKey !== 'roundOf32') {
      return defaultMatchup;
    }

    const homeTeam = qualifiedTeams.find((team) => team.id === matchup.homeTeamId) || null;
    const awayTeam = qualifiedTeams.find((team) => team.id === matchup.awayTeamId) || null;
    const availableTeams = qualifiedTeams.filter(
      (team) =>
        !usedRoundOf32Teams.has(team.id) ||
        team.id === matchup.homeTeamId ||
        team.id === matchup.awayTeamId
    );
    const displayTitle = (() => {
      const matchNumber = String(title || matchup.label || '').match(/^M(\d+)$/i);
      return matchNumber ? `Match ${matchNumber[1]}` : title;
    })();
    return (
      <div className="flex h-full w-full min-h-0 flex-col">
        <div className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {displayTitle}
        </div>
        <button
          type="button"
          onClick={() => openSetupMatchEditor(index, matchup, availableTeams)}
          disabled={isArchived}
          className="min-h-0 flex-1 overflow-hidden rounded-[22px] bg-white/94 p-2 text-left shadow-[0_14px_34px_-28px_rgba(15,23,42,0.65)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default"
        >
          <div className="flex h-full flex-col justify-center space-y-1.5">
            {[
              { team: homeTeam },
              { team: awayTeam }
            ].map((entry, rowIndex) => (
              <div
                key={`${matchup.id || `r32-${index}`}-row-${rowIndex}`}
                className="flex items-center gap-1.5 rounded-xl bg-white/78 px-2 py-1"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-slate-200/80 shadow-sm">
                  {entry.team?.iconCode ? (
                    <span className="text-base" aria-hidden="true">
                      {getFifaTeamIcon(entry.team.iconCode)}
                    </span>
                  ) : (
                    <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-500">TBD</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold text-slate-700">
                    {entry.team?.name || 'TBD'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </button>
      </div>
    );
  };

  return (
    <SettingsShell
        title="Knockout Setup"
        description={`Set the knockout seeding once the field is confirmed. Qualified teams loaded: ${qualifiedTeams.length}.`}
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearRoundOf32}
              disabled={isArchived}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSaveRoundOf32}
              disabled={isArchived}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save Knockout Setup
            </button>
          </div>
      )}
    >
      <WorldCupKnockoutBracket
        groups={data?.groups || []}
        rounds={derivedKnockoutBracket}
        showThirdPlace={false}
        readOnly={true}
        isLocked={isArchived}
        forcedLayoutMode="bracket"
        showLayoutToggle={false}
        showLockedMessage={true}
        renderMatchupOverride={renderSetupMatchup}
      />
      {editingSetupMatch ? (
        <div className="fixed inset-0 z-[220] isolate flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="relative z-[221] w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Set Teams
              </div>
              <h3 className="mt-1 text-xl font-bold text-slate-950">
                {editingSetupMatch.matchup.label || `Match ${editingSetupMatch.index + 1}`}
              </h3>
            </div>

            <div className="space-y-5 px-5 py-5">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Home Team
                </span>
                <select
                  value={draftHomeTeamId}
                  onChange={(event) => setDraftHomeTeamId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                >
                  <option value="">Select team</option>
                  {editingSetupMatch.availableTeams.map((team) => (
                    <option key={`${editingSetupMatch.matchup.id}-home-${team.id}`} value={team.id}>
                      {team.iconCode ? `${getFifaTeamIcon(team.iconCode)} ${team.name}` : team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Away Team
                </span>
                <select
                  value={draftAwayTeamId}
                  onChange={(event) => setDraftAwayTeamId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                >
                  <option value="">Select team</option>
                  {editingSetupMatch.availableTeams.map((team) => (
                    <option key={`${editingSetupMatch.matchup.id}-away-${team.id}`} value={team.id}>
                      {team.iconCode ? `${getFifaTeamIcon(team.iconCode)} ${team.name}` : team.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeSetupMatchEditor}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSetupMatchEditor}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                Save Match
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsShell>
  );
};

const KnockoutResultsPanel = ({ data, setData, isArchived, setFeedback, leagueId }) => {
  const derivedOfficialBracket = deriveKnockoutBracket(data?.knockoutRounds || {}, data?.groups || []);
  const showThirdPlace = Boolean(data?.settings?.scoreThirdPlaceMatch);

  const applyOfficialResult = (roundKey, index, values) => {
    setData((current) => {
      const nextRounds = clone(current.knockoutRounds || {});
      nextRounds[roundKey] = nextRounds[roundKey] || [];
      const previousMatch = nextRounds[roundKey][index] || {};
      nextRounds[roundKey][index] = {
        ...previousMatch,
        ...values
      };

      const winnerChanged =
        Object.prototype.hasOwnProperty.call(values, 'winnerTeamId') &&
        previousMatch.winnerTeamId !== values.winnerTeamId;

      return {
        ...current,
        knockoutRounds: winnerChanged ? clearDependentMatches(nextRounds, roundKey, index) : nextRounds
      };
    });
  };

  const handleSaveKnockoutResults = async () => {
    try {
      const nextData = await persistWorldCupGameData(leagueId, data, {
        knockoutRounds: data.knockoutRounds
      });
      setData(nextData);
      setFeedback('Official knockout results saved.');
    } catch (error) {
      setFeedback(error.message || 'Failed to save knockout results.', true);
    }
  };

  const handleClearKnockoutResults = () => {
    setData((current) => ({
      ...current,
      knockoutRounds: Object.fromEntries(
        Object.entries(current.knockoutRounds || {}).map(([roundKey, matches]) => [
          roundKey,
          (matches || []).map((match) => resetMatch(match))
        ])
      )
    }));
    setFeedback('Official knockout results cleared. Save to persist changes.');
  };

  return (
    <SettingsShell
      title="Knockout Results"
        description="Choose official winners and scores. Switch between round view and bracket view while editing."
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearKnockoutResults}
              disabled={isArchived}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSaveKnockoutResults}
            disabled={isArchived}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save Results
          </button>
        </div>
      )}
    >
      <WorldCupKnockoutBracket
        groups={data?.groups || []}
        rounds={derivedOfficialBracket}
        showThirdPlace={showThirdPlace}
        readOnly={false}
        isLocked={isArchived}
        onMatchChange={applyOfficialResult}
        isOfficialBracket={true}
        showLockedMessage={true}
      />
    </SettingsShell>
  );
};

const TeamSetupPanel = (panelProps) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-gray-900">Team Setup</h2>
      <p className="text-sm text-gray-500">
        First place teams into their groups, then build the Round of 32 from the qualified field.
      </p>
    </div>
    <NestedTabSwitcher
      defaultTabId="groups"
      tabs={[
        { id: 'groups', title: 'Groups', panel: TeamsPanel },
        { id: 'knockout', title: 'Knockout', panel: KnockoutSetupPanel }
      ]}
      panelProps={panelProps}
    />
  </div>
);

const TeamResultsPanel = (panelProps) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-gray-900">Team Results</h2>
      <p className="text-sm text-gray-500">
        Enter official group results first, then record official knockout winners and scores.
      </p>
    </div>
    <NestedTabSwitcher
      defaultTabId="groups"
      tabs={[
        { id: 'groups', title: 'Groups', panel: GroupsPanel },
        { id: 'knockout', title: 'Knockout', panel: KnockoutResultsPanel }
      ]}
      panelProps={panelProps}
    />
  </div>
);

const ScoringPanel = ({ data, setData, isArchived, setFeedback, leagueId }) => {
  const handleSaveScoring = async () => {
    try {
      await setDoc(
        doc(db, 'leagues', leagueId, 'settings', 'scoring'),
        {
          ...data.settings,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      setFeedback('Scoring settings saved.');
    } catch (error) {
      setFeedback(error.message || 'Failed to save scoring settings.', true);
    }
  };

  return (
    <SettingsShell
      title="Scoring Settings"
      description="Adjust point values and scoring toggles for the World Cup format."
      actions={(
        <button
          type="button"
          onClick={handleSaveScoring}
          disabled={isArchived}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save Scoring
        </button>
      )}
    >
      <div className="mb-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['groupFirstPlacePoints', 'Group 1st Place'],
          ['groupSecondPlacePoints', 'Group 2nd Place'],
          ['groupPerfectOrderBonus', 'Perfect Group Bonus'],
          ['roundOf32Points', 'Round of 32'],
          ['roundOf16Points', 'Round of 16'],
          ['quarterfinalPoints', 'Quarterfinals'],
          ['semifinalPoints', 'Semifinals'],
          ['finalPoints', 'Final'],
          ['thirdPlacePoints', 'Third Place'],
          ['exactScoreBonus', 'Exact Score Bonus']
        ].map(([key, label]) => (
          <label key={key} className="block rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
            <input
              type="number"
              min="0"
              value={data.settings?.[key]}
              disabled={isArchived}
              onChange={(event) =>
                setData((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    [key]: Number(event.target.value)
                  }
                }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </label>
        ))}
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <input
            type="checkbox"
            checked={Boolean(data.settings?.enableExactScoreBonus)}
            disabled={isArchived}
            onChange={(event) =>
              setData((current) => ({
                ...current,
                settings: {
                  ...current.settings,
                  enableExactScoreBonus: event.target.checked
                }
              }))
            }
          />
          <span className="text-sm text-gray-800">Enable exact score bonus</span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <input
            type="checkbox"
            checked={Boolean(data.settings?.scoreThirdPlaceMatch)}
            disabled={isArchived}
            onChange={(event) =>
              setData((current) => ({
                ...current,
                settings: {
                  ...current.settings,
                  scoreThirdPlaceMatch: event.target.checked
                }
              }))
            }
          />
          <span className="text-sm text-gray-800">Score the third-place match</span>
        </label>
      </div>
    </SettingsShell>
  );
};

const AdminSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const defaultTab = searchParams.get('settingsTab') || 'teamSetup';

  const handleBack = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('view', 'admin');
    nextParams.delete('subview');
    nextParams.delete('settingsTab');
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
  };

  const fetchSettingsData = async (leagueId, userId, leagueData) => {
    const [gameDataSnap, scoringSnap, lockSnap] = await Promise.all([
      getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current')),
      getDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring')),
      getDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus'))
    ]);

    const gameData = gameDataSnap.exists() ? gameDataSnap.data() : {};

    return {
      groups: normalizeGroups(gameData.groups || []),
      qualifiedThirdPlaceTeamIds: gameData.qualifiedThirdPlaceTeamIds || [],
      knockoutEnabled: Boolean(gameData.knockoutEnabled),
      knockoutRounds: gameData.knockoutRounds || {},
      settings: scoringSnap.exists() ? scoringSnap.data() : createDefaultScoringSettings(),
      locks: lockSnap.exists() ? lockSnap.data() : {},
      isLeagueArchived: leagueData.status === 'archived'
    };
  };

  const tabs = [
    { id: 'teamSetup', title: 'Team Setup', panel: TeamSetupPanel },
    { id: 'teamResults', title: 'Team Results', panel: TeamResultsPanel },
    { id: 'scoring', title: 'Scoring', panel: ScoringPanel }
  ];

  return (
    <BaseAdminSettings
      gameType="worldCup"
      tabs={tabs}
      defaultTab={defaultTab}
      fetchData={fetchSettingsData}
      saveChanges={async () => {}}
      pageTitle="World Cup Settings"
      HeaderActions={() => null}
      onBack={handleBack}
    />
  );
};

export default AdminSettings;
