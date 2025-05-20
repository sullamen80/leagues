import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaTrophy, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Component for comparing how users picked a specific matchup
 */
const MatchupComparison = ({
  leagueId,
  roundKey,
  matchupIndex,
  matchup,
  isOpen,
  onClose,
  entries,
  userBracketId,
  officialData,
}) => {
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load comparison data when modal is opened
  useEffect(() => {
    const loadComparisonData = async () => {
      if (!isOpen || !leagueId || !roundKey || matchupIndex === undefined) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Get all user brackets and compare their picks for this matchup
        const results = {
          team1: {
            name: matchup.team1,
            seed: matchup.team1Seed,
            count: 0,
            percent: 0,
            users: [],
          },
          team2: {
            name: matchup.team2,
            seed: matchup.team2Seed,
            count: 0,
            percent: 0,
            users: [],
          },
          undecided: {
            count: 0,
            percent: 0,
            users: [],
          },
          totalUsers: 0,
          officialWinner: officialData?.[roundKey]?.[matchupIndex]?.winner || null,
        };
        
        const userDataPromises = entries
          .filter(entry => entry.id !== 'tournament' && entry.hasData)
          .map(async (entry) => {
            try {
              const bracketRef = doc(db, "leagues", leagueId, "userData", entry.id);
              const bracketSnap = await getDoc(bracketRef);
              
              if (bracketSnap.exists()) {
                const data = bracketSnap.data();
                
                // Special handling for Play-In Tournament data
                let userPick = null;
                if (roundKey.startsWith('PlayIn-')) {
                  // Extract conference and game type from the synthetic roundKey
                  const [_, confLower, gameType] = roundKey.split('-');
                  
                  // Map to the corresponding winner key
                  const winnerKeyMap = {
                    'seventhEighthGame': 'seventhEighthWinner',
                    'ninthTenthGame': 'ninthTenthWinner',
                    'finalPlayInGame': 'finalWinner'
                  };
                  
                  // Get the user's pick for this Play-In game
                  userPick = data?.[ROUND_KEYS.PLAY_IN]?.[confLower]?.[winnerKeyMap[gameType]]?.team;
                } else {
                  // Standard bracket format
                  userPick = data?.[roundKey]?.[matchupIndex]?.winner;
                }
                
                if (userPick === matchup.team1) {
                  results.team1.count++;
                  results.team1.users.push({
                    id: entry.id,
                    name: entry.name,
                    isCurrentUser: entry.id === userBracketId,
                  });
                } else if (userPick === matchup.team2) {
                  results.team2.count++;
                  results.team2.users.push({
                    id: entry.id,
                    name: entry.name,
                    isCurrentUser: entry.id === userBracketId,
                  });
                } else {
                  results.undecided.count++;
                  results.undecided.users.push({
                    id: entry.id,
                    name: entry.name,
                    isCurrentUser: entry.id === userBracketId,
                  });
                }
                return data;
              }
              return null;
            } catch (err) {
              console.error(`Error fetching data for user ${entry.id}:`, err);
              return null;
            }
          });
        
        await Promise.all(userDataPromises);
        
        // Calculate percentages
        results.totalUsers = results.team1.count + results.team2.count + results.undecided.count;
        if (results.totalUsers > 0) {
          results.team1.percent = Math.round((results.team1.count / results.totalUsers) * 100);
          results.team2.percent = Math.round((results.team2.count / results.totalUsers) * 100);
          results.undecided.percent = Math.round((results.undecided.count / results.totalUsers) * 100);
        }
        
        setComparisonData(results);
      } catch (err) {
        console.error("Error loading comparison data:", err);
        setError("Failed to load comparison data.");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadComparisonData();
  }, [isOpen, leagueId, roundKey, matchupIndex, matchup, entries, userBracketId, officialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            Matchup Comparison
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
              <p className="text-gray-600 text-sm">Loading comparison data...</p>
            </div>
          ) : error ? (
            <div className="text-red-500 p-4">{error}</div>
          ) : comparisonData ? (
            <div>
              <div className="mb-4">
                <h4 className="text-lg font-semibold mb-2">
                  {matchup.team1} ({matchup.team1Seed}) vs {matchup.team2} ({matchup.team2Seed})
                </h4>
                
                {comparisonData.officialWinner && (
                  <div className="flex items-center mb-3 text-green-600">
                    <FaTrophy className="mr-2" />
                    <span>Official Winner: {comparisonData.officialWinner}</span>
                  </div>
                )}
                
                <div className="text-sm text-gray-500 mb-4">
                  Total brackets: {comparisonData.totalUsers}
                </div>
              </div>
              
              {/* Visualization */}
              <div className="mb-6">
                <div className="bg-gray-200 h-8 rounded-full overflow-hidden mb-2">
                  <div className="flex h-full">
                    <div 
                      className="bg-blue-500 flex items-center justify-center text-white text-xs"
                      style={{ width: `${comparisonData.team1.percent}%`, minWidth: comparisonData.team1.percent ? '40px' : '0' }}
                    >
                      {comparisonData.team1.percent}%
                    </div>
                    <div 
                      className="bg-red-500 flex items-center justify-center text-white text-xs"
                      style={{ width: `${comparisonData.team2.percent}%`, minWidth: comparisonData.team2.percent ? '40px' : '0' }}
                    >
                      {comparisonData.team2.percent}%
                    </div>
                    <div 
                      className="bg-gray-400 flex items-center justify-center text-white text-xs"
                      style={{ width: `${comparisonData.undecided.percent}%`, minWidth: comparisonData.undecided.percent ? '40px' : '0' }}
                    >
                      {comparisonData.undecided.percent}%
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-1"></div>
                    <span>{comparisonData.team1.name}: {comparisonData.team1.count}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
                    <span>{comparisonData.team2.name}: {comparisonData.team2.count}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-gray-400 rounded-full mr-1"></div>
                    <span>No pick: {comparisonData.undecided.count}</span>
                  </div>
                </div>
              </div>
              
              {/* Detailed User Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium mb-2">{comparisonData.team1.name} Picks:</h5>
                  <ul className="text-sm max-h-40 overflow-y-auto border rounded p-2">
                    {comparisonData.team1.users.length > 0 ? (
                      comparisonData.team1.users.map(user => (
                        <li 
                          key={user.id} 
                          className={`py-1 px-2 ${user.isCurrentUser ? 'bg-blue-100 font-medium' : ''}`}
                        >
                          {user.name} {user.isCurrentUser ? "(You)" : ""}
                        </li>
                      ))
                    ) : (
                      <li className="py-1 px-2 text-gray-500 italic">No picks</li>
                    )}
                  </ul>
                </div>
                
                <div>
                  <h5 className="font-medium mb-2">{comparisonData.team2.name} Picks:</h5>
                  <ul className="text-sm max-h-40 overflow-y-auto border rounded p-2">
                    {comparisonData.team2.users.length > 0 ? (
                      comparisonData.team2.users.map(user => (
                        <li 
                          key={user.id} 
                          className={`py-1 px-2 ${user.isCurrentUser ? 'bg-blue-100 font-medium' : ''}`}
                        >
                          {user.name} {user.isCurrentUser ? "(You)" : ""}
                        </li>
                      ))
                    ) : (
                      <li className="py-1 px-2 text-gray-500 italic">No picks</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No comparison data available.</p>
          )}
        </div>
        
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchupComparison;