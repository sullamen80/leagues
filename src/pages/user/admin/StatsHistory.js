import React, { useCallback, useState } from 'react';
import {
  archiveSeasonTeamStandings,
  archiveSeasonPlayerLeaders,
  fetchSeasonTeamSnapshots
} from '../../../gameTypes/winsPool/services/statsHistoryService';
import { FaHistory, FaSave, FaSyncAlt } from 'react-icons/fa';

const DEFAULT_LIMIT = 10;

const StatsHistory = () => {
  const [leagueKey, setLeagueKey] = useState('NBA');
  const [season, setSeason] = useState('2024');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [feedbackTone, setFeedbackTone] = useState('info');

  const setMessage = useCallback((message, tone = 'info') => {
    setFeedbackTone(tone);
    setFeedback(message);
  }, []);

  const handleCaptureSnapshot = async () => {
    if (!season.trim()) {
      setMessage('Enter a season before capturing.', 'warning');
      return;
    }

    try {
      setIsCapturing(true);
      setMessage(null);

      const trimmedSeason = season.trim();
      await archiveSeasonTeamStandings({
        league: leagueKey,
        season: trimmedSeason,
        actor: 'admin-console'
      });

      let playerArchiveSucceeded = true;

      if (leagueKey === 'NBA') {
        try {
          await archiveSeasonPlayerLeaders({
            league: leagueKey,
            season: trimmedSeason,
            actor: 'admin-console'
          });
        } catch (playerError) {
          playerArchiveSucceeded = false;
          console.warn('[Admin][StatsHistory] Player leader archive failed:', playerError);
          setMessage(
            `Team standings archived, but player leaders failed: ${playerError.message || 'unknown error'}.`,
            'warning'
          );
        }
      }

      if (playerArchiveSucceeded) {
        setMessage(
          `Archived ${leagueKey} ${season} standings${leagueKey === 'NBA' ? ' and player stats' : ''}.`,
          'success'
        );
      }
      await loadSnapshots(leagueKey, trimmedSeason);
    } catch (error) {
      console.error('[Admin][StatsHistory] Capture failed:', error);
      setMessage(error.message || 'Failed to capture snapshot.', 'error');
    } finally {
      setIsCapturing(false);
    }
  };

  const loadSnapshots = useCallback(
    async (targetLeague, targetSeason) => {
      if (!targetSeason?.trim()) {
        setMessage('Enter a season to load snapshots.', 'warning');
        return;
      }

      try {
        setIsLoadingSnapshots(true);
        setMessage(null);

        const records = await fetchSeasonTeamSnapshots({
          league: targetLeague,
          season: targetSeason.trim(),
          limit: DEFAULT_LIMIT
        });

        setSnapshots(records);
        if (records.length === 0) {
          setMessage('No historical snapshots found yet.', 'info');
        }
      } catch (error) {
        console.error('[Admin][StatsHistory] Load snapshots failed:', error);
        setMessage(error.message || 'Failed to load snapshots.', 'error');
      } finally {
        setIsLoadingSnapshots(false);
      }
    },
    [setMessage]
  );

  const handleLoadSnapshots = () => {
    loadSnapshots(leagueKey, season);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-purple-900/60 border border-purple-700">
            <FaHistory className="text-purple-200 text-lg" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Historical Stats</h2>
            <p className="text-sm text-purple-200/80">
              Archive past seasons so leagues can compare historical standings while drafting.
            </p>
          </div>
        </div>
      </header>

      <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              League
            </label>
            <select
              value={leagueKey}
              onChange={(event) => setLeagueKey(event.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="NBA">NBA</option>
              <option value="NFL">NFL</option>
            </select>
          </div>
          <div>
            <label htmlFor="seasonInput" className="block text-sm font-medium text-gray-300 mb-1">
              Season
            </label>
            <input
              id="seasonInput"
              type="text"
              value={season}
              onChange={(event) => setSeason(event.target.value)}
              placeholder="e.g. 2024 or 2024-25"
              className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={handleCaptureSnapshot}
              disabled={isCapturing}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              <FaSave />
              {isCapturing ? 'Archiving…' : 'Archive Team Standings'}
            </button>
            <button
              type="button"
              onClick={handleLoadSnapshots}
              disabled={isLoadingSnapshots}
              className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-60"
            >
              <FaSyncAlt />
              {isLoadingSnapshots ? 'Loading…' : 'Load History'}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-md px-4 py-3 text-sm ${
              feedbackTone === 'success'
                ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40'
                : feedbackTone === 'error'
                ? 'bg-red-500/10 text-red-200 border border-red-500/40'
                : feedbackTone === 'warning'
                ? 'bg-amber-500/10 text-amber-200 border border-amber-500/40'
                : 'bg-indigo-500/10 text-indigo-200 border border-indigo-500/40'
            }`}
          >
            {feedback}
          </div>
        )}
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-xl">
        <header className="border-b border-gray-700 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Season Snapshots</h3>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              {leagueKey} &bull; {season || '—'}
            </p>
          </div>
          {snapshots.length > 0 && (
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Showing latest {snapshots.length}
            </span>
          )}
        </header>

        {isLoadingSnapshots ? (
          <div className="p-6 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400"></div>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-6 text-sm text-gray-400 text-center">
            No snapshot data loaded. Enter a season and click &ldquo;Load History&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900/70">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Captured At
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Source
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Actor
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    League
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Season
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Teams
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Unmatched
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="hover:bg-gray-900/40 transition">
                    <td className="px-4 py-3 text-sm text-gray-200">
                      {snapshot.capturedAt
                        ? new Date(snapshot.capturedAt).toLocaleString()
                        : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 capitalize">
                      {snapshot.source || 'manual'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {snapshot.actor || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {snapshot.league || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {snapshot.season || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {snapshot.meta?.teamCount ?? snapshot.entries?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {snapshot.meta?.unmatchedCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsHistory;
