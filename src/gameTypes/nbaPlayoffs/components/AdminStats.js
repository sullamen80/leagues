// src/gameTypes/nbaPlayoffs/components/AdminStats.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaExclamationTriangle, FaCheck, FaArrowUp, FaInfoCircle, FaTimes, FaChevronDown, FaEye } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import EndLeagueStats from '../services/EndLeagueStatsService';
import { calculateLeagueScores } from '../services/scoringService';
import { getPointValue } from '../services/scoringService';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';
import { Disclosure } from '@headlessui/react';
import { formatNumber } from '../../../utils/formatters';

// Format percentage for display
const formatPercentage = (value) => {
  if (value === undefined || value === null) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
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

/**
 * Enhanced component for managing NBA Playoffs statistics with preview functionality
 * Allows admins to view, preview, and update playoff statistics
 */
const AdminStats = ({ leagueId: propLeagueId, gameData: propGameData }) => {
  // Get the leagueId from route params if not provided as a prop
  const { leagueId: urlLeagueId } = useParams();
  const leagueId = propLeagueId || urlLeagueId;
  
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
            const scores = await calculateLeagueScores(leagueId, scoringSettings);
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
      // Create a new stats collector but don't save anything
      const statsCollector = new EndLeagueStats(leagueId);
      
      // Generate preview data with all detailed stats
      const previewStats = await statsCollector.generateStatsPreview(gameData);
      
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
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Create a new stats collector
      const statsCollector = new EndLeagueStats(leagueId);
      
      // Pass preview data to ensure all calculated stats are saved
      const result = await statsCollector.captureStats(gameData, null, previewData);
      
      if (result && result.success) {
        setSuccess(true);
        setShowPreview(false); // Hide preview after successful update
      } else {
        throw new Error((result && result.error) || "Failed to save stats");
      }
      
    } catch (err) {
      console.error("Error updating stats:", err);
      setError(`Error updating stats: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get tournament status from game data
   */
  const getTournamentStatus = () => {
    if (!gameData) return 'Not Started';
    if (gameData[ROUND_KEYS.CHAMPION] || gameData?.[ROUND_KEYS.NBA_FINALS]?.winner) return 'Completed';
    
    // Check first round for any completed matches
    const firstRoundData = gameData[ROUND_KEYS.FIRST_ROUND];
    if (Array.isArray(firstRoundData) && firstRoundData.some(match => match && match.winner)) {
      return 'In Progress';
    }
    
    return 'Not Started';
  };

  // If no leagueId is provided, show a message
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
      {/* Top navigation with back button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">NBA Playoffs Stats Manager</h2>
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
              {leagueInfo?.title || 'NBA Playoffs'}
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
              NBA Playoffs Statistics Management
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
          updateLoading={loading}
          disableButtons={!gameData}
        />
      </div>
      
      {/* Stats Info (always show when not in preview mode) */}
      {!showPreview && (
        <div className="text-sm bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Statistics Summary</h3>
          <p><strong>League:</strong> {leagueInfo?.title || leagueId}</p>
          <p><strong>Players:</strong> {userScores?.length || 0}</p>
          <p><strong>Status:</strong> {getTournamentStatus()}</p>
          <p><strong>Champion:</strong> {gameData?.[ROUND_KEYS.CHAMPION] || gameData?.[ROUND_KEYS.NBA_FINALS]?.winner || 'Not determined'}</p>
          <p><strong>Finals MVP:</strong> {gameData?.[ROUND_KEYS.FINALS_MVP] || 'Not determined'}</p>
          
          {userScores && userScores.length > 0 && (
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
                <p><strong>Finals MVP:</strong> {previewData.finalsMVP || "Not determined"}</p>
                <p><strong>Generated:</strong> {previewData.generatedAt ? new Date(previewData.generatedAt).toLocaleString() : "Unknown"}</p>
                <p className="font-medium text-blue-800"><strong>Overall Accuracy:</strong> {formatPercentage(previewData.cumulativeStats?.correctPercentage)}</p>
              </div>
              <div>
                <p><strong>Average Score:</strong> {formatNumber((previewData.avgScore || 0).toFixed(1))}</p>
                <p><strong>Highest Score:</strong> {formatNumber(previewData.highestScore || 0)}</p>
                <p><strong>Lowest Score:</strong> {formatNumber(previewData.lowestScore || 0)}</p>
                <p><strong>Median Score:</strong> {formatNumber(previewData.medianScore || 0)}</p>
              </div>
            </div>
            
            {/* Overall accuracy visualization */}
            {previewData.cumulativeStats && (
              <div className="mt-4">
                <p className="font-medium mb-1">Overall Bracket Accuracy</p>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-blue-600 h-4 rounded-full" 
                    style={{ width: `${((previewData.cumulativeStats.correctPercentage || 0) * 100)}%` }}
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
            )}
          </div>

          {/* Point Distribution */}
          {previewData.pointDistribution && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Point Distribution Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 border rounded-lg">
                  <p className="text-lg font-medium text-center mb-2">Base Points</p>
                  <p className="text-3xl text-center text-blue-600">{formatNumber(previewData.pointDistribution.base?.points || 0)}</p>
                  <p className="text-center text-gray-600 text-sm">
                    {formatPercentage(previewData.pointDistribution.base?.percentage)} of total
                  </p>
                </div>
                
                <div className="bg-white p-3 border rounded-lg">
                  <p className="text-lg font-medium text-center mb-2">Series Length Bonus</p>
                  <p className="text-3xl text-center text-green-600">{formatNumber(previewData.pointDistribution.seriesLength?.points || 0)}</p>
                  <p className="text-center text-gray-600 text-sm">
                    {formatPercentage(previewData.pointDistribution.seriesLength?.percentage)} of total
                  </p>
                </div>
                
                <div className="bg-white p-3 border rounded-lg">
                  <p className="text-lg font-medium text-center mb-2">Upset & MVP Bonus</p>
                  <p className="text-3xl text-center text-purple-600">
                    {formatNumber(
                      (previewData.pointDistribution.upset?.points || 0) + 
                      (previewData.pointDistribution.mvp?.points || 0)
                    )}
                  </p>
                  <p className="text-center text-gray-600 text-sm">
                    {formatPercentage(
                      (previewData.pointDistribution.upset?.percentage || 0) + 
                      (previewData.pointDistribution.mvp?.percentage || 0)
                    )} of total
                  </p>
                </div>
              </div>
            </div>
          )}
          
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
          
          {/* Round Stats */}
          {previewData.roundStats && Object.keys(previewData.roundStats).length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Round Statistics</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">Round</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Correct Picks</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Total Possible</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Pick Accuracy</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Avg Points/Player</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Series Length Correct</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Upset Bonuses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(previewData.roundStats).map(([round, stats]) => (
                      <tr key={round}>
                        <td className="px-4 py-2 border">{ROUND_DISPLAY_NAMES[round] || round}</td>
                        <td className="px-4 py-2 text-center border">{stats.totalCorrectPicks || 0}</td>
                        <td className="px-4 py-2 text-center border">{((stats.totalPossiblePicks || 0) * (previewData.playerCount || 0))}</td>
                        <td className="px-4 py-2 text-center border">{formatPercentage(stats.correctPickPercentage)}</td>
                        <td className="px-4 py-2 text-center border">{((stats.avgPointsPerPlayer || 0)).toFixed(1)}</td>
                        <td className="px-4 py-2 text-center border">
                          {round === ROUND_KEYS.PLAY_IN ? '-' : (stats.seriesLengthCorrect || 0)}
                        </td>
                        <td className="px-4 py-2 text-center border">
                          {round === ROUND_KEYS.PLAY_IN ? '-' : (stats.upsetCount || 0)}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Finals MVP Stats */}
                    {previewData.mvpStats && (
                      <tr>
                        <td className="px-4 py-2 border">Finals MVP</td>
                        <td className="px-4 py-2 text-center border">{previewData.mvpStats.totalCorrectPicks || 0}</td>
                        <td className="px-4 py-2 text-center border">{previewData.playerCount || 0}</td>
                        <td className="px-4 py-2 text-center border">{formatPercentage(previewData.mvpStats.correctPercentage)}</td>
                        <td className="px-4 py-2 text-center border">-</td>
                        <td className="px-4 py-2 text-center border">-</td>
                        <td className="px-4 py-2 text-center border">-</td>
                      </tr>
                    )}
                    
                    {/* Cumulative Stats */}
                    {previewData.cumulativeStats && (
                      <tr className="bg-gray-100 font-medium">
                        <td className="px-4 py-2 border">TOTAL (ALL ROUNDS)</td>
                        <td className="px-4 py-2 text-center border">{previewData.cumulativeStats.totalCorrectPicks || 0}</td>
                        <td className="px-4 py-2 text-center border">{previewData.cumulativeStats.totalPossiblePicks || 0}</td>
                        <td className="px-4 py-2 text-center border">{formatPercentage(previewData.cumulativeStats.correctPercentage)}</td>
                        <td className="px-4 py-2 text-center border">-</td>
                        <td className="px-4 py-2 text-center border">-</td>
                        <td className="px-4 py-2 text-center border">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MVP Most Common Picks */}
          {previewData.mvpStats?.mostCommonPicks && previewData.mvpStats.mostCommonPicks.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Most Common Finals MVP Picks</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {previewData.mvpStats.mostCommonPicks.map((pick, index) => (
                  <div key={index} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <p className="font-medium">{pick.player || "Unknown"}</p>
                    <p className="text-sm text-gray-600">{pick.count || 0} picks ({formatPercentage(pick.percentage)})</p>
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
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Total Score</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Base</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Series Bonus</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">Upset</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border">MVP</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Correct Picks</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Accuracy %</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border">Champion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.playerScores.map((player, index) => {
                      // Safely calculate pick accuracy percentage
                      const correctPickPercentage = 
                        player.correctPickPercentage || 
                        (previewData.cumulativeStats && 
                         previewData.playerCount && 
                         previewData.cumulativeStats.totalPossiblePicks ?
                          player.correctPicks / (previewData.cumulativeStats.totalPossiblePicks / previewData.playerCount) : 0);
                      
                      return (
                        <tr key={player.userId || index} className={index < 3 ? "bg-blue-50" : ""}>
                          <td className="px-3 py-2 whitespace-nowrap border">{index + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap border">{player.userName || "Unknown"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-right border">{formatNumber(player.score || 0)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right border">{formatNumber(player.basePoints || 0)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right border">{formatNumber(player.seriesLengthPoints || 0)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right border">{formatNumber(player.upsetPoints || 0)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right border">{formatNumber(player.finalsMVPPoints || 0)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-center border">{player.correctPicks || 0}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-center border">{formatPercentage(correctPickPercentage)}</td>
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
          
          {/* Player Details (Expandable) */}
          {previewData.playerScores && previewData.playerScores.length > 0 && (
            <div className="mb-6">
              <Disclosure>
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none focus-visible:ring focus-visible:ring-blue-500">
                      <span>Detailed Player Round Breakdown</span>
                      <FaChevronDown
                        className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`}
                      />
                    </Disclosure.Button>
                    <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {previewData.playerScores.slice(0, 5).map((player, playerIndex) => (
                          <div key={`${player.userId || playerIndex}-breakdown`} className="border rounded-lg p-3">
                            <h5 className="font-semibold mb-2">{player.userName || "Unknown"}</h5>
                            <div className="mb-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                Overall Accuracy: {formatPercentage(player.correctPickPercentage)}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {player.roundBreakdown && Object.entries(player.roundBreakdown).map(([round, data]) => {
                                // Safely calculate round percentage
                                const roundPossiblePicks = previewData.scoringSettings ? 
                                  (data.possiblePoints ? data.possiblePoints / getPointValue(round, previewData.scoringSettings) : 0) : 0;
                                const roundPercentage = roundPossiblePicks > 0 ? (data.correctPicks || 0) / roundPossiblePicks : 0;
                                
                                return (
                                  <div key={round} className="bg-gray-50 p-2 rounded">
                                    <p className="font-medium">{ROUND_DISPLAY_NAMES[round] || round}</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <p><span className="text-gray-600">Base Points:</span> {data.basePoints || 0}</p>
                                      <p><span className="text-gray-600">Correct Picks:</span> {data.correctPicks || 0}</p>
                                      <p><span className="text-gray-600">Accuracy:</span> {formatPercentage(roundPercentage)}</p>
                                      {(data.seriesLengthPoints || 0) > 0 && (
                                        <p><span className="text-gray-600">Series Bonus:</span> {data.seriesLengthPoints}</p>
                                      )}
                                      {(data.upsetPoints || 0) > 0 && (
                                        <p><span className="text-gray-600">Upset Bonus:</span> {data.upsetPoints}</p>
                                      )}
                                      <p><span className="text-gray-600">Total Points:</span> {data.totalPoints || 0}</p>
                                      {(data.possiblePoints || 0) > 0 && (
                                        <p><span className="text-gray-600">Possible Points:</span> {data.possiblePoints}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {(previewData.playerScores.length || 0) > 5 && (
                          <p className="text-center text-gray-500 italic col-span-2">
                            Showing top 5 players. Total players: {previewData.playerScores.length}
                          </p>
                        )}
                      </div>
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            </div>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h6 className="font-medium mb-2">Round Points</h6>
                          <table className="min-w-full border">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 border">Round</th>
                                <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 border">Points</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {Object.entries(previewData.scoringSettings || {}).map(([key, value]) => {
                                // Only show round point values
                                if (ROUND_DISPLAY_NAMES[key] && !key.includes('BONUS') && !key.includes('ENABLED')) {
                                  return (
                                    <tr key={key}>
                                      <td className="px-3 py-1 text-left border">{ROUND_DISPLAY_NAMES[key] || key}</td>
                                      <td className="px-3 py-1 text-right border">{value}</td>
                                    </tr>
                                  );
                                }
                                return null;
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <h6 className="font-medium mb-2">Bonus Settings</h6>
                          <table className="min-w-full border">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 border">Bonus Type</th>
                                <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 border">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {Object.entries(previewData.scoringSettings || {}).map(([key, value]) => {
                                // Only show bonus settings
                                if (key.includes('BONUS') || key.includes('ENABLED')) {
                                  return (
                                    <tr key={key}>
                                      <td className="px-3 py-1 text-left border">{key}</td>
                                      <td className="px-3 py-1 text-right border">
                                        {typeof value === 'boolean' ? 
                                          (value ? 'Enabled' : 'Disabled') : 
                                          value}
                                      </td>
                                    </tr>
                                  );
                                }
                                return null;
                              })}
                            </tbody>
                          </table>
                        </div>
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
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
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

export default AdminStats;