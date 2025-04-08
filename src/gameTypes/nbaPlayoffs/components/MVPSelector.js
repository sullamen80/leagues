// src/gameTypes/nbaPlayoffs/components/MVPSelector.js
import React, { useState, useEffect } from 'react';
import { FaMedal, FaSearch, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

/**
 * NBA Finals MVP selector component
 * Allows users to select a player as their Finals MVP prediction
 * 
 * @param {string} selectedMVP - Currently selected MVP
 * @param {Function} onSelect - Callback when an MVP is selected
 * @param {Array} finalistsTeams - List of teams in the Finals (for filtering players)
 * @param {boolean} disabled - Whether the selection is disabled/locked
 * @param {string} officialMVP - The official Finals MVP (if available)
 * @param {Object} teamPlayers - Object with team names as keys and arrays of player names as values
 */
const MVPSelector = ({
  selectedMVP,
  onSelect,
  finalistsTeams = [],
  disabled = false,
  officialMVP = null,
  teamPlayers = {}
}) => {
  // State for search/filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Get all available players from finalist teams
  useEffect(() => {
    if (!finalistsTeams || finalistsTeams.length === 0) {
      // No finalist teams yet, show all players
      const allPlayers = Object.values(teamPlayers).flat();
      setFilteredPlayers(allPlayers);
    } else {
      // Filter to only show players from finalist teams
      const finalistPlayers = finalistsTeams
        .filter(team => teamPlayers[team])
        .flatMap(team => teamPlayers[team] || []);
      
      setFilteredPlayers(finalistPlayers);
    }
  }, [finalistsTeams, teamPlayers]);
  
  // Filter players based on search term
  useEffect(() => {
    if (!searchTerm) return;
    
    const filtered = filteredPlayers.filter(player => 
      player.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setFilteredPlayers(filtered);
  }, [searchTerm]);
  
  // Handle player selection
  const handlePlayerSelect = (player) => {
    if (disabled) return;
    
    onSelect(player);
    setShowDropdown(false);
    setSearchTerm('');
  };
  
  // Check if prediction is correct
  const isPredictionCorrect = () => {
    if (!officialMVP || !selectedMVP) return null;
    return officialMVP === selectedMVP;
  };
  
  return (
    <div className="mvp-selector">
      {/* Selected MVP display */}
      {selectedMVP ? (
        <div className="mb-4">
          <div className="text-center p-3 border rounded-lg bg-white shadow-sm">
            <div className="text-sm text-gray-500 mb-1">Your Finals MVP Pick</div>
            <div className="flex items-center justify-center">
              <FaMedal className="text-amber-500 mr-2" />
              <span className="text-lg font-bold">{selectedMVP}</span>
              
              {officialMVP && (
                <span className="ml-2">
                  {isPredictionCorrect() ? (
                    <FaCheckCircle className="text-green-500" />
                  ) : (
                    <FaTimesCircle className="text-red-500" />
                  )}
                </span>
              )}
            </div>
            
            {/* Change button if not disabled */}
            {!disabled && (
              <button 
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                onClick={() => setShowDropdown(true)}
              >
                Change selection
              </button>
            )}
            
            {/* Show result if available */}
            {officialMVP && !isPredictionCorrect() && (
              <div className="mt-2 text-sm text-red-600">
                Actual Finals MVP: {officialMVP}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MVP selection interface */
        <div className="mb-4">
          <div 
            className="p-4 border rounded-lg bg-white shadow-sm cursor-pointer hover:bg-gray-50"
            onClick={() => !disabled && setShowDropdown(true)}
          >
            <div className="text-center">
              <FaMedal className="text-amber-500 mx-auto mb-2 text-xl" />
              <div className="font-medium">Select Finals MVP</div>
              <div className="text-sm text-gray-500 mt-1">
                Who will be the most valuable player in the NBA Finals?
              </div>
              
              {disabled && (
                <div className="mt-2 text-xs text-red-600">
                  MVP selection is locked
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Player selection dropdown */}
      {showDropdown && !disabled && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Select Finals MVP</h3>
                <button 
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowDropdown(false);
                    setSearchTerm('');
                  }}
                >
                  ✕
                </button>
              </div>
              
              {/* Search box */}
              <div className="mt-3 relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search players..."
                  className="w-full p-2 pl-8 border rounded-md"
                />
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
            
            {/* Player list */}
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredPlayers.length > 0 ? (
                filteredPlayers.map((player, index) => (
                  <div
                    key={index}
                    className="p-2 hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => handlePlayerSelect(player)}
                  >
                    {player}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No players found. Try a different search term.
                </div>
              )}
            </div>
            
            <div className="p-3 border-t text-right">
              <button
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-gray-800"
                onClick={() => {
                  setShowDropdown(false);
                  setSearchTerm('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MVPSelector;