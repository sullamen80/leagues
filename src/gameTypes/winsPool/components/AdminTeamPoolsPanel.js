import React, { useEffect, useMemo, useState } from 'react';
import { FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaPlus } from 'react-icons/fa';
import { saveCustomTeamPool } from '../services/teamPoolService';
import { DRAFT_STATUS } from '../constants/winsPoolConstants';

const AdminTeamPoolsPanel = ({
  leagueId,
  onApplyPool,
  existingTeamPool,
  globalPools = [],
  leaguePools = [],
  setTeamPoolOptions = () => {},
  onBack,
  draftStatus
}) => {
  const [selectedPoolId, setSelectedPoolId] = useState(existingTeamPool?.id || null);
  const [selectedPool, setSelectedPool] = useState(existingTeamPool || null);
  const [excludedTeamIds, setExcludedTeamIds] = useState(existingTeamPool?.excludedTeamIds || []);
  const [feedback, setFeedback] = useState('');
  const [customPoolName, setCustomPoolName] = useState('');
  const [customPoolDescription, setCustomPoolDescription] = useState('');
  const [customTeamsText, setCustomTeamsText] = useState('');
  const [isGlobalPool, setIsGlobalPool] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  const draftLocked = draftStatus && draftStatus !== DRAFT_STATUS.NOT_STARTED;

  const combinedPools = useMemo(() => {
    const map = new Map();
    globalPools.forEach(pool => {
      map.set(pool.id, { ...pool, scope: pool.scope || 'preset' });
    });
    leaguePools.forEach(pool => {
      map.set(pool.id, { ...pool, scope: pool.scope || 'league' });
    });
    if (existingTeamPool) {
      map.set(existingTeamPool.id, { ...existingTeamPool, scope: existingTeamPool.scope || (existingTeamPool.id?.startsWith('preset') ? 'preset' : 'custom') });
    }
    return Array.from(map.values());
  }, [existingTeamPool, globalPools, leaguePools]);

  useEffect(() => {
    if (!selectedPoolId && combinedPools.length) {
      setSelectedPoolId(existingTeamPool?.id || combinedPools[0].id);
    }
  }, [combinedPools, existingTeamPool, selectedPoolId]);

  useEffect(() => {
    if (!selectedPoolId) {
      setSelectedPool(null);
      return;
    }
    const pool = combinedPools.find(p => p.id === selectedPoolId);
    if (pool) {
      setSelectedPool(pool);
      const defaultExcluded = existingTeamPool && existingTeamPool.id === pool.id
        ? (existingTeamPool.excludedTeamIds || [])
        : [];
      setExcludedTeamIds(defaultExcluded);
    }
  }, [combinedPools, existingTeamPool, selectedPoolId]);

  const optionGroups = useMemo(() => ([
    { label: 'Preset & Global Pools', pools: globalPools },
    { label: 'League Pools', pools: leaguePools }
  ]), [globalPools, leaguePools]);

  const handleToggleTeam = (teamId) => {
    setExcludedTeamIds(prev => (
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    ));
  };

  const handleResetExclusions = () => {
    setExcludedTeamIds([]);
  };

  const handleApplySelection = () => {
    if (!selectedPool || !onApplyPool) return;
    const filteredTeams = (selectedPool.teams || []).filter(team => !excludedTeamIds.includes(team.id));
    const payload = {
      ...selectedPool,
      teams: filteredTeams,
      excludedTeamIds: [...excludedTeamIds],
      updatedAt: new Date().toISOString()
    };
    onApplyPool(payload);
    setFeedback('Team pool updated. Remember to save your settings.');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleCreateCustomPool = async (event) => {
    event.preventDefault();
    setFeedback('');
    setIsSavingCustom(true);
    try {
      const teams = customTeamsText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [name, conference = '', division = '', logo = ''] = line.split('|').map(part => part.trim());
          return {
            id: `${(customPoolName || 'custom').replace(/\s+/g, '-')}-${index}`,
            name,
            shortName: name,
            conference,
            division,
            logo
          };
        });

      if (!teams.length) {
        throw new Error('Enter at least one team (format: Team Name | Conference | Division | Logo URL).');
      }

      const savedPool = await saveCustomTeamPool({
        leagueId,
        isGlobal: isGlobalPool,
        pool: {
          name: customPoolName || 'Custom Pool',
          description: customPoolDescription,
          teams
        }
      });

      setTeamPoolOptions(prev => ({
        global: isGlobalPool ? [...prev.global.filter(pool => pool.id !== savedPool.id), savedPool] : prev.global,
        league: !isGlobalPool ? [...prev.league.filter(pool => pool.id !== savedPool.id), savedPool] : prev.league
      }));

      setCustomPoolName('');
      setCustomPoolDescription('');
      setCustomTeamsText('');
      setIsGlobalPool(false);
      setSelectedPoolId(savedPool.id);
      setFeedback('Custom pool saved. Select it from the list to apply.');
      setTimeout(() => setFeedback(''), 4000);
    } catch (error) {
      console.error('[WinsPool][AdminTeamPoolsPanel] Failed to save custom pool:', error);
      setFeedback(error.message || 'Failed to save custom pool.');
    } finally {
      setIsSavingCustom(false);
    }
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
          <h2 className="text-xl font-semibold text-gray-800">Team Pools</h2>
        </div>
      </div>

      {draftLocked && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded">
          <FaExclamationTriangle />
          <span>Draft has started. You can view pools but must keep the current selection.</span>
        </div>
      )}

      {feedback && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded">
          <FaCheckCircle />
          <span>{feedback}</span>
        </div>
      )}

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select a pool</label>
          <select
            value={selectedPoolId || ''}
            onChange={(event) => setSelectedPoolId(event.target.value)}
            className="w-full border rounded-md px-3 py-2"
            disabled={draftLocked}
          >
            {!selectedPoolId && <option value="">Choose a pool...</option>}
            {optionGroups.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.pools.map(pool => (
                  <option key={pool.id} value={pool.id}>{pool.name}</option>
                ))}
              </optgroup>
            ))}
            {existingTeamPool && !combinedPools.some(pool => pool.id === existingTeamPool.id) && (
              <option value={existingTeamPool.id}>{existingTeamPool.name || 'Current Pool'}</option>
            )}
          </select>
        </div>

        {selectedPool && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">{selectedPool.name}</p>
                <p className="text-xs text-gray-500">{selectedPool.description || `${selectedPool.teams?.length || 0} teams available`}</p>
              </div>
              <button
                type="button"
                onClick={handleResetExclusions}
                className="text-xs text-indigo-600 hover:text-indigo-500"
              >
                Reset selections
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(selectedPool.teams || []).map(team => {
                const excluded = excludedTeamIds.includes(team.id);
                return (
                  <label
                    key={team.id}
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition ${excluded ? 'bg-gray-100 border-gray-200 opacity-70' : 'bg-white border-indigo-100'}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      checked={!excluded}
                      disabled={draftLocked}
                      onChange={() => handleToggleTeam(team.id)}
                    />
                    {team.logo && (
                      <img
                        src={team.logo}
                        alt={`${team.name} logo`}
                        className="h-8 w-8 rounded-full border border-gray-200 bg-white object-contain"
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{team.city} {team.name}</p>
                      <p className="text-xs text-gray-500 uppercase">{team.conference || 'Independent'}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {excludedTeamIds.length} teams excluded — {selectedPool.teams.length - excludedTeamIds.length} available.
              </p>
              <button
                type="button"
                onClick={handleApplySelection}
                disabled={draftLocked}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-500 disabled:opacity-50"
              >
                Apply Selection
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FaPlus className="text-indigo-500" />
          <h3 className="text-lg font-semibold">Create Custom Pool</h3>
        </div>

        <form className="space-y-4" onSubmit={handleCreateCustomPool}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pool name</label>
            <input
              type="text"
              value={customPoolName}
              onChange={(event) => setCustomPoolName(event.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="e.g., 2025 Euro Clubs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={customPoolDescription}
              onChange={(event) => setCustomPoolDescription(event.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teams (one per line)</label>
            <textarea
              value={customTeamsText}
              onChange={(event) => setCustomTeamsText(event.target.value)}
              className="w-full border rounded-md px-3 py-2 h-40"
              placeholder="Team Name | Conference | Division | Logo URL"
            />
            <p className="text-xs text-gray-500 mt-2">
              Example: <code>Chicago Bulls | East | Central | https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg</code>
            </p>
          </div>
          <label className="flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isGlobalPool}
              onChange={(event) => setIsGlobalPool(event.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
            <span>Make this pool available to all leagues</span>
          </label>
          <div>
            <button
              type="submit"
              disabled={isSavingCustom}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSavingCustom ? 'Saving...' : 'Save Custom Pool'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AdminTeamPoolsPanel;
