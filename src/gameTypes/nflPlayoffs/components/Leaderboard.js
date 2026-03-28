// src/gameTypes/nflPlayoffs/components/Leaderboard.js
import React from 'react';
import {
  doc,
  getDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaMedal, FaEye, FaChartBar, FaEyeSlash, FaTrophy } from 'react-icons/fa';
import BaseLeaderboard from '../../common/components/BaseLeaderboard';
// Import constants and enhanced scoring service functions
import { 
  ROUND_KEYS,
  ROUND_DISPLAY_NAMES
} from '../constants/playoffConstants';
import { 
  calculateUserScore, 
  getUIPointValues
} from '../services/scoringService';
import { describeScoringRules } from '../config/scoringConfig';

const PROP_BETS_KEY = 'Prop Bets';
const SUPER_WINNER_KEY = 'Super Winner Pick';
const BONUS_FIELDS = ['spreadPoints', 'overUnderPoints', 'scoreBonusPoints', 'perfectScorePoints'];
const ROUND_MATCHUP_COUNT = {
  [ROUND_KEYS.FIRST_ROUND]: 6,
  [ROUND_KEYS.CONF_SEMIS]: 4,
  [ROUND_KEYS.CONF_FINALS]: 2,
  [ROUND_KEYS.SUPER_BOWL]: 1
};

