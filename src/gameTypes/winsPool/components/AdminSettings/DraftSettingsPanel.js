import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { FaArrowLeft, FaArrowDown, FaArrowUp, FaSyncAlt } from 'react-icons/fa';
import { db } from '../../../../firebase';
import { ASSIGNMENT_MODES, DRAFT_STATUS, DOUBLE_SNAKE_POOLS, DEFAULT_ROSTER_SETTINGS, DEFAULT_AUCTION_BUDGET } from '../../constants/winsPoolConstants';
import {
  generateAutoDoubleSnakeConfig,
  normalizeDoubleSnakeConfig,
  updateTeamAssignment,
  renameDoubleSnakeGroup
} from '../../utils/draftConfig';

const DraftSettingsPanel = ({ leagueId, data, onUpdate, onBack }) => {
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [assignmentMode, setAssignmentMode] = useState(data.draft.assignmentMode || ASSIGNMENT_MODES.DRAFT);
  const [useSnakeDraft, setUseSnakeDraft] = useState(
    data.draft.useSnakeDraft !== undefined ? data.draft.useSnakeDraft : true
  );
  const [draftOrder, setDraftOrder] = useState(data.draft.order || []);
  const [doubleSnakeConfig, setDoubleSnakeConfig] = useState(
    normalizeDoubleSnakeConfig(
      data.draft.doubleSnakeConfig,
      data.teamPool?.teams || [],
      data.rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
    )
  );
  const [rosterSize, setRosterSize] = useState(
    data.rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
  );
  const [auctionBudget, setAuctionBudget] = useState(
    data.draft?.auctionBudget ?? DEFAULT_AUCTION_BUDGET
  );

  const draftStatus = data.draft.status || DRAFT_STATUS.NOT_STARTED;
  const draftLocked = draftStatus !== DRAFT_STATUS.NOT_STARTED;

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!leagueId) return;
      try {
        const userDataRef = collection(db, 'leagues', leagueId, 'userData');
        const snapshot = await getDocs(userDataRef);
        const users = snapshot.docs.map(docSnap => {
          const userData = docSnap.data();
          return {
            id: docSnap.id,
            name: userData.displayName || userData.username || userData.ownerName || 'Unknown Manager'
          };
        });
        setParticipants(users);
        if (!(data.draft.order || []).length) {
          const defaultOrder = users.map(user => user.id);
          setDraftOrder(defaultOrder);
          onUpdate({ draft: { order: defaultOrder } });
        }
      } catch (error) {
        console.error('[WinsPool][DraftSettingsPanel] Failed to load participants:', error);
      } finally {
        setLoadingParticipants(false);
      }
    };

    fetchParticipants();
  }, [leagueId, data.draft.order, onUpdate]);

  useEffect(() => {
    setAssignmentMode(data.draft.assignmentMode || ASSIGNMENT_MODES.DRAFT);
    setUseSnakeDraft(data.draft.useSnakeDraft !== undefined ? data.draft.useSnakeDraft : true);
    if ((data.draft.order || []).length) {
      setDraftOrder(data.draft.order);
    }
    setDoubleSnakeConfig(
      normalizeDoubleSnakeConfig(
        data.draft.doubleSnakeConfig,
        data.teamPool?.teams || [],
        data.rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
      )
    );
  }, [data.draft, data.teamPool, data.rosterSettings]);

  useEffect(() => {
    setRosterSize(data.rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize);
  }, [data.rosterSettings?.rosterSize]);

  useEffect(() => {
    setAuctionBudget(data.draft?.auctionBudget ?? DEFAULT_AUCTION_BUDGET);
  }, [data.draft?.auctionBudget]);

  const participantLookup = useMemo(() => {
    return participants.reduce((acc, participant) => {
      acc[participant.id] = participant.name;
      return acc;
    }, {});
  }, [participants]);

  const teamPoolTeams = useMemo(
    () => (Array.isArray(data.teamPool?.teams) ? data.teamPool.teams : []),
    [data.teamPool]
  );

  useEffect(() => {
    if (assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE) {
      setDoubleSnakeConfig((current) =>
        normalizeDoubleSnakeConfig(current, teamPoolTeams, rosterSize)
      );
    }
  }, [assignmentMode, teamPoolTeams, rosterSize]);

  const rebalancePicksForRosterSize = (currentConfig, newRosterSize) => {
    const existingTotal = Object.values(currentConfig.picksPerPool || {}).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );

    if (existingTotal === 0) {
      return generateAutoDoubleSnakeConfig(
        teamPoolTeams,
        currentConfig.groupingMode || 'conference',
        newRosterSize
      );
    }

    if (existingTotal === newRosterSize) {
      return currentConfig;
    }

    const ratioA =
      existingTotal === 0
        ? 0.5
        : (Number(currentConfig.picksPerPool?.[DOUBLE_SNAKE_POOLS.POOL_A]) || 0) / existingTotal;
    let picksA = Math.round(newRosterSize * ratioA);
    let picksB = Math.max(0, newRosterSize - picksA);
    if (picksA === 0 && newRosterSize > 0) {
      picksA = 1;
      picksB = Math.max(0, newRosterSize - picksA);
    }

    return {
      ...currentConfig,
      picksPerPool: {
        [DOUBLE_SNAKE_POOLS.POOL_A]: picksA,
        [DOUBLE_SNAKE_POOLS.POOL_B]: picksB
      }
    };
  };

  const handleAssignmentModeChange = (mode) => {
    if (draftLocked) return;
    setAssignmentMode(mode);
    const draftUpdates = { assignmentMode: mode };
    const rosterUpdates = { assignmentMode: mode };

    if (mode === ASSIGNMENT_MODES.DRAFT) {
      setUseSnakeDraft(true);
      draftUpdates.useSnakeDraft = true;
      rosterUpdates.useSnakeDraft = true;
      draftUpdates.doubleSnakeConfig = doubleSnakeConfig;
    } else if (mode === ASSIGNMENT_MODES.DOUBLE_SNAKE) {
      setUseSnakeDraft(true);
      draftUpdates.useSnakeDraft = true;
      rosterUpdates.useSnakeDraft = true;
      const autoConfig = generateAutoDoubleSnakeConfig(
        teamPoolTeams,
        doubleSnakeConfig.groupingMode || 'conference',
        rosterSize
      );
      setDoubleSnakeConfig(autoConfig);
      draftUpdates.doubleSnakeConfig = autoConfig;
    } else if (mode === ASSIGNMENT_MODES.AUCTION) {
      setUseSnakeDraft(false);
      draftUpdates.useSnakeDraft = false;
      rosterUpdates.useSnakeDraft = false;
      draftUpdates.doubleSnakeConfig = doubleSnakeConfig;
      draftUpdates.auctionBudget = auctionBudget;
    } else {
      draftUpdates.doubleSnakeConfig = doubleSnakeConfig;
    }

    onUpdate({
      draft: draftUpdates,
      rosterSettings: rosterUpdates
    });
  };

  const handleSnakeToggle = (checked) => {
    setUseSnakeDraft(checked);
    onUpdate({
      draft: { useSnakeDraft: checked },
      rosterSettings: { useSnakeDraft: checked }
    });
  };

  const handleMove = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= draftOrder.length) return;
    const updatedOrder = [...draftOrder];
    const [removed] = updatedOrder.splice(index, 1);
    updatedOrder.splice(newIndex, 0, removed);
    setDraftOrder(updatedOrder);
    onUpdate({ draft: { order: updatedOrder } });
  };

  const handleShuffle = () => {
    const shuffled = [...draftOrder].sort(() => Math.random() - 0.5);
    setDraftOrder(shuffled);
    onUpdate({ draft: { order: shuffled } });
  };

  const draftModeOptions = [
    {
      id: ASSIGNMENT_MODES.DRAFT,
      title: 'Snake Draft',
      description: 'Traditional serpentine draft order.'
    },
    {
      id: ASSIGNMENT_MODES.DOUBLE_SNAKE,
      title: 'Double-Headed Snake',
      description: 'Wraps every round, with picks reversing twice for extra balance.'
    },
    {
      id: ASSIGNMENT_MODES.AUCTION,
      title: 'Auction Draft',
      description: 'Managers bid on teams with a shared budget.'
    },
    {
      id: ASSIGNMENT_MODES.AUTO_ASSIGN,
      title: 'Auto Assign',
      description: 'Teams are randomly assigned to managers.'
    },
    {
      id: ASSIGNMENT_MODES.MANUAL,
      title: 'Manual Assignment',
      description: 'Commissioner assigns teams outside the app.'
    }
  ];

  const groupingOptions = [
    {
      id: 'conference',
      label: 'Split by conference',
      description: 'Automatically group teams by conference (e.g., East vs West).'
    },
    {
      id: 'division',
      label: 'Split by division',
      description: 'Alternate divisions between pools for a unique mix.'
    },
    {
      id: 'custom',
      label: 'Custom pools',
      description: 'Manually decide which teams belong to each pool.'
    }
  ];

  const handleGroupingModeChange = (mode) => {
    if (draftLocked) return;
    let updatedConfig;

    if (mode === 'custom') {
      updatedConfig = {
        ...doubleSnakeConfig,
        groupingMode: mode
      };
      updatedConfig = normalizeDoubleSnakeConfig(updatedConfig, teamPoolTeams, rosterSize);
    } else {
      updatedConfig = generateAutoDoubleSnakeConfig(teamPoolTeams, mode, rosterSize);
    }

    setDoubleSnakeConfig(updatedConfig);
    onUpdate({ draft: { doubleSnakeConfig: updatedConfig } });
  };

  const handleGroupLabelChange = (poolId, label) => {
    if (draftLocked) return;
    const updated = renameDoubleSnakeGroup(doubleSnakeConfig, poolId, label);
    setDoubleSnakeConfig(updated);
    onUpdate({ draft: { doubleSnakeConfig: updated } });
  };

  const handlePicksPerPoolChange = (poolId, value) => {
    if (draftLocked) return;
    const numeric = Math.max(0, Number(value) || 0);
    const updated = {
      ...doubleSnakeConfig,
      picksPerPool: {
        ...doubleSnakeConfig.picksPerPool,
        [poolId]: numeric
      }
    };
    const normalized = normalizeDoubleSnakeConfig(updated, teamPoolTeams, rosterSize);
    setDoubleSnakeConfig(normalized);
    const totalPicks = Object.values(normalized.picksPerPool || {}).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
    if (totalPicks > 0) {
      setRosterSize(totalPicks);
      onUpdate({
        draft: { doubleSnakeConfig: normalized },
        rosterSettings: { rosterSize: totalPicks }
      });
    } else {
      onUpdate({ draft: { doubleSnakeConfig: normalized } });
    }
  };

  const handleTeamAssignment = (teamId, poolId) => {
    if (draftLocked) return;
    const updated = updateTeamAssignment(doubleSnakeConfig, teamId, poolId);
    const normalized = normalizeDoubleSnakeConfig(updated, teamPoolTeams, rosterSize);
    setDoubleSnakeConfig(normalized);
    onUpdate({ draft: { doubleSnakeConfig: normalized } });
  };

  const teamAssignments = useMemo(() => {
    const assignments = {};
    (doubleSnakeConfig.groups || []).forEach((group) => {
      (group.teamIds || []).forEach((teamId) => {
        assignments[teamId] = group.id;
      });
    });
    return assignments;
  }, [doubleSnakeConfig]);

  const totalDoubleSnakePicks = useMemo(() => (
    Object.values(doubleSnakeConfig.picksPerPool || {}).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    )
  ), [doubleSnakeConfig]);

  const handleRosterSizeChange = (value) => {
    if (draftLocked && assignmentMode !== ASSIGNMENT_MODES.DOUBLE_SNAKE) return;
    const numeric = Math.max(1, Number(value) || 1);
    setRosterSize(numeric);

    if (assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE) {
      const rebalanced = rebalancePicksForRosterSize(doubleSnakeConfig, numeric);
      const normalized = normalizeDoubleSnakeConfig(rebalanced, teamPoolTeams, numeric);
      setDoubleSnakeConfig(normalized);
      onUpdate({
        draft: { doubleSnakeConfig: normalized },
        rosterSettings: { rosterSize: numeric }
      });
    } else {
      onUpdate({ rosterSettings: { rosterSize: numeric } });
    }
  };

  const handleAuctionBudgetChange = (value) => {
    if (draftLocked) return;
    const numeric = Math.max(0, Number(value) || 0);
    setAuctionBudget(numeric);
    onUpdate({
      draft: { auctionBudget: numeric },
      rosterSettings: { auctionBudget: numeric }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex items-center text-gray-600 hover:text-indigo-600 transition text-sm">
              <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
            </button>
          )}
          <h2 className="text-xl font-semibold text-gray-800">Draft Settings</h2>
        </div>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Roster Allocation</h3>
          <p className="text-sm text-gray-500">
            Control how many teams each manager ends up with, and configure mode-specific limits.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teams per manager (total)
            </label>
            <input
              type="number"
              min="1"
              value={rosterSize}
              onChange={(event) => handleRosterSizeChange(event.target.value)}
              disabled={draftLocked && assignmentMode !== ASSIGNMENT_MODES.DOUBLE_SNAKE}
              className="w-full border rounded-md px-3 py-2"
            />
            {assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE && (
              <p className="mt-2 text-xs text-indigo-600">
                Total picks split across both pools. Adjust pool splits below to fine-tune.
              </p>
            )}
          </div>

          {assignmentMode === ASSIGNMENT_MODES.AUCTION && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auction budget per manager
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={auctionBudget}
                onChange={(event) => handleAuctionBudgetChange(event.target.value)}
                disabled={draftLocked}
                className="w-full border rounded-md px-3 py-2"
              />
              <p className="mt-2 text-xs text-gray-500">
                Managers spend from this budget to bid on teams.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Draft Type</h3>
          <p className="text-sm text-gray-500">Choose how teams are assigned to managers.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {draftModeOptions.map(option => (
            <label
              key={option.id}
              className={`border rounded-lg p-4 cursor-pointer transition ${assignmentMode === option.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'} ${draftLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="assignmentMode"
                  value={option.id}
                  checked={assignmentMode === option.id}
                  onChange={() => handleAssignmentModeChange(option.id)}
                  disabled={draftLocked}
                  className="mt-1 h-4 w-4 text-indigo-600 border-gray-300"
                />
                <div>
                  <p className="font-semibold text-gray-800">{option.title}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </div>
            </label>
          ))}
        </div>

        {assignmentMode === ASSIGNMENT_MODES.DRAFT && (
          <div className="flex items-center justify-between border rounded-lg p-4 bg-gray-50">
            <div>
              <p className="text-sm font-semibold text-gray-700">Snake Draft</p>
              <p className="text-xs text-gray-500">Reverse order every round for fairness.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={useSnakeDraft}
                onChange={(event) => handleSnakeToggle(event.target.checked)}
                disabled={draftLocked}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <span>{useSnakeDraft ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
        )}

        {assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE && (
          <div className="space-y-5 border rounded-lg p-4 bg-indigo-50/40">
            <div>
              <h4 className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">Double-Headed Snake</h4>
              <p className="text-xs text-indigo-700 mt-1">
                Configure two parallel pools. Managers alternate between pools each round so both snakes progress simultaneously.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-indigo-800 uppercase">Grouping</p>
              <div className="grid md:grid-cols-3 gap-3">
                {groupingOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`border rounded-lg p-3 cursor-pointer transition ${
                      doubleSnakeConfig.groupingMode === option.id
                        ? 'border-indigo-500 bg-white shadow-sm'
                        : 'border-indigo-200 bg-indigo-50'
                    } ${draftLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="doubleSnakeGrouping"
                        value={option.id}
                        checked={doubleSnakeConfig.groupingMode === option.id}
                        onChange={() => handleGroupingModeChange(option.id)}
                        disabled={draftLocked}
                        className="mt-1 h-4 w-4 text-indigo-600 border-indigo-300"
                      />
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">{option.label}</p>
                        <p className="text-xs text-indigo-700">{option.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {(doubleSnakeConfig.groups || []).map((group) => (
                <div key={group.id} className="bg-white border border-indigo-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-indigo-700 uppercase block">Pool Name</label>
                      <input
                        type="text"
                        value={group.label}
                        onChange={(event) => handleGroupLabelChange(group.id, event.target.value)}
                        disabled={draftLocked}
                        className="mt-1 w-full border border-indigo-300 rounded-md px-2 py-1 text-sm"
                        placeholder={group.id === DOUBLE_SNAKE_POOLS.POOL_A ? 'East' : 'West'}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-indigo-700 uppercase block">Teams Assigned</label>
                      <p className="text-lg font-semibold text-indigo-900 mt-1 text-right">{group.teamIds?.length || 0}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-indigo-700 uppercase block">
                      Total picks from {group.label || 'Pool'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={doubleSnakeConfig.picksPerPool?.[group.id] ?? 0}
                      onChange={(event) => handlePicksPerPoolChange(group.id, event.target.value)}
                      disabled={draftLocked}
                      className="mt-1 w-full border border-indigo-300 rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-indigo-200 rounded-lg">
              <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100">
                <h5 className="text-sm font-semibold text-indigo-900">Team Pool Assignments</h5>
                <div className="text-right">
                  <p className="text-xs text-indigo-600">
                    {teamPoolTeams.length} teams • {participants.length} managers
                  </p>
                  <p className="text-xs font-semibold text-indigo-800">
                    Total picks configured: {totalDoubleSnakePicks} (target {rosterSize})
                  </p>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-indigo-100">
                {teamPoolTeams.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-indigo-600">
                    Select a team pool first to configure the double-headed snake draft.
                  </div>
                )}
                {teamPoolTeams.map((team) => {
                  const assignedPool = teamAssignments[team.id] || DOUBLE_SNAKE_POOLS.POOL_A;
                  return (
                    <div
                      key={team.id}
                      className="px-4 py-3 flex items-center justify-between gap-4 bg-white hover:bg-indigo-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        {team.logo && (
                          <img
                            src={team.logo}
                            alt={team.shortName || team.name}
                            className="h-8 w-8 rounded-full border border-indigo-100 object-contain bg-white"
                          />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-indigo-900">{team.name || team.shortName}</p>
                          <p className="text-xs text-indigo-600">
                            {team.conference ? `${team.conference} Conference` : 'No conference'} •{' '}
                            {team.division ? `${team.division} Division` : 'No division'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {(doubleSnakeConfig.groups || []).map((group) => (
                          <label
                            key={`${team.id}-${group.id}`}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border ${
                              assignedPool === group.id
                                ? 'border-indigo-500 bg-indigo-100 text-indigo-800'
                                : 'border-indigo-200 text-indigo-600'
                            } ${draftLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <input
                              type="radio"
                              name={`double-snake-${team.id}`}
                              value={group.id}
                              checked={assignedPool === group.id}
                              onChange={() => handleTeamAssignment(team.id, group.id)}
                              disabled={draftLocked}
                              className="h-4 w-4 text-indigo-600 border-indigo-300"
                            />
                            <span className="text-xs font-medium">{group.label || 'Pool'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Draft Order</h3>
            <p className="text-sm text-gray-500">Drag managers into the desired pick order.</p>
          </div>
          <button
            type="button"
            onClick={handleShuffle}
            disabled={draftLocked}
            className="inline-flex items-center px-3 py-2 text-sm text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
          >
            <FaSyncAlt className="mr-2" /> Shuffle
          </button>
        </div>

        {loadingParticipants ? (
          <p className="text-sm text-gray-500">Loading managers…</p>
        ) : (
          <ol className="space-y-2">
            {draftOrder.map((userId, index) => (
              <li
                key={userId}
                className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">Pick {index + 1}</p>
                  <p className="text-xs text-gray-500">{participantLookup[userId] || userId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={draftLocked || index === 0}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <FaArrowUp />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={draftLocked || index === draftOrder.length - 1}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <FaArrowDown />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};

export default DraftSettingsPanel;
