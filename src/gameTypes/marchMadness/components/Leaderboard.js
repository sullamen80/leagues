import React from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaMedal, FaEye, FaChartBar, FaEyeSlash } from 'react-icons/fa';
import BaseLeaderboard from '../../common/components/BaseLeaderboard';
import LeaderboardDetails from './LeaderboardDetails';

const Leaderboard = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  onViewBracket = null,
  fogOfWarEnabled = false,
  tournamentCompleted = false
}) => {
  const defaultPoints = {
    'RoundOf64': 1,
    'RoundOf32': 2,
    'Sweet16': 4,
    'Elite8': 8,
    'FinalFour': 16,
    'Championship': 32
  };

  const navigate = useNavigate();

  console.log("Leaderboard - Received: fogOfWarEnabled:", fogOfWarEnabled, "tournamentCompleted:", tournamentCompleted);

  const fetchBracketData = async (leagueId, userId) => {
    const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
    const tournamentSnap = await getDoc(tournamentRef);

    if (!tournamentSnap.exists()) {
      throw new Error("Tournament data not found");
    }

    const tournamentData = tournamentSnap.data();
    const isCompleted = !!tournamentData.Champion;

    let scoringSettings = null;
    try {
      const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
      const scoringSnap = await getDoc(scoringRef);

      if (scoringSnap.exists()) {
        scoringSettings = scoringSnap.data();
        if (scoringSettings.bonusEnabled && !scoringSettings.bonusType) {
          scoringSettings.bonusType = 'seedDifference';
        }
        if (!scoringSettings.flatBonusValue) {
          scoringSettings.flatBonusValue = 0.5;
        }
      }
    } catch (err) {}

    const userBracketsRef = collection(db, "leagues", leagueId, "userData");
    const userBracketsSnap = await getDocs(userBracketsRef);

    if (userBracketsSnap.empty) {
      return { 
        entries: [], 
        referenceData: tournamentData, 
        isCompleted: isCompleted,
        settings: scoringSettings
      };
    }

    const processPlayerData = async (bracketDoc) => {
      try {
        const playerId = bracketDoc.id;
        const bracketData = bracketDoc.data();

        let userName = "Unknown User";
        try {
          const userRef = doc(db, "users", playerId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            userName = userData.displayName || userData.username || userData.email || "Unknown User";
          }
        } catch (userErr) {}

        let scoreData;
        try {
          scoreData = calculateScore(bracketData, tournamentData, scoringSettings);
        } catch (scoreErr) {
          scoreData = { 
            points: 0, 
            basePoints: 0, 
            bonusPoints: 0, 
            correctPicks: 0,
            roundBreakdown: {} 
          };
        }

        return {
          id: playerId,
          name: userName,
          ...scoreData,
          lastUpdated: bracketData.updatedAt ? new Date(bracketData.updatedAt) : null,
          isCurrentUser: playerId === auth.currentUser?.uid
        };
      } catch (playerErr) {
        return {
          id: bracketDoc.id,
          name: "Error Loading User",
          points: 0,
          basePoints: 0,
          bonusPoints: 0,
          correctPicks: 0,
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
      isCompleted: isCompleted,
      settings: scoringSettings
    };
  };

  const calculateScore = (userBracket, tournamentResults, scoringSettings = null) => {
    if (!userBracket || !tournamentResults) {
      return { 
        points: 0, 
        basePoints: 0, 
        bonusPoints: 0, 
        correctPicks: 0,
        roundBreakdown: {} 
      };
    }

    const roundPoints = {
      'RoundOf64': scoringSettings?.roundOf64 ?? defaultPoints.RoundOf64,
      'RoundOf32': scoringSettings?.roundOf32 ?? defaultPoints.RoundOf32,
      'Sweet16': scoringSettings?.sweet16 ?? defaultPoints.Sweet16,
      'Elite8': scoringSettings?.elite8 ?? defaultPoints.Elite8,
      'FinalFour': scoringSettings?.finalFour ?? defaultPoints.FinalFour,
      'Championship': scoringSettings?.championship ?? defaultPoints.Championship
    };

    const bonusEnabled = scoringSettings?.bonusEnabled ?? false;
    const bonusType = scoringSettings?.bonusType ?? 'seedDifference';
    const bonusPerSeedDifference = scoringSettings?.bonusPerSeedDifference ?? 0.5;
    const flatBonusValue = scoringSettings?.flatBonusValue ?? 0.5;

    let points = 0;
    let correctPicks = 0;
    let bonusPoints = 0;
    let roundBreakdown = {};

    Object.entries(roundPoints).forEach(([round, pointValue]) => {
      roundBreakdown[round] = { base: 0, bonus: 0, total: 0, correct: 0, possible: 0 };

      if (tournamentResults[round] && userBracket[round]) {
        if (round === 'Championship') {
          if (typeof tournamentResults[round] === 'object' && typeof userBracket[round] === 'object') {
            const officialWinner = tournamentResults.Championship?.winner || '';
            const officialWinnerSeed = tournamentResults.Championship?.winnerSeed || null;
            const officialTeam1Seed = tournamentResults.Championship?.team1Seed || null;
            const officialTeam2Seed = tournamentResults.Championship?.team2Seed || null;
            const userPick = userBracket.Championship?.winner || '';

            roundBreakdown[round].possible = pointValue;

            if (officialWinner && userPick && officialWinner === userPick) {
              const basePoints = pointValue;
              roundBreakdown[round].base = basePoints;
              roundBreakdown[round].correct = 1;
              points += basePoints;
              correctPicks += 1;

              if (bonusEnabled && officialWinnerSeed && officialTeam1Seed && officialTeam2Seed) {
                const expectedWinnerSeed = Math.min(officialTeam1Seed, officialTeam2Seed);
                if (officialWinnerSeed > expectedWinnerSeed) {
                  let roundBonus = bonusType === 'seedDifference' ? 
                    (officialWinnerSeed - expectedWinnerSeed) * bonusPerSeedDifference : 
                    flatBonusValue;
                  bonusPoints += roundBonus;
                  roundBreakdown[round].bonus = roundBonus;
                  roundBreakdown[round].total = basePoints + roundBonus;
                } else {
                  roundBreakdown[round].total = basePoints;
                }
              } else {
                roundBreakdown[round].total = basePoints;
              }
            }
          }
        } else if (Array.isArray(tournamentResults[round]) && Array.isArray(userBracket[round])) {
          tournamentResults[round].forEach((officialMatchup, idx) => {
            if (!officialMatchup || !userBracket[round][idx]) return;

            roundBreakdown[round].possible += pointValue;

            try {
              const officialWinner = officialMatchup.winner || '';
              const officialWinnerSeed = officialMatchup.winnerSeed || null;
              const officialTeam1Seed = officialMatchup.team1Seed || null;
              const officialTeam2Seed = officialMatchup.team2Seed || null;
              const userPick = userBracket[round][idx].winner || '';

              if (officialWinner && userPick && officialWinner === userPick) {
                const basePoints = pointValue;
                roundBreakdown[round].base += basePoints;
                roundBreakdown[round].correct += 1;
                points += basePoints;
                correctPicks += 1;

                if (bonusEnabled && officialWinnerSeed && officialTeam1Seed && officialTeam2Seed) {
                  const expectedWinnerSeed = Math.min(officialTeam1Seed, officialTeam2Seed);
                  if (officialWinnerSeed > expectedWinnerSeed) {
                    let matchupBonus = bonusType === 'seedDifference' ? 
                      (officialWinnerSeed - expectedWinnerSeed) * bonusPerSeedDifference : 
                      flatBonusValue;
                    bonusPoints += matchupBonus;
                    roundBreakdown[round].bonus += matchupBonus;
                  }
                }
              }
            } catch (matchupErr) {}
          });
          roundBreakdown[round].total = roundBreakdown[round].base + roundBreakdown[round].bonus;
        }
      }
    });

    const totalPoints = points + bonusPoints;
    return { points: totalPoints, basePoints: points, bonusPoints, correctPicks, roundBreakdown };
  };

  const getVisiblePlayers = (players, fogOfWarEnabled, tournamentCompleted, isAdmin, userId) => {
    console.log("getVisiblePlayers - Inputs: fogOfWarEnabled:", fogOfWarEnabled, "tournamentCompleted:", tournamentCompleted, "isAdmin:", isAdmin, "userId:", userId, "Players:", players);
    if (!fogOfWarEnabled || tournamentCompleted) {
      console.log("getVisiblePlayers - Returning all players:", players);
      return players;
    }
    const visiblePlayers = players.filter(player => player.isCurrentUser).map(player => ({
      ...player,
      rank: players.findIndex(p => p.id === player.id) + 1
    }));
    console.log("getVisiblePlayers - Filtered (Fog of War):", visiblePlayers);
    return visiblePlayers;
  };

  const handleViewBracket = (bracketId, isEmbed, nav, league) => {
    if (isEmbed && onViewBracket) return onViewBracket(bracketId);
    nav(`/league/${league}/view?userId=${bracketId}`);
    return false;
  };

  const handleViewTournament = (isEmbed, nav, league) => {
    if (isEmbed && onViewBracket) return onViewBracket('tournament');
    nav(`/league/${league}/view`);
    return false;
  };

  const renderMarchMadnessHeaders = (scoringSettings) => (
    <>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Player</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
      {scoringSettings?.bonusEnabled && (
        <th className="hidden sm:table-cell py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bonus</th>
      )}
      <th className="hidden sm:table-cell py-3 px-4 bg-gray-50 dark:bg-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correct Picks</th>
      <th className="py-3 px-4 bg-gray-50 dark:bg-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
    </>
  );

  const renderMarchMadnessRow = (player, index, handleShowDetails, onViewEntry, scoringSettings) => {
    const displayRank = player.rank || (index + 1);
    const isTopThree = displayRank <= 3;
    const userId = auth.currentUser?.uid;

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
              {scoringSettings?.bonusEnabled && player.bonusPoints > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full mr-2">
                  +{parseFloat(player.bonusPoints).toFixed(1)} bonus
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {player.correctPicks} correct
              </span>
            </div>
          </div>
        </td>
        <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-gray-900 dark:text-gray-200">
          {parseFloat(player.points).toFixed(1)}
        </td>
        {scoringSettings?.bonusEnabled && (
          <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-green-600 dark:text-green-400">
            +{parseFloat(player.bonusPoints).toFixed(1)}
          </td>
        )}
        <td className="hidden sm:table-cell py-3 px-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">
          {player.correctPicks}
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

  const renderFogOfWarBanner = (isAdmin) => (
    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/30 dark:border-yellow-800">
      <div className="flex items-center">
        <FaEyeSlash className="text-yellow-600 dark:text-yellow-500 mr-3 text-xl flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-400">Fog of War Mode Active</h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            The league administrator has enabled Fog of War mode. You can only see your own position on the leaderboard 
            until the tournament is completed.
          </p>
        </div>
      </div>
    </div>
  );

  const renderTournamentInfo = (leagueData, tournamentData, scoringSettings) => {
    const getTournamentStatus = () => {
      if (!tournamentData) return 'Not Started';
      if (tournamentData.Champion) return 'Completed';
      if (tournamentData.RoundOf64 && Array.isArray(tournamentData.RoundOf64) && 
          tournamentData.RoundOf64.some(match => match && match.winner)) return 'In Progress';
      return 'Not Started';
    };

    const getScoringInfoText = () => {
      if (!scoringSettings) return "Standard point system: R64: 1 pt, R32: 2pts, S16: 4pts, E8: 8pts, F4: 16pts, Champ: 32pts";
      let text = `Points: R64: ${scoringSettings.roundOf64}pt, R32: ${scoringSettings.roundOf32}pts, `;
      text += `S16: ${scoringSettings.sweet16}pts, E8: ${scoringSettings.elite8}pts, `;
      text += `F4: ${scoringSettings.finalFour}pts, Champ: ${scoringSettings.championship}pts`;
      if (scoringSettings.bonusEnabled) {
        text += `, Upset bonus: ${scoringSettings.bonusType === 'seedDifference' ? 
          `${scoringSettings.bonusPerSeedDifference} per seed difference` : 
          `Flat ${scoringSettings.flatBonusValue} points per upset`}`;
      }
      return text;
    };

    return (
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-200">{leagueData?.title || 'March Madness Tournament'}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Status: {getTournamentStatus()}</p>
          </div>
          <div className="mt-2 md:mt-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{getScoringInfoText()}</p>
          </div>
        </div>
      </div>
    );
  };

  // Updated to use the new LeaderboardDetails component
  const renderScoreDetails = (player, scoringSettings, allPlayers = [], referenceData = {}) => {
    return (
      <LeaderboardDetails 
        player={player} 
        scoringSettings={scoringSettings} 
        allPlayers={allPlayers} 
        referenceData={referenceData} 
      />
    );
  };

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
      renderTableHeaders={renderMarchMadnessHeaders}
      renderTableRow={renderMarchMadnessRow}
      renderDetailsModal={renderScoreDetails}
      renderStatusInfo={renderTournamentInfo}
      renderFogOfWarBanner={renderFogOfWarBanner}
      primaryEntryName="Tournament"
      customClasses={darkModeClasses}
      fogOfWarEnabled={fogOfWarEnabled} // Pass explicitly
      tournamentCompleted={tournamentCompleted} // Pass explicitly
    />
  );
};

export default Leaderboard;