// src/gameTypes/winsPool/components/AdminScoringSettings.js
import React, { useEffect, useState } from 'react';
import { FaArrowLeft, FaSave, FaSync } from 'react-icons/fa';
import { getScoringSettings, saveScoringSettings, updateLeagueLeaderboard } from '../services/scoringService';
import { PLAYER_CATEGORY_LABELS } from '../utils/statsHelpers';
import {
  normalizeScoringSettings,
  normalizePlayerLeaderboardConfig
} from '../utils/scoringUtils';

const AdminScoringSettings = ({ leagueId, settings: externalSettings = null, onChange = null, onBack }) => {
  const isControlled = typeof onChange === 'function';
  const [settings, setSettings] = useState(() => normalizeScoringSettings(externalSettings));
  const [loading, setLoading] = useState(!isControlled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (isControlled) {
      setSettings(normalizeScoringSettings(externalSettings));
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      setLoading(true);
      try {
        const data = await getScoringSettings(leagueId);
        setSettings(normalizeScoringSettings(data));
      } catch (err) {
        console.error('[WinsPool][AdminScoringSettings] Failed to load settings:', err);
        setError(err.message || 'Failed to load scoring settings');
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, [externalSettings, isControlled, leagueId]);
  
  const updateSettings = (updater) => {
    setSettings((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      if (isControlled) {
        onChange(updated);
      }
      return updated;
    });
  };

  const handleChange = (key, value) => {
    updateSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const updatePlayerScoring = (updater) => {
    updateSettings((prev) => {
      const current = normalizePlayerLeaderboardConfig(
        prev.playerLeaderboardScoring || {}
      );
      const updated = normalizePlayerLeaderboardConfig(updater({
        ...current,
        categories: { ...current.categories }
      }));
      return {
        ...prev,
        playerLeaderboardScoring: updated
      };
    });
  };

  const handlePlayerScoringToggle = (enabled) => {
    updatePlayerScoring((current) => ({
      ...current,
      enabled
    }));
  };

  const handlePlayerCategoryRanksChange = (categoryId, maxRanks) => {
    const safeMax = Math.max(0, Math.min(10, Number(maxRanks) || 0));
    updatePlayerScoring((current) => {
      const categories = { ...current.categories };
      const existing = categories[categoryId] || { maxRanks: 0, pointsByRank: {} };
      const nextPoints = { ...existing.pointsByRank };

      Object.keys(nextPoints).forEach((rank) => {
        if (Number(rank) > safeMax) {
          delete nextPoints[rank];
        }
      });

      for (let rank = 1; rank <= safeMax; rank += 1) {
        if (nextPoints[rank] === undefined) {
          nextPoints[rank] = 0;
        }
      }

      categories[categoryId] = {
        maxRanks: safeMax,
        pointsByRank: nextPoints
      };

      return {
        ...current,
        categories
      };
    });
  };

  const handlePlayerRankPointsChange = (categoryId, rank, value) => {
    const numeric = Number(value);
    updatePlayerScoring((current) => {
      const categories = { ...current.categories };
      const existing = categories[categoryId] || { maxRanks: 0, pointsByRank: {} };
      categories[categoryId] = {
        maxRanks: Math.max(existing.maxRanks, rank),
        pointsByRank: {
          ...existing.pointsByRank,
          [rank]: Number.isFinite(numeric) ? numeric : 0
        }
      };
      return {
        ...current,
        categories
      };
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (isControlled) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    
    try {
      await saveScoringSettings(leagueId, settings);
      setMessage('Scoring settings saved successfully.');
    } catch (err) {
      console.error('[WinsPool][AdminScoringSettings] Failed to save settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  
  const handleRecalculate = async () => {
    if (isControlled) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    
    try {
      await updateLeagueLeaderboard(leagueId);
      setMessage('Leaderboard recalculated successfully.');
    } catch (err) {
      console.error('[WinsPool][AdminScoringSettings] Failed to update leaderboard:', err);
      setError(err.message || 'Failed to update leaderboard');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return <p className="text-sm text-gray-500">Loading scoring settings...</p>;
  }
  
  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition text-sm"
            >
              <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
            </button>
          )}
          <div>
            <h3 className="text-lg font-semibold">Scoring Rules</h3>
            <p className="text-sm text-gray-500">
              Configure how many points users earn for team wins, bonuses, and player leaderboard finishes.
            </p>
          </div>
        </div>
      </div>
      
      {error && !isControlled && <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded">{error}</div>}
      {message && !isControlled && <div className="p-3 bg-green-100 border border-green-200 text-green-700 rounded">{message}</div>}
      
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points per win</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={settings.pointsPerWin}
              onChange={(event) => handleChange('pointsPerWin', Number(event.target.value))}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Overtime win bonus</label>
            <input
              type="number"
              step="0.5"
              value={settings.overtimeWinBonus}
              onChange={(event) => handleChange('overtimeWinBonus', Number(event.target.value))}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Playoff win multiplier</label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={settings.playoffWinMultiplier}
              onChange={(event) => handleChange('playoffWinMultiplier', Number(event.target.value))}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          
          <div className="flex items-center space-x-2 pt-6">
            <input
              type="checkbox"
              checked={settings.allowDuplicateTeams}
              onChange={(event) => handleChange('allowDuplicateTeams', event.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Allow duplicate teams across rosters</label>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Player Leaderboard Bonuses</h4>
              <p className="text-xs text-gray-500">
                Award extra points when rostered teams have players finish near the top of league leaderboards.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(settings.playerLeaderboardScoring?.enabled)}
                onChange={(event) => handlePlayerScoringToggle(event.target.checked)}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              Enable
            </label>
          </div>

          {settings.playerLeaderboardScoring?.enabled && (
            <div className="space-y-4">
              {Object.entries(PLAYER_CATEGORY_LABELS).map(([categoryId, label]) => {
                const categoryConfig =
                  settings.playerLeaderboardScoring?.categories?.[categoryId] || {};
                const maxRanks = categoryConfig.maxRanks ?? 0;
                const pointsByRank = categoryConfig.pointsByRank || {};

                return (
                  <div
                    key={`player-scoring-${categoryId}`}
                    className="border border-gray-100 rounded-lg p-4 bg-gray-50 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-800">{label}</h5>
                        <p className="text-xs text-gray-500">
                          Configure points for top performers (up to 10 ranks).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Ranks awarded</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={maxRanks}
                          onChange={(event) =>
                            handlePlayerCategoryRanksChange(categoryId, event.target.value)
                          }
                          className="w-20 border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>

                    {maxRanks > 0 && (
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Array.from({ length: maxRanks }, (_, index) => {
                          const rank = index + 1;
                          return (
                            <div key={`${categoryId}-rank-${rank}`} className="space-y-1">
                              <label className="block text-xs font-medium text-gray-600">
                                Rank {rank}
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                value={pointsByRank[rank] ?? 0}
                                onChange={(event) =>
                                  handlePlayerRankPointsChange(
                                    categoryId,
                                    rank,
                                    event.target.value
                                  )
                                }
                                className="w-full border rounded px-2 py-1 text-sm"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isControlled && (
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              <FaSave className="mr-2" />
              Save settings
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleRecalculate}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <FaSync className="mr-2" />
              Recalculate leaderboard
            </button>
          </div>
        )}
      </form>
    </section>
  );
};

export default AdminScoringSettings;
