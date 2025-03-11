// src/gameTypes/marchMadness/components/BracketEditor.js
import React, { useState, useEffect } from 'react';
import { FaTrophy, FaInfoCircle } from 'react-icons/fa';
import Matchup from './Matchup';
import { getDisplayName, getRegionName } from '../utils/tournamentUtils';

/**
 * Tournament bracket editor component
 * Used by both admin and user interfaces to display and edit bracket
 * 
 * @param {Object} bracketData - The bracket data to display/edit
 * @param {Function} onSelectWinner - Callback when a winner is selected
 * @param {boolean} isAdmin - Whether the user is an admin
 * @param {boolean} isLocked - Whether the bracket is locked for editing
 * @param {Object} officialBracket - Optional official bracket data for comparison
 */
const BracketEditor = ({ 
  bracketData, 
  onSelectWinner, 
  isAdmin = false, 
  isLocked = false,
  officialBracket = null
}) => {
  const [rounds, setRounds] = useState({
    RoundOf64: [],
    RoundOf32: [],
    Sweet16: [],
    Elite8: [],
    FinalFour: [],
    Championship: null,
    Champion: ""
  });
  
  // Process bracket data for display
  useEffect(() => {
    if (!bracketData) return;
    
    setRounds({
      RoundOf64: bracketData.RoundOf64 || [],
      RoundOf32: bracketData.RoundOf32 || [],
      Sweet16: bracketData.Sweet16 || [],
      Elite8: bracketData.Elite8 || [],
      FinalFour: bracketData.FinalFour || [],
      Championship: bracketData.Championship || {},
      Champion: bracketData.Champion || ""
    });
  }, [bracketData]);
  
  // Get the official pick for a matchup, if available
  const getOfficialPick = (round, index) => {
    if (!officialBracket || !officialBracket[round]) return null;
    
    if (round === 'Championship') {
      return officialBracket.Championship?.winner || null;
    }
    
    if (Array.isArray(officialBracket[round]) && 
        officialBracket[round][index] && 
        officialBracket[round][index].winner) {
      return officialBracket[round][index].winner;
    }
    
    return null;
  };
  
  // Render a matchup component
  const renderMatchup = (round, index, matchup, roundIdentifier = '') => {
    if (!matchup) return null;
    
    const handleWinnerSelect = (winner, winnerSeed) => {
      if (!isLocked && onSelectWinner) {
        onSelectWinner(round, index, winner, winnerSeed);
      }
    };
    
    // Get the official pick for this matchup
    const officialPick = getOfficialPick(round, index);
    
    return (
      <div className="mb-4">
        <Matchup
          matchup={matchup}
          onWinnerSelect={handleWinnerSelect}
          isLocked={isLocked}
          showSeed={true}
          roundIdentifier={roundIdentifier}
          officialPick={officialPick}
        />
      </div>
    );
  };

  // Calculate number of matchups per region for a given round
  const getMatchupsPerRegion = (roundName) => {
    switch(roundName) {
      case 'RoundOf64': return 8;
      case 'RoundOf32': return 4;
      case 'Sweet16': return 2;
      case 'Elite8': return 1;
      default: return 0;
    }
  };
  
  // Render a tournament round
  const renderRound = (roundName, showRegions = true) => {
    const displayName = getDisplayName(roundName);
    const matchups = rounds[roundName];
    
    if (!matchups || (Array.isArray(matchups) && matchups.length === 0)) {
      return (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">{displayName}</h3>
          <div className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
            Complete previous round to reveal {displayName}
          </div>
        </div>
      );
    }
    
    // Special case for Championship (single matchup object)
    if (roundName === 'Championship') {
      return (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">{displayName}</h3>
          <div className="max-w-lg mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg shadow-md border border-purple-200">
              <h4 className="text-xl font-bold mb-4 text-center text-purple-900 pb-2 border-b border-purple-200">
                National Championship
              </h4>
              {matchups.team1 && matchups.team2 ? (
                renderMatchup('Championship', 0, matchups, 'Championship Game')
              ) : (
                <div className="text-center text-gray-500 p-4">
                  Awaiting Final Four winners...
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    // Special case for Final Four (centered layout)
    if (roundName === 'FinalFour') {
      return (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">{displayName}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {matchups.map((matchup, index) => (
              <div key={`finalfour-${index}`} className="bg-gray-100 rounded-lg p-4 shadow border border-indigo-200">
                {renderMatchup('FinalFour', index, matchup, `Final Four Game ${index + 1}`)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Special case for Elite 8 - stacked layout like Sweet 16
    if (roundName === 'Elite8') {
      const regions = ["East", "West", "Midwest", "South"];
      
      return (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">{displayName}</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {regions.map((region) => {
              // Filter matchups for this region
              const regionMatchups = matchups.filter((_, index) => 
                getRegionName(roundName, index) === region
              );
              
              return (
                <div key={`${roundName}-${region}`} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                  <h4 className={`text-lg font-bold mb-3 pb-2 border-b ${
                    region === "East" ? "text-blue-800" : 
                    region === "West" ? "text-red-800" : 
                    region === "Midwest" ? "text-yellow-800" : 
                    "text-green-800"
                  }`}>{region} Regional Final</h4>
                  
                  <div className="space-y-3">
                    {regionMatchups.map((matchup, localIndex) => {
                      // Find global index
                      const globalIndex = matchups.findIndex(m => m === matchup);
                      return renderMatchup(
                        roundName, 
                        globalIndex, 
                        matchup, 
                        `${region} Regional Final`
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    // For rounds with regions (Round of 64, Round of 32, Sweet 16)
    if (showRegions) {
      const regions = ["East", "West", "Midwest", "South"];
      
      return (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">{displayName}</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {regions.map((region) => {
              // Filter matchups for this region
              const regionMatchups = matchups.filter((_, index) => 
                getRegionName(roundName, index) === region
              );
              
              return (
                <div key={`${roundName}-${region}`} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                  <h4 className={`text-lg font-bold mb-3 pb-2 border-b ${
                    region === "East" ? "text-blue-800" : 
                    region === "West" ? "text-red-800" : 
                    region === "Midwest" ? "text-yellow-800" : 
                    "text-green-800"
                  }`}>{region} Region</h4>
                  
                  <div className="space-y-3">
                    {regionMatchups.map((matchup, localIndex) => {
                      // Find global index
                      const globalIndex = matchups.findIndex(m => m === matchup);
                      return renderMatchup(
                        roundName, 
                        globalIndex, 
                        matchup, 
                        `${region} - Game ${localIndex + 1}`
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    // Generic list view for rounds without regions
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">{displayName}</h3>
        <div className="space-y-4">
          {matchups.map((matchup, index) => (
            renderMatchup(roundName, index, matchup, `${displayName} - Game ${index + 1}`)
          ))}
        </div>
      </div>
    );
  };
  
  // Render champion display
  const renderChampion = () => {
    if (!rounds.Champion) return null;
    
    // Determine the color based on the comparison with official bracket
    let championClass = "text-pink-700";
    
    if (officialBracket && officialBracket.Champion) {
      championClass = rounds.Champion === officialBracket.Champion 
        ? "text-green-700" 
        : "text-red-700";
    }
    
    return (
      <div className="mt-8 bg-pink-50 p-4 rounded-lg border border-pink-200 text-center">
        <h3 className="text-xl font-bold mb-2 text-pink-800">Champion</h3>
        <div className={`text-2xl font-bold ${championClass}`}>{rounds.Champion}</div>
      </div>
    );
  };
  
  return (
    <div className="bracket-editor overflow-x-auto">
      {!bracketData ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No bracket data available</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* All tournament rounds */}
          {renderRound('RoundOf64', true)}
          {renderRound('RoundOf32', true)}
          {renderRound('Sweet16', true)}
          {renderRound('Elite8', true)}
          {renderRound('FinalFour', false)}
          {renderRound('Championship', false)}
          
          {/* Champion display */}
          {renderChampion()}
        </div>
      )}
      
      {isLocked && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded mt-4">
          <div className="flex items-center">
            <FaInfoCircle className="mr-2" />
            <span>This bracket is locked and cannot be edited</span>
          </div>
        </div>
      )}
      
      {/* Show comparison legend if official bracket is provided */}
      {officialBracket && (
        <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded">
          <h4 className="font-semibold mb-2">Color Legend:</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-indigo-500 mr-2"></div>
              <span>Your pick (no result yet)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span>Correct pick</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
              <span>Incorrect pick</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BracketEditor;