import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChartBar, FaCheck, FaEye, FaLock, FaMedal, FaTimes, FaTrophy } from 'react-icons/fa';
import { auth } from '../../../firebase';
import { WIMBLEDON_LOCK_KEY, WIMBLEDON_ROUNDS } from '../constants/wimbledonConstants';
import { calculateWimbledonLeaderboard } from '../services/wimbledonService';
import { getRequiredPredictionCount } from '../utils/drawUtils';
import './Wimbledon.css';

const Leaderboard = ({ leagueId }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    calculateWimbledonLeaderboard(leagueId).then(setData).catch((err) => setError(err.message));
  }, [leagueId]);

  if (error) return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-center text-gray-500">Calculating standings…</div>;

  const currentUserId = auth.currentUser?.uid;
  const bracketsRevealed = Boolean(data.locks?.[WIMBLEDON_LOCK_KEY]?.locked);
  const setPredictionsEnabled = Boolean(data.scoring?.setPredictionEnabled);
  const requiredPicks = getRequiredPredictionCount(data.gameData);
  const viewBracket = (userId) => {
    navigate(`/league/${leagueId}?view=view&userId=${userId}`);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="border-b border-indigo-700 bg-indigo-600 px-5 py-4 text-white">
        <h2 className="text-xl font-bold">Wimbledon Standings</h2>
        <p className="text-sm text-indigo-100">
          {setPredictionsEnabled ? 'Set predictions are used as a standings tie-breaker.' : 'Click a player to view their scoring breakdown.'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-3 text-left">Rank</th><th className="px-4 py-3 text-left">Player</th><th className="px-4 py-3 text-right">Score</th><th className="px-4 py-3 text-right">Correct</th><th className="px-4 py-3 text-right">Accuracy</th><th className="px-4 py-3 text-right">Finalists</th>{setPredictionsEnabled ? <th className="px-4 py-3 text-right">Set hits</th> : null}<th className="px-4 py-3 text-center">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rankings.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;
              return (
                <tr
                  key={entry.userId}
                  onClick={() => setSelectedEntry(entry)}
                  className={`${entry.rank <= 3 ? 'bg-amber-50/50' : ''} ${
                    isCurrentUser ? 'bg-blue-50' : ''
                  } cursor-pointer hover:bg-indigo-50`}
                >
                  <td className="px-4 py-3 font-semibold">{entry.rank <= 3 ? <FaMedal className="mr-2 inline text-amber-500" /> : null}{entry.rank}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {entry.userName}
                    {isCurrentUser ? <span className="ml-1 text-blue-700">(You)</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{entry.score}</td>
                  <td className="px-4 py-3 text-right">{entry.correctPicks}/{entry.possiblePicks}</td>
                  <td className="px-4 py-3 text-right">{(entry.accuracy * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">{entry.finalistHits}/2</td>
                  {setPredictionsEnabled ? <td className="px-4 py-3 text-right">{entry.setPredictionHits}/{entry.setPredictionAttempts}</td> : null}
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                      <FaChartBar className="mr-1" />Details
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedEntry ? (
        <div
          className="wimbledon-leaderboard-dialog__backdrop"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="wimbledon-leaderboard-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bracket Breakdown</div>
                <h3 className="mt-1 text-xl font-bold text-slate-950">{selectedEntry.userName}</h3>
                <p className="mt-1 text-sm text-slate-500">Rank #{selectedEntry.rank} · {selectedEntry.score} points</p>
              </div>
              <button type="button" onClick={() => setSelectedEntry(null)} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900">
                <FaTimes />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className={`grid gap-3 ${setPredictionsEnabled ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Accuracy</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{(selectedEntry.accuracy * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Correct Picks</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{selectedEntry.correctPicks}/{selectedEntry.possiblePicks}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Finalists</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">{selectedEntry.finalistHits}/2</div>
                </div>
                {setPredictionsEnabled ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Set Accuracy</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {selectedEntry.setPredictionAttempts
                        ? `${(selectedEntry.setPredictionAccuracy * 100).toFixed(1)}%`
                        : '--'}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-xl border p-4 ${selectedEntry.championCorrect ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <FaTrophy className={selectedEntry.championCorrect ? 'text-green-600' : 'text-slate-400'} />
                    Champion Pick
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{selectedEntry.championCorrect ? 'Correct champion selected.' : 'Champion pick is not currently correct.'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900"><FaCheck className="text-indigo-600" />Completed Picks</div>
                  <p className="mt-2 text-sm text-slate-600">{selectedEntry.completedPicks}/{requiredPicks} bracket selections completed.</p>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-semibold text-slate-900">Round Breakdown</h4>
                <div className="space-y-2">
                  {WIMBLEDON_ROUNDS.map((round) => {
                    const breakdown = selectedEntry.roundBreakdown?.[round.key] || {};
                    return (
                      <div key={round.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-900">{round.label}</span>
                        <span className="text-slate-600">{breakdown.correct || 0}/{breakdown.possible || 0}</span>
                        <span className="min-w-[70px] text-right font-semibold text-slate-900">{breakdown.points || 0} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4">
              <button type="button" onClick={() => setSelectedEntry(null)} className="rounded px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Close</button>
              <button
                type="button"
                disabled={!(selectedEntry.userId === currentUserId || bracketsRevealed)}
                onClick={() => viewBracket(selectedEntry.userId)}
                className={`inline-flex items-center rounded px-4 py-2 text-sm font-semibold ${
                  selectedEntry.userId === currentUserId || bracketsRevealed
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
                }`}
              >
                {selectedEntry.userId === currentUserId || bracketsRevealed ? <FaEye className="mr-2" /> : <FaLock className="mr-2" />}
                {selectedEntry.userId === currentUserId || bracketsRevealed ? 'View Bracket' : 'Bracket Locked'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Leaderboard;
