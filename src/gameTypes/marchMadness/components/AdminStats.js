// src/gameTypes/marchMadness/components/AdminStats.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaExclamationTriangle, FaCheck, FaArrowUp, FaInfoCircle, FaTimes, FaChevronDown, FaEye, FaTrophy } from 'react-icons/fa';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { calculateLeagueScores, POINT_VALUES } from '../services/scoringService';
import EndLeagueStats from '../services/EndLeagueStatsService';
import { Disclosure } from '@headlessui/react';
import { formatNumber, classNames } from '../../../utils/formatters';

// Bracket round display names
const ROUND_DISPLAY_NAMES = {
  RoundOf64: 'Round of 64',
  RoundOf32: 'Round of 32',
  Sweet16: 'Sweet 16',
  Elite8: 'Elite 8',
  FinalFour: 'Final Four',
  Championship: 'Championship'
};

// Total games per round for accuracy calculations
const TOTAL_GAMES_BY_ROUND = {
  RoundOf64: 32,
  RoundOf32: 16,
  Sweet16: 8,
  Elite8: 4,
  FinalFour: 2,
  Championship: 1
};

// Format percentage for display
const formatPercentage = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  return `${(Number(value) * 100).toFixed(1)}%`;
};

// Component for showing error messages
const ErrorMessage = ({ message }) => (
  <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-md text-red-800 flex items-start">
    <FaExclamationTriangle className="text-red-500 mr-2 mt-1 flex-shrink-0" />
    <p>{message}</p>
  </div>
);

// Component for showing success messages
const SuccessMessage = ({ message }) => (
  <div className="mb-4 p-3 bg-green-100 border border-green-200 rounded-md text-green-800 flex items-start">
    <FaCheck className="text-green-500 mr-2 mt-1 flex-shrink-0" />
    <p>{message}</p>
  </div>
);

// Component for action buttons
const ActionButtons = ({ onPreview, onUpdate, previewLoading, updateLoading, disableButtons }) => (
  <div className="flex flex-wrap gap-3">
    <button 
      onClick={onPreview}
      disabled={previewLoading || disableButtons}
      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {previewLoading ? (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
          Generating Preview...
        </>
      ) : (
        <>
          <FaEye className="mr-2" /> Preview Stats
        </>
      )}
    </button>
    
    <button 
      onClick={onUpdate}
      disabled={updateLoading || disableButtons}
      className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {updateLoading ? (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
          Updating Stats...
        </>
      ) : (
        <>
          <FaArrowUp className="mr-2" /> Update Statistics
        </>
      )}
    </button>
  </div>
);