const Leaderboard = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  onViewBracket = null,
  fogOfWarEnabled = false,
  tournamentCompleted = false
}) => {
  // Fetch bracket data and calculate scores
  const fetchBracketData = async (leagueId, userId) => {
    try {
      const userNameCache = {};
      const resolveUserName = async (id) => {
        if (!id) return 'Unknown User';
        if (userNameCache[id]) return userNameCache[id];
        try {
          const userRef = doc(db, "users", id);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const resolved = userData.displayName || userData.username || 'Unknown User';
            userNameCache[id] = resolved;
            return resolved;
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
        userNameCache[id] = 'Unknown User';
        return 'Unknown User';
      };

      // Get tournament data
      const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
      const tournamentSnap = await getDoc(tournamentRef);
    
      if (!tournamentSnap.exists()) {
        throw new Error("Tournament data not found");
      }
    
      const tournamentData = tournamentSnap.data();
      const isCompleted = !!tournamentData[ROUND_KEYS.CHAMPION];
      
      // Get scoring settings if they exist
      let scoringSettings = null;
      try {
        const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
        const scoringSnap = await getDoc(scoringRef);
    
        if (scoringSnap.exists()) {
          scoringSettings = scoringSnap.data();
        }
      } catch (err) {
        console.error("Error fetching scoring settings:", err);
      }
      
      // Get user brackets
      const userBracketsRef = collection(db, "leagues", leagueId, "userData");
      const userBracketsSnap = await getDocs(userBracketsRef);

      if (userBracketsSnap.empty) {
        const scoreboard = tournamentData?.scoreboard;
        if (scoreboard?.entries?.length) {
          const entries = scoreboard.entries
            .map((entry) => ({
              ...entry,
              id: entry.userId,
              isCurrentUser: entry.userId === auth.currentUser?.uid
            }))
            .sort((a, b) => b.points - a.points);

          await Promise.all(
            entries.map(async (entry) => {
              entry.name = await resolveUserName(entry.userId);
            })
          );

          return {
            entries,
            referenceData: tournamentData,
            isCompleted,
            settings: scoringSettings
          };
        }

        return {
          entries: [],
          referenceData: tournamentData,
          isCompleted,
          settings: scoringSettings
        };
      }

      const processPlayerData = async (bracketDoc) => {
        try {
          const playerId = bracketDoc.id;
          const bracketData = bracketDoc.data();

          const userName = await resolveUserName(playerId);

          const scoreData = calculateUserScore(bracketData, tournamentData, scoringSettings, {
            userId: playerId,
            includeScoreBonusFromMetadata: true
          });
          return {
            id: playerId,
            name: userName,
            points: scoreData.points,
            basePoints: scoreData.basePoints,
            mvpPoints: scoreData.finalsMVPPoints,
            upsetPoints: scoreData.upsetPoints,
            propPoints: scoreData.propBetPoints,
            correctWinners: scoreData.correctPicks,
            roundBreakdown: scoreData.roundBreakdown,
            lastUpdated: bracketData.updatedAt ? new Date(bracketData.updatedAt) : null,
            isCurrentUser: playerId === auth.currentUser?.uid
          };
        } catch (playerErr) {
          console.error("Error processing player data:", playerErr);
          return {
            id: bracketDoc.id,
            name: "Error Loading User",
            points: 0,
            basePoints: 0,
            mvpPoints: 0,
            upsetPoints: 0,
            correctWinners: 0,
            roundBreakdown: {},
            lastUpdated: null,
            error: true,
            isCurrentUser: bracketDoc.id === auth.currentUser?.uid
          };
        }
      };

      const playerPromises = userBracketsSnap.docs.map(processPlayerData);
      const results = await Promise.all(playerPromises);
      const validPlayers = results.filter((player) => !player.error);
      validPlayers.sort((a, b) => b.points - a.points);
      validPlayers.forEach((player, idx) => {
        player.rank = idx + 1;
      });

      return {
        entries: validPlayers,
        referenceData: tournamentData,
        isCompleted,
        settings: scoringSettings
      };
    } catch (error) {
      console.error("Error fetching bracket data:", error);
      throw error;
    }
  };

  // Filter visible players based on fog of war settings
  const getVisiblePlayers = (players, fogOfWarEnabled, tournamentCompleted, isAdmin, userId) => {
    if (!fogOfWarEnabled || tournamentCompleted) {
      return players;
    }
    return players.filter(player => player.isCurrentUser).map(player => ({
      ...player,
      rank: players.findIndex(p => p.id === player.id) + 1
    }));
  };

  // Handle bracket viewing navigation
  const handleViewBracket = (bracketId, isEmbed, nav, league) => {
    if (isEmbed && onViewBracket) return onViewBracket(bracketId);
    nav(`/league/${league}/view?bracketId=${bracketId}`);
    return false;
  };

  const handleViewTournament = (isEmbed, nav, league) => {
    if (isEmbed && onViewBracket) return onViewBracket('tournament');
    nav(`/league/${league}/view`);
    return false;
  };

  // Helper for round display names
  const getRoundDisplayName = (roundKey) => {
    return ROUND_DISPLAY_NAMES[roundKey] || roundKey;
  };

  // Render table headers with appropriate columns
  const renderPlayoffsHeaders = () => (
    <>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Player</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
      <th className="hidden sm:table-cell py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correct Picks</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
    </>
  );

  // Render player row with all bonuses and actions
  const renderPlayoffsRow = (player, index, handleShowDetails, onViewEntry) => {
    const displayRank = player.rank || (index + 1);
    const isTopThree = displayRank <= 3;

    return (
      <tr key={player.id} className={`
        ${isTopThree ? "bg-yellow-50 dark:bg-yellow-900/30" : ""} 
        ${player.isCurrentUser ? "bg-blue-50 dark:bg-blue-900/20" : ""}
        hover:bg-gray-50 dark:hover:bg-gray-700/50
      `}>
        <td className="py-3 px-4 whitespace-nowrap">
          <div className="flex items-center">
            {displayRank === 1 && <FaMedal className="text-yellow-500 mr-1" title="1st Place" />}
            {displayRank === 2 && <FaMedal className="text-gray-400 dark:text-gray-300 mr-1" title="2nd Place" />}
            {displayRank === 3 && <FaMedal className="text-amber-700 dark:text-amber-500 mr-1" title="3rd Place" />}
            <span className={`${isTopThree ? "font-bold" : ""} text-gray-900 dark:text-gray-200`}>{displayRank}</span>
          </div>
        </td>
        <td className="py-3 px-4 whitespace-nowrap">
          <span className={`
            ${isTopThree ? "font-bold" : ""} 
            ${player.isCurrentUser ? "font-semibold" : ""}
            text-gray-900 dark:text-gray-200
          `}>
            {player.name} 
            {player.isCurrentUser && <span className="ml-1 text-blue-600 dark:text-blue-400">(You)</span>}
          </span>
          <div className="block sm:hidden mt-1">
            <div className="flex flex-wrap">
              {player.upsetPoints > 0 && (
                <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full mr-2">
                  +{player.upsetPoints} upsets
                </span>
              )}
              {player.mvpPoints > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full mr-2">
                  +{player.mvpPoints} MVP
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {player.correctWinners} correct
              </span>
            </div>
          </div>
        </td>
        <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-gray-900 dark:text-gray-200">
          {player.points}
        </td>
        <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">
          {player.correctWinners}
        </td>
        <td className="py-3 px-4 whitespace-nowrap text-center">
          <div className="flex sm:justify-center space-x-2">
            <button
              onClick={() => handleShowDetails(player)}
              className="sm:inline-flex sm:items-center px-2 sm:px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:border-green-800 focus:outline-none"
            >
              <FaChartBar className="sm:mr-1" /> 
              <span className="hidden sm:inline">Details</span>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onViewEntry(player.id);
              }}
              className="sm:inline-flex sm:items-center px-2 sm:px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:border-indigo-800 focus:outline-none"
            >
              <FaEye className="sm:mr-1" /> 
              <span className="hidden sm:inline">View</span>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Fog of War banner when active
  const renderFogOfWarBanner = () => (
    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/30 dark:border-yellow-800">
      <div className="flex items-center">
        <FaEyeSlash className="text-yellow-600 dark:text-yellow-500 mr-3 text-xl flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-400">Fog of War Mode Active</h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            The league administrator has enabled Fog of War mode. You can only see your own position on the leaderboard 
            until the playoffs are completed.
          </p>
        </div>
      </div>
    </div>
  );

  // Tournament info and status banner
  const renderTournamentInfo = (leagueData, tournamentData, scoringSettings) => {
    const getTournamentStatus = () => {
      if (!tournamentData) return 'Not Started';
      if (tournamentData[ROUND_KEYS.CHAMPION]) return 'Completed';

      const roundsToCheck = [
        ROUND_KEYS.FIRST_ROUND,
        ROUND_KEYS.CONF_SEMIS,
        ROUND_KEYS.CONF_FINALS,
        ROUND_KEYS.SUPER_BOWL
      ];

      const hasProgress = roundsToCheck.some((round) => {
        const roundData = tournamentData[round];
        if (round === ROUND_KEYS.SUPER_BOWL) {
          return !!roundData?.winner;
        }
        return Array.isArray(roundData) && roundData.some((match) => match && match.winner);
      });

      return hasProgress ? 'In Progress' : 'Not Started';
    };

    const uiValues = getUIPointValues(scoringSettings);

    const scoringSummaryLines = scoringSettings
      ? describeScoringRules(scoringSettings)
      : ['Standard point system (base rounds + MVP)'];

    return (
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
              {leagueData?.title || 'NFL Playoffs Bracket Challenge'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Status: {getTournamentStatus()}</p>
          </div>
          <div className="mt-2 md:mt-0 text-xs leading-tight text-gray-500 dark:text-gray-400">
            <div className="font-semibold text-gray-600 dark:text-gray-300 mb-1">Scoring at a glance</div>
            <ul className="space-y-1">
              {scoringSummaryLines.map((line) => (
                <li key={line} className="list-disc pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // Detailed player score info for modal
  const renderScoreDetails = (
    player,
    scoringSettings,
    visibleEntries = [],
    referenceData = null
  ) => {
    const roundBreakdown = player.roundBreakdown || {};
    const propBreakdown = roundBreakdown[PROP_BETS_KEY];

    const propResults = propBreakdown?.wagers ?? player.propBetResults ?? [];
    const propWagers = propResults.length;
    const propPoints =
      propBreakdown?.totalPoints ?? player.propPoints ?? player.propBetPoints ?? 0;
    const showPropRow = propWagers > 0 || propPoints !== 0;
    const superWinnerRecord = roundBreakdown[SUPER_WINNER_KEY];
    const resolvedSuperWinnerPick =
      superWinnerRecord?.pick ||
      player.superWinnerPick ||
      '';
    const normalizedSuperWinnerPick =
      resolvedSuperWinnerPick === 'None Selected' ? '' : resolvedSuperWinnerPick;
    const superWinnerCorrect =
      superWinnerRecord?.correctPrediction ?? Boolean(player.superWinnerCorrect);
    const superWinnerPoints =
      superWinnerRecord?.totalPoints ??
      superWinnerRecord?.basePoints ??
      player.superWinnerPoints ??
      0;
    const showSuperWinnerRow = Boolean(normalizedSuperWinnerPick);

    const finalsMVPData = roundBreakdown[ROUND_KEYS.FINALS_MVP];
    const finalsMVPPoints =
      finalsMVPData?.totalPoints ??
      finalsMVPData?.basePoints ??
      player.finalsMVPPoints ??
      0;
    const finalsMVPCorrect =
      finalsMVPData?.correctPrediction ?? Boolean(player.finalsMVPCorrect);
    const finalsMVPPick = player.finalsMVPPick || 'No pick';
    const showFinalsMVPRow =
      Boolean(finalsMVPData) ||
      Boolean(player.finalsMVPPick) ||
      player.finalsMVPCorrect !== undefined ||
      finalsMVPPoints !== 0;

    const sumRoundField = (breakdown, field) =>
      Object.values(breakdown || {}).reduce(
        (acc, record) => acc + (record?.[field] || 0),
        0
      );

    const contributions = {
      base: player.basePoints || sumRoundField(roundBreakdown, 'basePoints'),
      spread: player.spreadPoints || sumRoundField(roundBreakdown, 'spreadPoints'),
      totals: player.overUnderPoints || sumRoundField(roundBreakdown, 'overUnderPoints'),
      scoreBonus: player.scorePredictionPoints || sumRoundField(roundBreakdown, 'scoreBonusPoints'),
      perfect: player.perfectScorePoints || sumRoundField(roundBreakdown, 'perfectScorePoints'),
      upset: player.upsetPoints || sumRoundField(roundBreakdown, 'upsetPoints'),
      mvp: player.mvpPoints || 0,
      props: propPoints,
      superWinner: superWinnerPoints
    };

    const bonusRows = [];

    const averageStat = (entries, field) => {
      if (!entries || entries.length === 0) return 0;
      return (
        entries.reduce((sum, entry) => sum + sumRoundField(entry.roundBreakdown || {}, field), 0) /
        entries.length
      );
    };

    const leaderboardAverage =
      visibleEntries && visibleEntries.length
        ? visibleEntries.reduce((sum, entry) => sum + (entry.points || 0), 0) /
          visibleEntries.length
        : player.points;

    const topEntry = visibleEntries && visibleEntries.length ? visibleEntries[0] : null;
    const diffToLeader = topEntry
      ? Math.max(0, (topEntry.points || 0) - (player.points || 0))
      : 0;

    const statColorClass = {
      indigo: 'text-indigo-600 dark:text-indigo-400',
      emerald: 'text-emerald-600 dark:text-emerald-400',
      teal: 'text-teal-600 dark:text-teal-400',
      fuchsia: 'text-fuchsia-600 dark:text-fuchsia-400',
      cyan: 'text-cyan-600 dark:text-cyan-400',
      amber: 'text-amber-600 dark:text-amber-400',
      purple: 'text-purple-600 dark:text-purple-400'
    };

    const statCards = [
      {
        label: 'Base winners',
        value: contributions.base,
        meta: `${player.correctWinners || 0} correct picks`,
        color: 'indigo',
        comparison: null
      },
      {
        label: 'Spread',
        value: contributions.spread,
        meta: 'Spread-line points',
        color: 'emerald',
        comparison: averageStat(visibleEntries, 'spreadPoints')
      },
      {
        label: 'Totals',
        value: contributions.totals,
        meta: 'Over/Under points',
        color: 'teal',
        comparison: averageStat(visibleEntries, 'overUnderPoints')
      },
      {
        label: 'Score accuracy',
        value: contributions.scoreBonus,
        meta: 'Closest/accuracy bonuses',
        color: 'fuchsia',
        comparison: averageStat(visibleEntries, 'scoreBonusPoints')
      },
      {
        label: 'Perfect score',
        value: contributions.perfect,
        meta: 'Exact predictions only',
        color: 'cyan',
        comparison: averageStat(visibleEntries, 'perfectScorePoints')
      },
      {
        label: 'Bonuses & props',
        value: contributions.mvp + contributions.props + contributions.superWinner,
        meta: `MVP ${contributions.mvp} • Props ${contributions.props} • Super ${contributions.superWinner}`,
        color: 'amber',
        comparison: null
      },
      {
        label: 'Upset bonus',
        value: contributions.upset,
        meta: 'Seed differential',
        color: 'purple',
        comparison: averageStat(visibleEntries, 'upsetPoints')
      }
    ];

    const leaderboardContext = [
      {
        label: 'Rank',
        value: player.rank || '-',
        helper: visibleEntries?.length ? `of ${visibleEntries.length}` : ''
      },
      {
        label: 'Top score',
        value: topEntry ? `${topEntry.points} pts` : 'N/A',
        helper: topEntry ? topEntry.name : ''
      },
      {
        label: 'Gap to leader',
        value: `${diffToLeader} pts`,
        helper: topEntry && topEntry.id === player.id ? 'You are leading' : ''
      },
      {
        label: 'Average entry',
        value: `${leaderboardAverage?.toFixed(1)} pts`,
        helper: `${visibleEntries?.length || 1} entries`
      },
      {
        label: 'Last saved',
        value: player.lastUpdated
          ? new Date(player.lastUpdated).toLocaleString()
          : 'Not saved yet',
        helper: ''
      }
    ];

    return (
      <div className="space-y-4 text-xs sm:text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
            >
              <p className="text-[0.65rem] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {card.label}
              </p>
              <p className={`text-2xl font-bold ${statColorClass[card.color] || 'text-indigo-600 dark:text-indigo-400'}`}>
                {card.value}
              </p>
              <p className="text-[0.65rem] text-gray-600 dark:text-gray-400 break-words">
                {card.meta}
              </p>
              {card.comparison !== null && visibleEntries.length > 1 && (
                <p className="text-[0.6rem] text-gray-500 dark:text-gray-400 mt-1">
                  Avg: {card.comparison.toFixed(1)}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-[0.75rem] uppercase tracking-wide mb-2">
            Leaderboard context
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {leaderboardContext.map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                <p className="text-[0.6rem] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{item.value}</p>
                {item.helper && (
                  <p className="text-[0.6rem] text-gray-500 dark:text-gray-400">{item.helper}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Round breakdown table */}
        <div>
          <h3 className="font-semibold mb-2 text-gray-500 dark:text-gray-300">Round Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-[0.65rem] sm:text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="py-1 sm:py-2 px-1 sm:px-2 text-left font-medium text-gray-500 dark:text-gray-300">
                    Round
                  </th>
                  <th className="py-1 sm:py-2 px-1 sm:px-2 text-center font-medium text-gray-500 dark:text-gray-300">
                    Winners
                  </th>
                  <th className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-500 dark:text-gray-300">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {[
                  ROUND_KEYS.FIRST_ROUND,
                  ROUND_KEYS.CONF_SEMIS,
                  ROUND_KEYS.CONF_FINALS,
                  ROUND_KEYS.SUPER_BOWL
                ].map((round) => {
                  const data = roundBreakdown[round];
                  if (!data || data.totalPoints <= 0) return null;

                  const roundMatchupCount = ROUND_MATCHUP_COUNT[round] || 0;
                  const rawCorrectPicks = data.correctPicks || 0;
                  const correctPicks = roundMatchupCount
                    ? Math.min(rawCorrectPicks, roundMatchupCount)
                    : rawCorrectPicks;
                  const bonusPoints = BONUS_FIELDS.reduce(
                    (sum, field) => sum + (data?.[field] ?? 0),
                    0
                  );
                  const winnerPoints = (data.basePoints ?? 0) + (data.upsetPoints ?? 0);
                  const totalPoints = winnerPoints + bonusPoints;
                  const winnerLabel = roundMatchupCount
                    ? `${correctPicks}/${roundMatchupCount}`
                    : `${correctPicks}`;

                  bonusRows.push({
                    label: getRoundDisplayName(round),
                    bonusPoints,
                    detail: BONUS_FIELDS.map((field) => {
                      const value = data?.[field] ?? 0;
                      if (!value) return null;
                      const label =
                        field === 'spreadPoints'
                          ? 'Spread'
                          : field === 'overUnderPoints'
                            ? 'Totals'
                            : field === 'scoreBonusPoints'
                              ? 'Score accuracy'
                              : 'Perfect score';
                      return `${label}: ${value}`;
                    }).filter(Boolean).join(' • ')
                  });

                  return (
                    <tr key={round} className="bg-green-50 dark:bg-green-900/20">
                      <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                        {getRoundDisplayName(round)}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">
                        {winnerLabel}
                      </td>
                      <td
                        className={`py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-900 dark:text-gray-200 ${
                          bonusPoints ? 'text-gray-900 dark:text-gray-100' : ''
                        }`}
                      >
                        {totalPoints}
                      </td>
                    </tr>
                  );
                })}
                {showFinalsMVPRow && (
                  <tr className="bg-amber-50 dark:bg-amber-900/20">
                    <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                      <div className="flex items-center">
                        <FaTrophy className="text-amber-500 mr-1" />
                        Finals MVP
                      </div>
                    </td>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">
                      <div>{finalsMVPCorrect ? '✓' : '✗'}</div>
                      <div className="text-[0.65rem] text-gray-500 dark:text-gray-400 truncate">
                        {finalsMVPPick}
                      </div>
                    </td>
                    <td
                      className={`py-1 sm:py-2 px-1 sm:px-2 text-right font-medium ${
                        finalsMVPPoints >= 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {finalsMVPPoints}
                    </td>
                  </tr>
                )}
                {showSuperWinnerRow && (
                  <tr className="bg-yellow-50 dark:bg-yellow-900/20">
                    <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                      Early Super Bowl Pick
                    </td>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">
                      <div>{superWinnerCorrect ? '✓' : '✗'}</div>
                      <div className="text-[0.65rem] text-gray-500 dark:text-gray-400 truncate">
                        {normalizedSuperWinnerPick || 'No pick'}
                      </div>
                    </td>
                    <td
                      className={`py-1 sm:py-2 px-1 sm:px-2 text-right font-medium ${
                        superWinnerPoints >= 0
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {superWinnerPoints}
                    </td>
                  </tr>
                )}
                {showPropRow && (
                  <tr className="bg-blue-50 dark:bg-blue-900/20">
                    <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                      Prop Bets
                    </td>
                    <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">
                      {propWagers
                        ? `${propWagers} wager${propWagers === 1 ? '' : 's'}`
                        : 'No wagers'}
                    </td>
                    <td
                      className={`py-1 sm:py-2 px-1 sm:px-2 text-right font-medium ${
                        propPoints >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {propPoints}
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="py-1 sm:py-2 px-1 sm:px-2 text-gray-900 dark:text-gray-200">
                    Total
                  </td>
                  <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-900 dark:text-gray-200">
                    {player.correctWinners}
                  </td>
                  <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-indigo-600 dark:text-indigo-400">
                    {player.points}
                  </td>
                </tr>
                </tbody>
              </table>
              {bonusRows.length > 0 && (
                <details className="mt-3 text-xs text-gray-500 dark:text-gray-300">
                  <summary className="font-semibold cursor-pointer">
                    View bonus breakdown
                  </summary>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    {bonusRows.map((entry) => (
                      <li key={entry.label}>
                        <span className="font-medium text-gray-700 dark:text-gray-100">
                          {entry.label}
                        </span>{' '}
                        &middot; {entry.bonusPoints} pts
                        {entry.detail && (
                          <div className="text-[0.65rem] text-gray-500 dark:text-gray-400">
                            {entry.detail}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
        </div>
      </div>
    );
  };
  // Dark mode compatible styles
  const darkModeClasses = {
    container: "max-w-7xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md",
    header: "flex flex-wrap justify-between items-center mb-6 pb-4 border-b dark:border-gray-700",
    headerLeft: "flex items-center space-x-4 mb-4 md:mb-0",
    backButton: "flex items-center text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition",
    title: "text-2xl font-bold dark:text-white",
    embeddedHeader: "mb-6 pb-4 border-b dark:border-gray-700",
    loadingContainer: "flex flex-col items-center justify-center p-8",
    loadingSpinner: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4",
    loadingText: "text-gray-600 dark:text-gray-300",
    tableContainer: "overflow-x-auto",
    table: "min-w-full divide-y divide-gray-200 dark:divide-gray-700",
    tableHeader: "bg-gray-50 dark:bg-gray-700",
    tableBody: "bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700",
  };

  return (
    <BaseLeaderboard
      isEmbedded={isEmbedded}
      leagueId={propLeagueId}
      hideBackButton={hideBackButton}
      entryType="Bracket"
      fetchData={fetchBracketData}
      getVisibleEntries={getVisiblePlayers}
      handleViewEntry={handleViewBracket}
      handleViewPrimary={handleViewTournament}
      renderTableHeaders={renderPlayoffsHeaders}
      renderTableRow={renderPlayoffsRow}
      renderDetailsModal={renderScoreDetails}
      renderStatusInfo={renderTournamentInfo}
      renderFogOfWarBanner={renderFogOfWarBanner}
      primaryEntryName="Playoffs Bracket"
      customClasses={darkModeClasses}
      fogOfWarEnabled={fogOfWarEnabled}
      tournamentCompleted={tournamentCompleted}
    />
  );
};

export default Leaderboard;
