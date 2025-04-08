// src/gameTypes/nbaPlayoffs/components/Leaderboard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
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
  getUIPointValues, 
  countCorrectSeries,
  teamsMatch,
  calculatePlayInScore
} from '../services/scoringService';

/**
 * Helper function to check if the Play-In tournament has any winners
 * @param {Object} playInData - The Play-In tournament data
 * @returns {boolean} - True if any Play-In games have winners
 */
const hasPlayInWinners = (playInData) => {
  if (!playInData) return false;
  
  // Check East conference winners
  if (playInData.east) {
    if (playInData.east.seventhEighthWinner?.team ||
        playInData.east.ninthTenthWinner?.team ||
        playInData.east.finalWinner?.team) {
      return true;
    }
  }
  
  // Check West conference winners
  if (playInData.west) {
    if (playInData.west.seventhEighthWinner?.team ||
        playInData.west.ninthTenthWinner?.team ||
        playInData.west.finalWinner?.team) {
      return true;
    }
  }
  
  return false;
};

const Leaderboard = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  onViewBracket = null,
  fogOfWarEnabled = false,
  tournamentCompleted = false
}) => {
  const navigate = useNavigate();

  // Fetch bracket data and calculate scores
  const fetchBracketData = async (leagueId, userId) => {
    try {
      // Get tournament data
      const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
      const tournamentSnap = await getDoc(tournamentRef);
    
      if (!tournamentSnap.exists()) {
        throw new Error("Tournament data not found");
      }
    
      const tournamentData = tournamentSnap.data();
      const isCompleted = !!tournamentData[ROUND_KEYS.CHAMPION];
      
      // Check if Play-In Tournament is included - FIXED
      const hasPlayInTournament = !!tournamentData[ROUND_KEYS.PLAY_IN] && 
                                  tournamentData.playInTournamentEnabled;
    
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
        return { 
          entries: [], 
          referenceData: tournamentData, 
          isCompleted,
          settings: scoringSettings,
          hasPlayInTournament
        };
      }
    
      // Process each user's bracket and calculate scores
      const processPlayerData = async (bracketDoc) => {
        try {
          const playerId = bracketDoc.id;
          const bracketData = bracketDoc.data();
          
          // Get user name
          let userName = "Unknown User";
          try {
            const userRef = doc(db, "users", playerId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userName = userData.displayName || userData.username || userData.email || "Unknown User";
            }
          } catch (userErr) {
            console.error("Error fetching user data:", userErr);
          }
          
          // Calculate score using enhanced scoring service
          const scoreData = calculateUserScore(bracketData, tournamentData, scoringSettings);
          const correctSeries = countCorrectSeries(bracketData, tournamentData);
    
          return {
            id: playerId,
            name: userName,
            points: scoreData.points,
            basePoints: scoreData.basePoints,
            seriesLengthPoints: scoreData.seriesLengthPoints,
            mvpPoints: scoreData.finalsMVPPoints,
            upsetPoints: scoreData.upsetPoints,
            correctWinners: scoreData.correctPicks,
            correctSeries,
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
            seriesLengthPoints: 0,
            mvpPoints: 0,
            upsetPoints: 0,
            correctWinners: 0,
            correctSeries: 0,
            roundBreakdown: {},
            lastUpdated: null,
            error: true,
            isCurrentUser: bracketDoc.id === auth.currentUser?.uid
          };
        }
      };
    
      const playerPromises = userBracketsSnap.docs.map(processPlayerData);
      const results = await Promise.all(playerPromises);
      const validPlayers = results.filter(player => !player.error);
      validPlayers.sort((a, b) => b.points - a.points);
    
      return { 
        entries: validPlayers, 
        referenceData: tournamentData, 
        isCompleted,
        settings: scoringSettings,
        hasPlayInTournament
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
  const renderPlayoffsHeaders = (scoringSettings) => (
    <>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Player</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
      {scoringSettings?.seriesLengthBonusEnabled && (
        <th className="hidden sm:table-cell py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Series Bonus</th>
      )}
      <th className="hidden sm:table-cell py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correct Picks</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
    </>
  );

  // Render player row with all bonuses and actions
  const renderPlayoffsRow = (player, index, handleShowDetails, onViewEntry, scoringSettings) => {
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
              {scoringSettings?.seriesLengthBonusEnabled && player.seriesLengthPoints > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full mr-2">
                  +{player.seriesLengthPoints} series
                </span>
              )}
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
        {scoringSettings?.seriesLengthBonusEnabled && (
          <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-green-600 dark:text-green-400">
            +{player.seriesLengthPoints}
          </td>
        )}
        <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">
          {player.correctWinners}
          {player.correctSeries > 0 && (
            <span className="ml-1 text-sm text-green-600">({player.correctSeries} exact)</span>
          )}
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
    // FIXED getTournamentStatus function
    const getTournamentStatus = () => {
      if (!tournamentData) return 'Not Started';
      if (tournamentData[ROUND_KEYS.CHAMPION]) return 'Completed';
      
      // Fixed Play-In tournament check
      if (tournamentData[ROUND_KEYS.PLAY_IN] && tournamentData.playInTournamentEnabled) {
        const playInData = tournamentData[ROUND_KEYS.PLAY_IN];
        // Check both conferences for any winners
        if ((playInData.east?.seventhEighthWinner?.team || 
             playInData.east?.ninthTenthWinner?.team || 
             playInData.east?.finalWinner?.team) ||
            (playInData.west?.seventhEighthWinner?.team || 
             playInData.west?.ninthTenthWinner?.team || 
             playInData.west?.finalWinner?.team)) {
          return 'In Progress (Play-In)';
        }
      }
      
      // Original first round check remains the same
      if (tournamentData[ROUND_KEYS.FIRST_ROUND] && 
          tournamentData[ROUND_KEYS.FIRST_ROUND].some(match => match && match.winner)) 
        return 'In Progress';
        
      return 'Not Started';
    };

    // Get UI-friendly display values for the scoring settings
    const uiValues = getUIPointValues(scoringSettings);

    const getScoringInfoText = () => {
      if (!scoringSettings) return "Standard point system";
      
      let text = "Points: ";
      if (scoringSettings.playInTournamentEnabled && 
          scoringSettings.playInCorrectPrediction) {
        text += `Play-In: ${scoringSettings.playInCorrectPrediction}pt, `;
      }
      text += `1st Rd: ${uiValues[ROUND_KEYS.FIRST_ROUND]}pt, Semis: ${uiValues[ROUND_KEYS.CONF_SEMIS]}pts, `;
      text += `Conf Finals: ${uiValues[ROUND_KEYS.CONF_FINALS]}pts, Finals: ${uiValues[ROUND_KEYS.NBA_FINALS]}pts, `;
      text += `MVP: ${uiValues[ROUND_KEYS.FINALS_MVP]}pts`;
      
      if (scoringSettings.seriesLengthBonusEnabled) {
        text += ", Series length bonus: +points for exact predictions";
      }
      
      if (scoringSettings.upsetBonusEnabled) {
        text += ", Upset bonus: +points for upset picks";
      }
      
      return text;
    };

    return (
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
              {leagueData?.title || 'NBA Playoffs Bracket Challenge'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Status: {getTournamentStatus()}</p>
          </div>
          <div className="mt-2 md:mt-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{getScoringInfoText()}</p>
          </div>
        </div>
      </div>
    );
  };

  // Detailed player score info for modal
  const renderScoreDetails = (player, scoringSettings) => {
    // Get UI-friendly display values for the scoring settings
    const uiValues = getUIPointValues(scoringSettings);
    
    return (
      <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm">
        {/* Score summary */}
        <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-[0.65rem] sm:text-xs">Total</p>
              <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400">{player.points}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-[0.65rem] sm:text-xs">Base</p>
              <p className="text-sm sm:text-base font-semibold dark:text-white">{player.basePoints}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-[0.65rem] sm:text-xs">Correct</p>
              <p className="text-sm sm:text-base font-semibold dark:text-white">{player.correctWinners}</p>
            </div>
            {player.seriesLengthPoints > 0 && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[0.65rem] sm:text-xs">Series Bonus</p>
                <p className="text-sm sm:text-base font-semibold text-green-600 dark:text-green-400">+{player.seriesLengthPoints}</p>
              </div>
            )}
            {player.upsetPoints > 0 && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[0.65rem] sm:text-xs">Upset Bonus</p>
                <p className="text-sm sm:text-base font-semibold text-purple-600 dark:text-purple-400">+{player.upsetPoints}</p>
              </div>
            )}
            {player.mvpPoints > 0 && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[0.65rem] sm:text-xs">MVP Bonus</p>
                <p className="text-sm sm:text-base font-semibold text-amber-600 dark:text-amber-400">+{player.mvpPoints}</p>
              </div>
            )}
            {player.correctSeries > 0 && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[0.65rem] sm:text-xs">Exact Series</p>
                <p className="text-sm sm:text-base font-semibold text-green-600 dark:text-green-400">{player.correctSeries}</p>
              </div>
            )}
          </div>
        </div>

        {/* Round breakdown table */}
        <div>
          <h3 className="font-semibold mb-2 dark:text-white text-sm sm:text-base">Round Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 text-[0.65rem] sm:text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="py-1 sm:py-2 px-1 sm:px-2 text-left font-medium text-gray-500 dark:text-gray-300">Round</th>
                  <th className="py-1 sm:py-2 px-1 sm:px-2 text-center font-medium text-gray-500 dark:text-gray-300">Winners</th>
                  <th className="py-1 sm:py-2 px-1 sm:px-2 text-center font-medium text-gray-500 dark:text-gray-300">Bonus</th>
                  <th className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-500 dark:text-gray-300">Points</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(player.roundBreakdown || {}).map(([round, data]) => {
                  // Handle Finals MVP separately
                  if (round === ROUND_KEYS.FINALS_MVP) {
                    if (!data || data.basePoints <= 0) return null;
                    return (
                      <tr key={round} className="bg-amber-50 dark:bg-amber-900/20">
                        <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                          <div className="flex items-center">
                            <FaTrophy className="text-amber-500 mr-1" />
                            {getRoundDisplayName(round)}
                          </div>
                        </td>
                        <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">
                          {data.correctPrediction ? "✓" : "-"}
                        </td>
                        <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">-</td>
                        <td className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-amber-600 dark:text-amber-400">
                          {data.basePoints || data.totalPoints || 0}
                        </td>
                      </tr>
                    );
                  }

                  // Skip rounds with no points
                  if (!data || data.totalPoints <= 0) return null;
                  
                  // Determine possible matchups by round
                  let possibleMatchups = 0;
                  if (round === ROUND_KEYS.NBA_FINALS) possibleMatchups = 1;
                  else if (round === ROUND_KEYS.CONF_FINALS) possibleMatchups = 2;
                  else if (round === ROUND_KEYS.CONF_SEMIS) possibleMatchups = 4;
                  else if (round === ROUND_KEYS.FIRST_ROUND) possibleMatchups = 8;
                  else if (round === ROUND_KEYS.PLAY_IN) possibleMatchups = 6; // 3 games per conference, 6 total
                  
                  return (
                    <tr key={round} className={`${
                      round === ROUND_KEYS.PLAY_IN ? "bg-blue-50 dark:bg-blue-900/20" : "bg-green-50 dark:bg-green-900/20"
                    }`}>
                      <td className="py-1 sm:py-2 px-1 sm:px-2 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">
                        {getRoundDisplayName(round)}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">
                        {data.correctPicks || 0}/{data.possiblePoints 
                          ? (data.possiblePoints / (scoringSettings?.playInCorrectPrediction || 1)) 
                          : possibleMatchups}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-700 dark:text-gray-300">
                        {data.seriesLengthCorrect || 0}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-2 text-right font-medium text-gray-900 dark:text-gray-200">
                        {data.basePoints || 0}
                        {(data.seriesLengthPoints > 0) && (
                          <span className="text-green-600 ml-1">+{data.seriesLengthPoints}</span>
                        )}
                        {(data.upsetPoints > 0) && (
                          <span className="text-purple-600 ml-1">+{data.upsetPoints}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="py-1 sm:py-2 px-1 sm:px-2 text-gray-900 dark:text-gray-200">Total</td>
                  <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-900 dark:text-gray-200">{player.correctWinners}</td>
                  <td className="py-1 sm:py-2 px-1 sm:px-2 text-center text-gray-900 dark:text-gray-200">{player.correctSeries}</td>
                  <td className="py-1 sm:py-2 px-1 sm:px-2 text-right text-indigo-600 dark:text-indigo-400">
                    {player.points}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Scoring info box */}
        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-1 text-[0.7rem] sm:text-sm">Scoring</h4>
          <p className="text-yellow-700 dark:text-yellow-300 text-[0.65rem] sm:text-xs whitespace-pre-wrap">
            {scoringSettings ? (
              `${scoringSettings.playInTournamentEnabled ? `Play-In: ${scoringSettings.playInCorrectPrediction || 1}, ` : ''}` +
              `1st: ${uiValues[ROUND_KEYS.FIRST_ROUND]}, Semis: ${uiValues[ROUND_KEYS.CONF_SEMIS]}, Conf Finals: ${uiValues[ROUND_KEYS.CONF_FINALS]}\n` +
              `NBA Finals: ${uiValues[ROUND_KEYS.NBA_FINALS]}, Finals MVP: ${uiValues[ROUND_KEYS.FINALS_MVP]}` +
              (scoringSettings.seriesLengthBonusEnabled ? 
                `\nSeries bonus: First Round +${scoringSettings.seriesLengthFirstRound}, Semis +${scoringSettings.seriesLengthConfSemis}, ` +
                `Conf Finals +${scoringSettings.seriesLengthConfFinals}, Finals +${scoringSettings.seriesLengthNBAFinals} for exact predictions` 
                : '') +
              (scoringSettings.upsetBonusEnabled ?
                `\nUpset bonus: +${scoringSettings.upsetBonus} for upset predictions`
                : '')
            ) : (
              "Standard scoring system"
            )}
          </p>
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