// Component for player breakdown accordion
const PlayerBreakdownAccordion = ({ players, gameData }) => {
  // Determine completed rounds
  const completedRounds = gameData
    ? Object.keys(gameData)
        .filter((key) => ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'].includes(key))
        .filter((round) => {
          if (round === 'Championship') return gameData[round]?.winner;
          return Array.isArray(gameData[round]) && gameData[round].some((match) => match && match.winner);
        })
    : [];

  // Helper function to get round stats
  const getRoundStats = (roundBreakdown, roundKey) => {
    const data = roundBreakdown?.[roundKey] || { correct: 0, base: 0, bonus: 0, total: 0 };
    const totalGames = TOTAL_GAMES_BY_ROUND[roundKey] || 1;
    const accuracy = totalGames > 0 ? ((data.correct / totalGames) * 100).toFixed(1) : '0.0';
    return {
      correct: data.correct,
      totalGames,
      accuracy,
      basePoints: data.base.toFixed(1),
      bonusPoints: data.bonus.toFixed(1),
      totalPoints: data.total.toFixed(1),
    };
  };

  return (
    <div className="mt-4">
      <h3 className="font-bold text-lg mb-2">Player Breakdowns</h3>
      {players.length === 0 ? (
        <p className="text-gray-600">No player data available.</p>
      ) : (
        <div className="space-y-2">
          {players.map((player, index) => (
            <Disclosure key={player.userId || player.id || index}>
              {({ open }) => (
                <>
                  <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-gray-900 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none">
                    <div className="flex items-center">
                      <span className="mr-2 font-semibold">{index + 1}.</span>
                      <span>{player.userName || player.name || 'Unknown'}</span>
                      <span className="ml-2 text-gray-600">({formatNumber(player.score || player.points)} pts)</span>
                    </div>
                    <FaChevronDown className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-gray-500`} />
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-gray-700">
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">Round</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Correct Picks</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Accuracy</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Base Points</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Bonus Points</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Total Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Object.keys(ROUND_DISPLAY_NAMES).map((roundKey) => {
                            const { correct, totalGames, accuracy, basePoints, bonusPoints, totalPoints } = getRoundStats(
                              player.roundBreakdown,
                              roundKey
                            );
                            const isCompleted = completedRounds.includes(roundKey);
                            return (
                              <tr
                                key={roundKey}
                                className={`
                                  ${totalPoints > 0 ? 'bg-green-50' : ''}
                                  ${isCompleted ? '' : 'opacity-75'}
                                `}
                              >
                                <td className="px-3 py-2 text-left border">
                                  {ROUND_DISPLAY_NAMES[roundKey]}
                                  {!isCompleted && <span className="ml-1 text-gray-600 text-xs">(Pending)</span>}
                                </td>
                                <td className="px-3 py-2 text-center border">
                                  {correct}/{totalGames}
                                </td>
                                <td className="px-3 py-2 text-center border">{accuracy}%</td>
                                <td className="px-3 py-2 text-right border">{basePoints}</td>
                                <td className="px-3 py-2 text-right border">{bonusPoints > 0 ? `+${bonusPoints}` : '—'}</td>
                                <td className="px-3 py-2 text-right font-bold border">{totalPoints}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-100 font-bold">
                            <td className="px-3 py-2 text-left border">Total</td>
                            <td className="px-3 py-2 text-center border">{player.correctPicks || 0}/63</td>
                            <td className="px-3 py-2 text-center border">{formatPercentage((player.correctPicks || 0) / 63)}</td>
                            <td className="px-3 py-2 text-right border">{formatNumber(player.basePoints || 0)}</td>
                            <td className="px-3 py-2 text-right border">
                              {player.bonusPoints > 0 ? `+${formatNumber(player.bonusPoints)}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right border">{formatNumber(player.score || player.points)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Disclosure.Panel>
                </>
              )}
            </Disclosure>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Component for managing March Madness tournament statistics with preview functionality
 * Allows admins to view, preview, and update tournament statistics
 * 
 * @param {Object} props - Component props
 * @param {string} props.leagueId - League ID (optional, can be taken from URL params)
 * @param {Object} props.gameData - Tournament game data (optional, will be fetched if not provided)
 * @param {Object} props.urlParams - URL parameters for integration with MarchMadnessModule
 * @param {boolean} props.isEmbedded - Whether component is embedded in another view
 * @param {Function} props.onComplete - Callback when statistics are successfully updated
 * @param {Function} props.onNavigate - Navigation function for when using within module
 */
const MarchMadnessAdminStats = ({ 
  leagueId: propLeagueId, 
  gameData: propGameData,
  urlParams,
  isEmbedded = false,
  onComplete,
  onNavigate
}) => {
  // Get the leagueId from route params if not provided as a prop
  const { leagueId: urlLeagueId } = useParams();
  const navigate = useNavigate();
  const leagueId = propLeagueId || urlLeagueId || urlParams?.leagueId;
  
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState(null);
  const [gameData, setGameData] = useState(propGameData);
  const [userScores, setUserScores] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState(null);
  
  // State for preview functionality
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Load settings and game data
  useEffect(() => {
    const loadData = async () => {
      if (!leagueId) {
        setError("No league ID provided");
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Load league info
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        if (leagueSnap.exists()) {
          setLeagueInfo(leagueSnap.data());
        }
        
        // Load scoring settings
        const settingsRef = doc(db, "leagues", leagueId, "settings", "scoring");
        const settingsSnap = await getDoc(settingsRef);
        
        const scoringSettings = settingsSnap.exists() ? settingsSnap.data() : null;
        setSettings(scoringSettings);
        
        // Load game data if not provided in props
        let currentGameData = gameData;
        if (!currentGameData) {
          const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
          const gameDataSnap = await getDoc(gameDataRef);
          if (gameDataSnap.exists()) {
            currentGameData = gameDataSnap.data();
            setGameData(currentGameData);
          }
        }
        
        // Calculate scores
        if (currentGameData) {
          try {
            const scores = await calculateLeagueScores(leagueId);
            setUserScores(scores || []);
          } catch (scoresError) {
            console.error("Error calculating scores:", scoresError);
          }
        }
        
      } catch (err) {
        console.error("Error loading data:", err);
        setError(`Error loading data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [leagueId, gameData]);

  /**
   * Generate preview of stats to be saved
   */
  const handlePreviewStats = async () => {
    if (!leagueId) {
      setError("No league ID provided. Cannot generate preview.");
      return;
    }
    
    if (!gameData) {
      setError("Game data is not available. Cannot generate preview.");
      return;
    }
    
    setPreviewLoading(true);
    setError(null);
    
    try {
      const statsCollector = new EndLeagueStats(leagueId);
      const previewStats = await statsCollector.generateStatsPreview(gameData);
      console.log("Preview stats structure:", previewStats);
      setPreviewData(previewStats);
      setShowPreview(true);
    } catch (err) {
      console.error("Error generating preview:", err);
      setError(`Error generating preview: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * Handle updating stats in the database
   */
  const handleUpdateStats = async () => {
    if (!leagueId) {
      setError("No league ID provided. Cannot update stats.");
      return;
    }
    
    if (!gameData) {
      setError("Game data is not available. Cannot update stats.");
      return;
    }
    
    setUpdateLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const statsCollector = new EndLeagueStats(leagueId);
      const result = await statsCollector.captureStats(gameData, null, previewData);
      
      if (result && result.success) {
        setSuccess(true);
        setShowPreview(false);
        if (onComplete && typeof onComplete === 'function') {
          onComplete(result.data);
        }
      } else {
        throw new Error((result && result.error) || "Failed to save stats");
      }
      
    } catch (err) {
      console.error("Error updating stats:", err);
      setError(`Error updating stats: ${err.message}`);
    } finally {
      setUpdateLoading(false);
    }
  };

  // Navigation functions
  const handleNavigateToLeaderboard = () => {
    if (isEmbedded && onNavigate) {
      onNavigate('leaderboard');
    } else {
      navigate(`/league/${leagueId}/leaderboard`);
    }
  };

  // Function to handle completion of the tournament
  const handleCompleteTournament = async () => {
    if (!leagueId || !gameData || !gameData.Championship?.winner) {
      setError("Cannot complete tournament. No champion has been declared.");
      return;
    }
    
    setUpdateLoading(true);
    
    try {
      const statsCollector = new EndLeagueStats(leagueId);
      const statsResult = await statsCollector.captureStats(gameData);
      
      if (statsResult && statsResult.success) {
        const leagueRef = doc(db, "leagues", leagueId);
        await setDoc(leagueRef, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          champions: statsResult.data.winners || []
        }, { merge: true });
        
        setSuccess(true);
        
        if (onComplete && typeof onComplete === 'function') {
          onComplete(statsResult.data);
        }
        
        setTimeout(() => {
          if (window.confirm("Tournament completed successfully! View the final leaderboard?")) {
            handleNavigateToLeaderboard();
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error completing tournament:", err);
      setError(`Error completing tournament: ${err.message}`);
    } finally {
      setUpdateLoading(false);
    }
  };

  /**
   * Get tournament status from tournament data
   */
  const getTournamentStatus = () => {
    if (!gameData) return 'Not Started';
    if (gameData.Championship?.winner) return 'Completed';
    
    const firstRoundData = gameData.RoundOf64;
    if (Array.isArray(firstRoundData) && firstRoundData.some(match => match && match.winner)) {
      return 'In Progress';
    }
    
    return 'Not Started';
  };

  if (!leagueId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center p-4">
          <FaExclamationTriangle className="mx-auto h-12 w-12 text-yellow-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No League Selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Please select a league to manage its statistics.
          </p>
          <Link to="/admin/leagues" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Go to Leagues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Top navigation */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">March Madness Stats Manager</h2>
        <button 
          onClick={() => window.history.back()}
          className="px-3 py-1.5 bg-gray-200 rounded-md hover:bg-gray-300 text-gray-800 flex items-center text-sm"
        >
          ← Back to Admin Dashboard
        </button>
      </div>
      
      {/* Status Messages */}
      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message="League statistics were successfully updated." />}
      
      {/* Loading Indicator */}
      {loading && !error && (
        <div className="my-4 flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      )}
      
      {/* League Info */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg">
              {leagueInfo?.title || 'March Madness Tournament'}
            </h3>
            <p className="text-sm text-gray-600">
              Status: {getTournamentStatus()}
            </p>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="border rounded-lg p-4 bg-gray-50 mb-4">
        <div className="flex items-start mb-4">
          <FaInfoCircle className="text-blue-500 mt-1 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-700">
              March Madness Statistics Management
            </p>
            <p className="text-sm text-gray-600">
              Preview stats before saving or directly update the database.
            </p>
          </div>
        </div>
        
        <ActionButtons 
          onPreview={handlePreviewStats} 
          onUpdate={handleUpdateStats}
          previewLoading={previewLoading}
          updateLoading={updateLoading}
          disableButtons={!gameData}
        />
      </div>
      
      {/* Stats Info (non-preview mode) */}
      {!showPreview && (
        <div className="text-sm bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Statistics Summary</h3>
          <p><strong>League:</strong> {leagueInfo?.title || leagueId}</p>
          <p><strong>Players:</strong> {userScores?.length || 0}</p>
          <p><strong>Status:</strong> {getTournamentStatus()}</p>
          <p><strong>Champion:</strong> {gameData?.Championship?.winner || 'Not determined'}</p>
          
          {userScores && userScores.length > 0 && (
            <>
              <div className="mt-3">
                <h4 className="font-medium">Top Players:</h4>
                <ol className="list-decimal pl-5 mt-1">
                  {userScores.slice(0, 3).map(player => (
                    <li key={player.userId}>
                      {player.userName} - {player.score} pts
                    </li>
                  ))}
                </ol>
              </div>
              {userScores.some(player => player.roundBreakdown) && (
                <PlayerBreakdownAccordion players={userScores} gameData={gameData} />
              )}
            </>
          )}
        </div>
      )}
      
      {/* Stats Preview Section */}
      {showPreview && previewData && (
        <div className="mt-4 border rounded-lg p-4 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Statistics Preview</h3>
            <button 
              onClick={() => setShowPreview(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FaTimes />
            </button>
          </div>
          
          {/* League Summary */}
          <div className="mb-6 p-4 bg-blue-50 rounded-md">
            <h4 className="font-semibold mb-2">League Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p><strong>League:</strong> {leagueInfo?.title || leagueId}</p>
                <p><strong>Players:</strong> {previewData.playerCount || 0}</p>
                <p><strong>Status:</strong> {previewData.tournamentStatus || "Unknown"}</p>
                <p><strong>Season:</strong> {previewData.seasonId || "Unknown"}</p>
              </div>
              <div>
                <p><strong>Champion:</strong> {previewData.champion || "Not determined"}</p>
                <p><strong>Generated:</strong> {previewData.generatedAt ? new Date(previewData.generatedAt).toLocaleString() : "Unknown"}</p>
                <p className="font-medium text-blue-800">
                  <strong>Overall Accuracy:</strong> {formatPercentage(previewData.correctPickPercentage)}
                </p>
              </div>
              <div>
                <p><strong>Average Score:</strong> {formatNumber((previewData.avgScore || 0).toFixed(1))}</p>
                <p><strong>Highest Score:</strong> {formatNumber(previewData.highestScore || 0)}</p>
                <p><strong>Lowest Score:</strong> {formatNumber(previewData.lowestScore || 0)}</p>
                <p><strong>Median Score:</strong> {formatNumber(previewData.medianScore || 0)}</p>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="font-medium mb-1">Overall Bracket Accuracy</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-blue-600 h-4 rounded-full" 
                  style={{ width: `${((previewData.correctPickPercentage || 0) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          
          {/* Top Winners */}
          {previewData.topWinners && previewData.topWinners.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Top Winners</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {previewData.topWinners.map((winner, index) => (
                  <div key={winner.userId || index} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex items-center mb-2">
                      <div className="h-8 w-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full mr-2">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{winner.userName || "Unknown"}</p>
                        <p className="text-sm text-gray-600">{formatNumber(winner.score || 0)} points</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Player Scores Table */}
          {previewData.playerScores && previewData.playerScores.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Player Rankings</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">Rank</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">Player</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Score</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Correct Picks</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Percentile</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Champion Pick</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.playerScores.map((player, index) => {
                      const totalPlayers = previewData.playerScores.length;
                      const percentileValue = player.percentage || player.percentile || 
                                            (player.correctPickPercentage) || 
                                            (totalPlayers > 1 ? (totalPlayers - index - 1) / (totalPlayers - 1) : 1);
                      return (
                        <tr key={player.userId || index} className={index < 3 ? "bg-blue-50" : ""}>
                          <td className="px-3 py-2 whitespace-nowrap border">{index + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap border">{player.userName || "Unknown"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-right border">{formatNumber(player.score || 0)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-center border">{player.correctPicks || 0}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-center border">{formatPercentage(percentileValue)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-center border">
                            {player.championCorrect ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                <FaCheck className="mr-1" size={10} /> {player.championPick || "Unknown"}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-sm">{player.championPick || "Unknown"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Player Breakdown Accordion */}
          {previewData.playerScores && previewData.playerScores.length > 0 && (
            <PlayerBreakdownAccordion players={previewData.playerScores} gameData={gameData} />
          )}
          
          {/* Scoring Settings */}
          {previewData.scoringSettings && (
            <div className="mb-6">
              <Disclosure>
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-green-900 bg-green-100 rounded-lg hover:bg-green-200 focus:outline-none focus-visible:ring focus-visible:ring-green-500">
                      <span>Scoring Settings Used</span>
                      <FaChevronDown
                        className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-green-500`}
                      />
                    </Disclosure.Button>
                    <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-gray-700">
                      <div className="grid grid-cols-1 gap-6">
                        <table className="min-w-full border">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 border">Round</th>
                              <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 border">Points Per Correct Pick</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            <tr>
                              <td className="px-3 py-1 text-left border">Round of 64</td>
                              <td className="px-3 py-1 text-right border">{previewData.scoringSettings.roundOf64 || POINT_VALUES.RoundOf64}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-1 text-left border">Round of 32</td>
                              <td className="px-3 py-1 text-right border">{previewData.scoringSettings.roundOf32 || POINT_VALUES.RoundOf32}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-1 text-left border">Sweet 16</td>
                              <td className="px-3 py-1 text-right border">{previewData.scoringSettings.sweet16 || POINT_VALUES.Sweet16}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-1 text-left border">Elite 8</td>
                              <td className="px-3 py-1 text-right border">{previewData.scoringSettings.elite8 || POINT_VALUES.Elite8}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-1 text-left border">Final Four</td>
                              <td className="px-3 py-1 text-right border">{previewData.scoringSettings.finalFour || POINT_VALUES.FinalFour}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-1 text-left border">Championship</td>
                              <td className="px-3 py-1 text-right border">{previewData.scoringSettings.championship || POINT_VALUES.Championship}</td>
                            </tr>
                            {previewData.scoringSettings.bonusEnabled && (
                              <tr>
                                <td className="px-3 py-1 text-left border">Upset Bonus</td>
                                <td className="px-3 py-1 text-right border">
                                  {previewData.scoringSettings.bonusType === 'seedDifference' ? 
                                    `${previewData.scoringSettings.bonusPerSeedDifference} per seed difference` : 
                                    `${previewData.scoringSettings.flatBonusValue} flat bonus`}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            </div>
          )}
          
          {/* Confirmation and Back Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => setShowPreview(false)}
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-gray-800"
            >
              Back
            </button>
            
            <button
              onClick={handleUpdateStats}
              disabled={updateLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2 inline-block"></div>
                  Updating...
                </>
              ) : (
                'Confirm and Save Stats to Database'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarchMadnessAdminStats;