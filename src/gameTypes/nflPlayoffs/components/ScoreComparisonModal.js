import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ROUND_DISPLAY_NAMES, ROUND_KEYS } from '../constants/playoffConstants';
import { normalizeScoringSettings } from '../config/scoringConfig';

const stringsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getMatchupsForRound = (entry, round) => {
  if (!entry) return [];
  if (round === ROUND_KEYS.SUPER_BOWL) {
    return entry[ROUND_KEYS.SUPER_BOWL] ? [entry[ROUND_KEYS.SUPER_BOWL]] : [];
  }
  return Array.isArray(entry[round]) ? entry[round] : [];
};

const ScoreComparisonModal = ({
  isOpen,
  onClose,
  leagueId,
  round,
  matchupIndex,
  officialMatchup,
  scoringSettings = null,
  activeEntryId = null,
  userMatchup = null
}) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [scoreboardMap, setScoreboardMap] = useState({});
  const [leagueUserMap, setLeagueUserMap] = useState({});
  const normalized = useMemo(() => normalizeScoringSettings(scoringSettings), [scoringSettings]);
  const teamThreshold = normalized.scoreBonusTeamThreshold ?? 7;
  const totalThreshold = normalized.scoreBonusTotalThreshold ?? 10;
  const roundLabel = ROUND_DISPLAY_NAMES?.[round] || round;

  useEffect(() => {
    if (!isOpen || !leagueId || !officialMatchup) return;
    let mounted = true;

    const fetchComparisons = async () => {
      setLoading(true);
      try {
        let board = scoreboardMap;
        if (!Object.keys(board).length) {
          const bracketRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
          const bracketSnap = await getDoc(bracketRef);
          board = bracketSnap.exists() ? bracketSnap.data()?.scoreboard?.map || {} : {};
          if (mounted) setScoreboardMap(board);
        }
        let usersMap = leagueUserMap;
        if (!Object.keys(usersMap).length) {
          const leagueRef = doc(db, 'leagues', leagueId);
          const leagueSnap = await getDoc(leagueRef);
          if (leagueSnap.exists()) {
            const leagueUsers = leagueSnap.data()?.users || [];
            usersMap = leagueUsers.reduce((acc, user) => {
              if (user?.id) {
                acc[user.id] = user.username || user.displayName || user.email || null;
              }
              return acc;
            }, {});
          } else {
            usersMap = {};
          }
          if (mounted) setLeagueUserMap(usersMap);
        }
        const snapshot = await getDocs(collection(db, 'leagues', leagueId, 'userData'));
        if (!mounted) return;
        const userDocsMap = { ...usersMap };
        const actualTeam1 = toNumber(officialMatchup.team1Score);
        const actualTeam2 = toNumber(officialMatchup.team2Score);
        const hasOfficialScores = actualTeam1 !== null && actualTeam2 !== null;
        const candidates = [];
        const entries = [];

        snapshot.forEach((docSnap) => {
          entries.push({ id: docSnap.id, data: docSnap.data() });
        });

        const resolveParticipantName = (entryId) => {
          return userDocsMap?.[entryId] || null;
        };

        const userLookups = entries.map(async (entry) => {
          try {
            const userRef = doc(db, 'users', entry.id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userDocsMap[entry.id] =
                userData.displayName || userData.username || null;
            }
          } catch (err) {
            console.error(`[ScoreComparisonModal] Error fetching user ${entry.id}:`, err);
          }
        });

        if (userLookups.length > 0) {
          await Promise.all(userLookups);
          if (mounted) setLeagueUserMap(userDocsMap);
        }

        entries.forEach((entry) => {
          const data = entry.data;
          const matchups = getMatchupsForRound(data, round);
          const prediction = matchups[matchupIndex];
          if (!prediction) return;
          const predictedTeam1 = toNumber(prediction.team1Score);
          const predictedTeam2 = toNumber(prediction.team2Score);
          if (predictedTeam1 === null || predictedTeam2 === null) return;

          const predictedWinner =
            prediction.winner ||
            (predictedTeam1 === predictedTeam2
              ? null
              : predictedTeam1 > predictedTeam2
              ? prediction.team1
              : prediction.team2);
          const winnerMatches =
            hasOfficialScores && predictedWinner
              ? stringsEqual(predictedWinner, officialMatchup.winner)
              : null;

          const maxTeamDiff = hasOfficialScores
            ? Math.max(
                Math.abs(predictedTeam1 - actualTeam1),
                Math.abs(predictedTeam2 - actualTeam2)
              )
            : null;

        const combinedDiff = hasOfficialScores
          ? Math.abs(predictedTeam1 - actualTeam1) + Math.abs(predictedTeam2 - actualTeam2)
          : null;

          const withinTeamThreshold = hasOfficialScores ? maxTeamDiff <= teamThreshold : false;
        const withinTotalThreshold = hasOfficialScores ? combinedDiff <= totalThreshold : false;
        const eligible =
          hasOfficialScores && winnerMatches && withinTeamThreshold && withinTotalThreshold;

          const participantName = resolveParticipantName(entry.id) || 'Unknown User';

          candidates.push({
            userId: entry.id,
            name: participantName,
            predictedTeam1,
            predictedTeam2,
            combinedDiff,
            maxTeamDiff,
          totalDiff: combinedDiff,
            winnerMatches,
            withinTeamThreshold,
            withinTotalThreshold,
            eligible
          });
        });

        const eligibleCandidates = hasOfficialScores
          ? candidates.filter((candidate) => candidate.eligible)
          : [];
        const winnerIds = new Set();
        if (eligibleCandidates.length) {
          const minDiff = Math.min(
            ...eligibleCandidates.map((candidate) => candidate.combinedDiff)
          );
          eligibleCandidates
            .filter((candidate) => candidate.combinedDiff === minDiff)
            .forEach((candidate) => winnerIds.add(candidate.userId));
        }

        if (hasOfficialScores) {
          candidates.sort((a, b) => a.combinedDiff - b.combinedDiff);
        } else {
          candidates.sort((a, b) => a.name.localeCompare(b.name));
        }
        const withRank = candidates.map((candidate, idx) => ({
          ...candidate,
          rank: idx + 1,
          isCurrent: activeEntryId && candidate.userId === activeEntryId,
          isWinner: winnerIds.has(candidate.userId)
        }));
        setRows(withRank);
      } catch (err) {
        console.error('[ScoreComparisonModal] Error collecting comparisons:', err);
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchComparisons();
    return () => {
      mounted = false;
    };
  }, [
    isOpen,
    leagueId,
    round,
    matchupIndex,
    officialMatchup,
    teamThreshold,
    totalThreshold,
    activeEntryId
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !officialMatchup) return null;

  const actualScoreDisplay = `${officialMatchup.team1 || 'Team 1'} ${officialMatchup.team1Score ?? '-'} • ${
    officialMatchup.team2 || 'Team 2'
  } ${officialMatchup.team2Score ?? '-'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 sm:px-4 py-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">{roundLabel}</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Score Comparison
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-300"
            >
              Close
            </button>
          </div>

          <div className="px-4 sm:px-5 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-gray-700 dark:text-gray-200">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Official Score
              </p>
              <p className="font-semibold">{actualScoreDisplay}</p>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>
                Highlighted rows show the closest eligible predictions (correct winner and within{' '}
                {teamThreshold} per-team / {totalThreshold} total points). Your entry is shaded in
                indigo.
              </p>
              {officialMatchup.team1Score == null || officialMatchup.team2Score == null ? (
                <p>Official scores are not available yet. Showing predictions only.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 sm:py-4 flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="text-center py-6 text-gray-500">Loading comparisons...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              No predictions found for this matchup yet.
            </div>
          ) : (
            <div className="overflow-y-auto h-full rounded-lg border border-gray-100 dark:border-gray-800 overscroll-contain">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 uppercase text-xs border-b">
                    <th className="py-2 pr-2">Rank</th>
                    <th className="py-2 pr-2">Participant</th>
                    <th className="py-2 pr-2">Prediction</th>
                    <th className="py-2 pr-2">Total Diff</th>
                    <th className="py-2 pr-2">Team Diff</th>
                    <th className="py-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.userId}
                      className={`border-b last:border-0 ${
                        row.isWinner
                          ? 'bg-green-50'
                          : row.isCurrent
                          ? 'bg-indigo-50'
                          : 'bg-white dark:bg-gray-900'
                      }`}
                    >
                      <td className="py-2 pr-2 font-semibold text-gray-700">{row.rank}</td>
                      <td className="py-2 pr-2 text-gray-800 truncate">{row.name}</td>
                      <td className="py-2 pr-2 text-gray-700">
                        {row.predictedTeam1} - {row.predictedTeam2}
                      </td>
                      <td className="py-2 pr-2 text-gray-700">
                        {row.combinedDiff == null ? '-' : row.combinedDiff.toFixed(1)}
                      </td>
                      <td className="py-2 pr-2 text-gray-700">
                        {row.maxTeamDiff == null ? '-' : row.maxTeamDiff.toFixed(1)}
                      </td>
                      <td className="py-2 pr-2 text-gray-700">
                        {row.isWinner
                          ? 'Closest winner'
                          : row.winnerMatches == null
                          ? 'Awaiting official score'
                          : !row.winnerMatches
                          ? 'Wrong winner'
                          : row.withinTeamThreshold && row.withinTotalThreshold
                          ? 'Eligible'
                          : 'Outside threshold'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreComparisonModal;
