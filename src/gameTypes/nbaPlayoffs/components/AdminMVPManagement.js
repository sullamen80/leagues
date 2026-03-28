// src/gameTypes/nbaPlayoffs/components/AdminMVPManagement.js
import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaMedal, FaPlus, FaTrash, FaUpload, FaSave, FaTimes, FaArrowLeft } from 'react-icons/fa';
import { ROUND_KEYS } from '../constants/playoffConstants';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Admin MVP Management Component for NBA Playoffs
 */
const AdminMVPManagement = ({ 
  leagueId, 
  isArchived = false,
  onUpdateSuccess,
  onUpdateError
}) => {
  // Navigation
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for MVP candidates and winner
  const [mvpCandidates, setMvpCandidates] = useState({});
  const [officialMVP, setOfficialMVP] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [gameData, setGameData] = useState(null);
  
  // UI state for single team upload
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const fileInputRef = useRef(null);
  
  // UI state for bulk upload
  const [bulkCsvFile, setBulkCsvFile] = useState(null);
  const [bulkCsvLoading, setBulkCsvLoading] = useState(false);
  const [bulkCsvError, setBulkCsvError] = useState(null);
  const bulkFileInputRef = useRef(null);

  // Back to dashboard
  const navigateToDashboard = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.delete('subview');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };
  
  // Load game data from Firestore
  useEffect(() => {
    const loadGameData = async () => {
      try {
        setLoading(true);
        
        // Fetch the game data directly from Firestore
        const gameDataDoc = await getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'));
        
        if (gameDataDoc.exists()) {
          const data = gameDataDoc.data();
          console.log("Loaded game data:", data);
          setGameData(data);
          
          // Check if there's an official MVP set
          if (data[ROUND_KEYS.FINALS_MVP]) {
            setOfficialMVP(data[ROUND_KEYS.FINALS_MVP]);
          }
          
          // Extract teams and load existing MVP data
          const playoffTeams = extractPlayoffTeams(data);
          console.log("Extracted teams:", playoffTeams);
          
          // Load existing MVP candidates
          let existingCandidates = {};
          
          if (data.mvpCandidates) {
            existingCandidates = data.mvpCandidates;
          } else if (data.teamPlayers) {
            existingCandidates = data.teamPlayers;
          } else {
            // Try to fetch from dedicated MVP document
            try {
              const mvpDoc = await getDoc(doc(db, 'leagues', leagueId, 'playoffs', 'mvp'));
              if (mvpDoc.exists()) {
                const mvpData = mvpDoc.data();
                existingCandidates = mvpData.candidates || {};
              }
            } catch (error) {
              console.error("Error loading MVP document:", error);
            }
          }
          
          // Merge existing players with playoff teams
          const mergedCandidates = {};
          
          // First add all playoff teams (even empty ones)
          Object.keys(playoffTeams).forEach(team => {
            mergedCandidates[team] = [];
          });
          
          // Then add any existing players to their teams
          Object.entries(existingCandidates).forEach(([team, players]) => {
            if (mergedCandidates[team]) {
              mergedCandidates[team] = players;
            }
          });
          
          setMvpCandidates(mergedCandidates);
        } else {
          console.error("Game data document doesn't exist");
          setFeedback({
            type: 'error',
            message: 'Failed to load game data: Document not found'
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading game data:", error);
        setFeedback({
          type: 'error',
          message: 'Failed to load game data: ' + error.message
        });
        setLoading(false);
      }
    };
    
    loadGameData();
  }, [leagueId]);
  
  // Function to extract playoff teams with detailed debugging
  const extractPlayoffTeams = (data) => {
    console.log("DEBUGGING TEAM EXTRACTION:");
    console.log("Data object:", data);
    console.log("Available properties:", Object.keys(data));
    
    const teams = {};
    
    if (!data) {
      console.log("No data provided");
      return teams;
    }
    
    // Method 1: Check for "First Round" directly
    if (data["First Round"] && Array.isArray(data["First Round"])) {
      console.log("Found 'First Round' with", data["First Round"].length, "matchups");
      
      data["First Round"].forEach((matchup, index) => {
        console.log(`Processing matchup ${index}:`, matchup);
        
        if (matchup && matchup.team1 && matchup.team2) {
          const team1 = matchup.team1;
          const team2 = matchup.team2;
          
          if (typeof team1 === 'string') {
            teams[team1] = [];
            console.log(`Added team1: ${team1}`);
          }
          
          if (typeof team2 === 'string') {
            teams[team2] = [];
            console.log(`Added team2: ${team2}`);
          }
        }
      });
    }
    
    // Method 2: Check for "Play In Tournament" if it exists
    if (data["Play In Tournament"] && Array.isArray(data["Play In Tournament"])) {
      console.log("Found 'Play In Tournament' with", data["Play In Tournament"].length, "matchups");
      
      data["Play In Tournament"].forEach((matchup, index) => {
        if (matchup && matchup.team1 && matchup.team2) {
          const team1 = matchup.team1;
          const team2 = matchup.team2;
          
          if (typeof team1 === 'string') {
            teams[team1] = [];
            console.log(`Added play-in team1: ${team1}`);
          }
          
          if (typeof team2 === 'string') {
            teams[team2] = [];
            console.log(`Added play-in team2: ${team2}`);
          }
        }
      });
    }
    
    // Method 3: Fallback - add some default teams if none were found
    if (Object.keys(teams).length === 0) {
      console.log("No teams found in the data. Adding placeholder teams.");
      
      // NBA Teams (East + West)
      const defaultTeams = [
        "Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets",
        "Chicago Bulls", "Cleveland Cavaliers", "Dallas Mavericks", "Denver Nuggets",
        "Detroit Pistons", "Golden State Warriors", "Houston Rockets", "Indiana Pacers",
        "Los Angeles Clippers", "Los Angeles Lakers", "Memphis Grizzlies", "Miami Heat",
        "Milwaukee Bucks", "Minnesota Timberwolves", "New Orleans Pelicans", "New York Knicks",
        "Oklahoma City Thunder", "Orlando Magic", "Philadelphia 76ers", "Phoenix Suns",
        "Portland Trail Blazers", "Sacramento Kings", "San Antonio Spurs", "Toronto Raptors",
        "Utah Jazz", "Washington Wizards"
      ];
      
      defaultTeams.forEach(team => {
        teams[team] = [];
      });
    }
    
    console.log("Final extracted teams:", Object.keys(teams));
    console.log("Total teams found:", Object.keys(teams).length);
    
    return teams;
  };
  
  // Function to add a player to selected team
  const handleAddPlayer = () => {
    if (!selectedTeam || !newPlayerName.trim()) return;
    
    const updatedCandidates = { ...mvpCandidates };
    
    if (!updatedCandidates[selectedTeam]) {
      updatedCandidates[selectedTeam] = [];
    }
    
    // Check if player already exists
    if (updatedCandidates[selectedTeam].includes(newPlayerName)) {
      setFeedback({
        type: 'warning',
        message: `${newPlayerName} is already in the team`
      });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    
    updatedCandidates[selectedTeam].push(newPlayerName);
    setMvpCandidates(updatedCandidates);
    setNewPlayerName('');
  };
  
  // Function to remove a player
  const handleRemovePlayer = (team, player) => {
    const updatedCandidates = { ...mvpCandidates };
    updatedCandidates[team] = updatedCandidates[team].filter(p => p !== player);
    
    // If this player was the MVP, reset it
    if (player === officialMVP) {
      setOfficialMVP('');
    }
    
    setMvpCandidates(updatedCandidates);
  };
  
  // Function to set official MVP
  const handleSetOfficialMVP = (player) => {
    if (isArchived) return;
    
    setOfficialMVP(player);
  };
  
  // Handle CSV file selection for single team
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setCsvFile(file);
      setCsvError(null);
    }
  };
  
  // Parse CSV file and add players to selected team
  const handleCsvUpload = () => {
    if (!csvFile || !selectedTeam) {
      setCsvError("Please select a file and a team");
      return;
    }
    
    setCsvLoading(true);
    setCsvError(null);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = text.split(/\r?\n/);
        
        // Filter out empty rows
        const validRows = rows.filter(row => row.trim() !== '');
        
        if (validRows.length === 0) {
          setCsvError("CSV file appears to be empty");
          setCsvLoading(false);
          return;
        }
        
        // Check if there's a header row
        const firstRow = validRows[0].toLowerCase();
        const hasHeader = firstRow.includes('name') || firstRow.includes('player') || firstRow.includes(',');
        
        // Start from index 1 if we have a header, otherwise from 0
        const startIndex = hasHeader ? 1 : 0;
        
        // Process player names
        const players = [];
        for (let i = startIndex; i < validRows.length; i++) {
          const row = validRows[i].trim();
          
          // If the row contains a comma, assume it's a CSV and take the first column
          const playerName = row.includes(',') ? row.split(',')[0].trim() : row;
          
          if (playerName) {
            players.push(playerName);
          }
        }
        
        // Add players to the selected team
        if (players.length > 0) {
          const updatedCandidates = { ...mvpCandidates };
          
          if (!updatedCandidates[selectedTeam]) {
            updatedCandidates[selectedTeam] = [];
          }
          
          // Filter out duplicates
          const existingPlayers = new Set(updatedCandidates[selectedTeam]);
          const newPlayers = players.filter(player => !existingPlayers.has(player));
          
          if (newPlayers.length > 0) {
            updatedCandidates[selectedTeam] = [...updatedCandidates[selectedTeam], ...newPlayers];
            setMvpCandidates(updatedCandidates);
            
            setFeedback({
              type: 'success',
              message: `Added ${newPlayers.length} players to ${selectedTeam}`
            });
            
            setTimeout(() => setFeedback(null), 3000);
          } else {
            setCsvError("No new players found in the file (all were duplicates)");
          }
        } else {
          setCsvError("No valid player names found in the file");
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
        setCsvError(`Error parsing CSV: ${error.message}`);
      } finally {
        setCsvLoading(false);
        setCsvFile(null);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    
    reader.onerror = () => {
      setCsvError("Error reading the file");
      setCsvLoading(false);
    };
    
    reader.readAsText(csvFile);
  };
  
  // Handle bulk CSV file selection
  const handleBulkFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setBulkCsvFile(file);
      setBulkCsvError(null);
    }
  };
  
  // Parse bulk CSV file and add teams and players
  const handleBulkCsvUpload = () => {
    if (!bulkCsvFile) {
      setBulkCsvError("Please select a file");
      return;
    }
    
    setBulkCsvLoading(true);
    setBulkCsvError(null);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = text.split(/\r?\n/);
        
        // Filter out empty rows
        const validRows = rows.filter(row => row.trim() !== '');
        
        if (validRows.length === 0) {
          setBulkCsvError("CSV file appears to be empty");
          setBulkCsvLoading(false);
          return;
        }
        
        // Check if there's a header row
        const firstRow = validRows[0].toLowerCase();
        const hasHeader = firstRow.includes('team') || firstRow.includes('player');
        
        // Start from index 1 if we have a header, otherwise from 0
        const startIndex = hasHeader ? 1 : 0;
        
        // Process team-player pairs
        const teamPlayerMap = {};
        let addedTeams = 0;
        let addedPlayers = 0;
        let skippedPlayers = 0;
        
        for (let i = startIndex; i < validRows.length; i++) {
          const row = validRows[i].trim();
          
          if (!row.includes(',')) continue; // Skip if not comma-separated
          
          // Parse team and player names
          const [team, player] = row.split(',', 2).map(s => s.trim());
          
          if (team && player) {
            // Initialize team array if it doesn't exist
            if (!teamPlayerMap[team]) {
              teamPlayerMap[team] = new Set();
              addedTeams++;
            }
            
            // Add player to the team
            teamPlayerMap[team].add(player);
            addedPlayers++;
          }
        }
        
        // Update the mvpCandidates state
        const updatedCandidates = { ...mvpCandidates };
        
        // Add all the teams and players
        Object.entries(teamPlayerMap).forEach(([team, playersSet]) => {
          // Initialize team array if it doesn't exist
          if (!updatedCandidates[team]) {
            updatedCandidates[team] = [];
          }
          
          // Add new players to the team
          const existingPlayers = new Set(updatedCandidates[team]);
          
          playersSet.forEach(player => {
            if (!existingPlayers.has(player)) {
              updatedCandidates[team].push(player);
            } else {
              skippedPlayers++;
            }
          });
        });
        
        // Update state
        setMvpCandidates(updatedCandidates);
        
        // Provide feedback
        setFeedback({
          type: 'success',
          message: `Processed ${addedTeams} teams and added ${addedPlayers - skippedPlayers} players (${skippedPlayers} duplicates skipped)`
        });
        
        setTimeout(() => setFeedback(null), 5000);
      } catch (error) {
        console.error("Error parsing bulk CSV:", error);
        setBulkCsvError(`Error parsing CSV: ${error.message}`);
      } finally {
        setBulkCsvLoading(false);
        setBulkCsvFile(null);
        // Reset file input
        if (bulkFileInputRef.current) {
          bulkFileInputRef.current.value = "";
        }
      }
    };
    
    reader.onerror = () => {
      setBulkCsvError("Error reading the file");
      setBulkCsvLoading(false);
    };
    
    reader.readAsText(bulkCsvFile);
  };
  
  // Save changes to Firestore
  const handleSaveChanges = async () => {
    if (isArchived) return;
    
    setSaving(true);
    setFeedback(null);
    
    try {
      // Update MVP data in gameData document (use 'current' as document ID)
      const gameDataRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
      
      // Update with both mvpCandidates and the Finals MVP
      await updateDoc(gameDataRef, {
        'mvpCandidates': mvpCandidates,
        [ROUND_KEYS.FINALS_MVP]: officialMVP
      });
      
      setFeedback({
        type: 'success',
        message: 'MVP data saved successfully'
      });
      
      // Notify parent component if callback provided
      if (onUpdateSuccess) {
        onUpdateSuccess({
          mvpCandidates,
          [ROUND_KEYS.FINALS_MVP]: officialMVP
        });
      }
    } catch (error) {
      console.error("Error saving MVP data:", error);
      setFeedback({
        type: 'error',
        message: 'Failed to save: ' + error.message
      });
      
      // Notify parent component if callback provided
      if (onUpdateError) {
        onUpdateError(error);
      }
    } finally {
      setSaving(false);
      setTimeout(() => {
        if (feedback && feedback.type === 'success') {
          setFeedback(null);
        }
      }, 3000);
    }
  };
  
  // Get finalist teams based on NBA Finals data
  const getFinalistTeams = () => {
    if (!gameData) return [];
    
    // Check both "NBA Finals" and NBAFinals keys
    const nbaFinalsData = gameData["NBA Finals"] || gameData.NBAFinals;
    
    if (nbaFinalsData) {
      // If NBA Finals is an array
      if (Array.isArray(nbaFinalsData)) {
        if (nbaFinalsData.length === 0) return [];
        
        const finalsMatchup = nbaFinalsData[0]; // Assuming just one matchup in Finals
        if (!finalsMatchup) return [];
        
        const team1 = finalsMatchup.team1;
        const team2 = finalsMatchup.team2;
        
        return [team1, team2].filter(team => team);
      } 
      // If NBA Finals is an object
      else if (typeof nbaFinalsData === 'object') {
        const team1 = nbaFinalsData.team1;
        const team2 = nbaFinalsData.team2;
        
        return [team1, team2].filter(team => team);
      }
    }
    
    return [];
  };
  
  // Get all MVP candidates (flattened array)
  const getAllMVPCandidates = () => {
    return Object.entries(mvpCandidates).flatMap(([team, players]) => 
      players.map(player => ({ team, player }))
    );
  };
  
  // Determine if the NBA Finals are set
  const isNBAFinalsSet = getFinalistTeams().length === 2;
  
  // Determine if the playoffs are completed based on Champion existence
  const isPlayoffsCompleted = !!(gameData && gameData.Champion);
  
  return (
    <div className="mvp-management">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-bold">Finals MVP Management</h2>
        <button
          onClick={navigateToDashboard}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center"
        >
          <FaArrowLeft className="mr-2" /> Back to Dashboard
        </button>
      </div>
      
      {/* Status/Feedback Message */}
      {feedback && (
        <div className={`mb-4 p-3 rounded border ${
          feedback.type === 'error' 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : feedback.type === 'warning'
              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
              : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback.message}
        </div>
      )}
      
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        {loading ? (
          <div className="text-center py-6">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
            <p>Loading MVP data...</p>
          </div>
        ) : (
          <>
            {/* MVP Status Section */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-bold text-lg mb-3 flex items-center">
                <FaMedal className="text-amber-500 mr-2" /> Finals MVP Status
              </h3>
              
              {isNBAFinalsSet ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    The NBA Finals matchup is set between: <strong>{getFinalistTeams().join(' vs. ')}</strong>
                  </p>
                  
                  {officialMVP ? (
                    <div className="flex items-center justify-between bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <div className="flex items-center">
                        <FaMedal className="text-amber-500 mr-2 text-xl" />
                        <div>
                          <div className="font-bold text-lg">{officialMVP}</div>
                          <div className="text-sm text-gray-600">Official Finals MVP</div>
                        </div>
                      </div>
                      
                      {!isArchived && !isPlayoffsCompleted && (
                        <button
                          onClick={() => setOfficialMVP('')}
                          className="p-2 text-red-600 hover:text-red-800 transition"
                          title="Remove MVP selection"
                        >
                          <FaTimes />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 mb-2">
                      {isPlayoffsCompleted ? 
                        'Playoffs are complete but no MVP has been selected yet.' : 
                        'No Finals MVP has been selected yet. You can select one from the list of players below.'
                      }
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  NBA Finals matchup has not been determined yet. Once the finals matchup is set, you can select an MVP from the finalist teams.
                </div>
              )}
            </div>
            
            {/* Team and Player Management */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Teams List */}
              <div className="bg-gray-50 rounded-lg border p-4">
                <h3 className="font-bold mb-3">Playoff Teams</h3>
                
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {Object.keys(mvpCandidates).length > 0 ? (
                    Object.keys(mvpCandidates).map(team => (
                      <div 
                        key={team} 
                        className={`p-2 rounded flex items-center justify-between ${
                          selectedTeam === team ? 'bg-blue-100 border border-blue-300' : 'bg-white border'
                        } cursor-pointer`}
                        onClick={() => setSelectedTeam(team)}
                      >
                        <div className="flex-grow">
                          {team}
                          <span className="text-xs text-gray-500 ml-2">
                            ({mvpCandidates[team].length} players)
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No playoff teams found. Set up teams in the bracket first.
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-gray-600 mt-2 p-2 bg-blue-50 rounded">
                  <p>Teams are automatically populated from the playoff bracket. Add or remove teams in the bracket settings.</p>
                </div>
              </div>
              
              {/* Players for Selected Team */}
              <div className="bg-gray-50 rounded-lg border p-4">
                <h3 className="font-bold mb-3">
                  {selectedTeam ? `Players for ${selectedTeam}` : 'Select a team'}
                </h3>
                
                {selectedTeam ? (
                  <>
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {mvpCandidates[selectedTeam] && mvpCandidates[selectedTeam].length > 0 ? (
                        mvpCandidates[selectedTeam].map(player => (
                          <div 
                            key={player}
                            className="p-2 rounded bg-white border flex items-center justify-between"
                          >
                            <div>{player}</div>
                            
                            {!isArchived && (
                              <button
                                onClick={() => handleRemovePlayer(selectedTeam, player)}
                                className="p-1 text-red-600 hover:text-red-800"
                                title="Remove player"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          No players added for this team
                        </div>
                      )}
                    </div>
                    
                    {!isArchived && (
                      <>
                        {/* Add single player */}
                        <div className="mb-4">
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={newPlayerName}
                              onChange={(e) => setNewPlayerName(e.target.value)}
                              placeholder="Add player name"
                              className="flex-1 p-2 border rounded"
                            />
                            <button
                              onClick={handleAddPlayer}
                              disabled={!newPlayerName.trim()}
                              className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
                            >
                              <FaPlus />
                            </button>
                          </div>
                        </div>
                        
                        {/* CSV Upload */}
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">Upload Players from CSV</h4>
                          
                          {csvError && (
                            <div className="mb-2 text-sm text-red-600">
                              {csvError}
                            </div>
                          )}
                          
                          <div className="flex flex-col space-y-2">
                            <input
                              type="file"
                              accept=".csv,.txt"
                              onChange={handleFileChange}
                              ref={fileInputRef}
                              className="text-sm"
                            />
                            
                            <button
                              onClick={handleCsvUpload}
                              disabled={!csvFile || csvLoading}
                              className="px-3 py-2 bg-green-600 text-white rounded disabled:bg-gray-400 flex items-center justify-center"
                            >
                              {csvLoading ? (
                                <>
                                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <FaUpload className="mr-2" /> Upload Players
                                </>
                              )}
                            </button>
                          </div>
                          
                          <div className="mt-2 text-xs text-gray-500">
                            Upload a CSV file with player names (one per line). The first column will be used if multiple columns are present.
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Please select a team to view or manage its players
                  </div>
                )}
              </div>
              
              {/* MVP Selection Section */}
              <div className="bg-gray-50 rounded-lg border p-4">
                <h3 className="font-bold mb-3">Select Finals MVP</h3>
                
                {isNBAFinalsSet ? (
                  <>
                    <div className="max-h-80 overflow-y-auto mb-4">
                      {getAllMVPCandidates().length > 0 ? (
                        <div className="space-y-1">
                          {/* First show finalist teams' players */}
                          {getFinalistTeams().map(finalistTeam => (
                            mvpCandidates[finalistTeam] && (
                              <div key={finalistTeam}>
                                <div className="text-sm font-medium text-gray-500 mt-2 mb-1">
                                  {finalistTeam}
                                </div>
                                
                                {mvpCandidates[finalistTeam].map(player => (
                                  <div 
                                    key={player}
                                    onClick={() => !isArchived && handleSetOfficialMVP(player)}
                                    className={`p-2 rounded cursor-pointer flex items-center ${
                                      officialMVP === player
                                        ? 'bg-amber-100 border border-amber-300'
                                        : 'bg-white border hover:bg-gray-100'
                                    }`}
                                  >
                                    {officialMVP === player && (
                                      <FaMedal className="text-amber-500 mr-2" />
                                    )}
                                    {player}
                                  </div>
                                ))}
                              </div>
                            )
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          No MVP candidates added yet. Add players to finalist teams.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    NBA Finals matchup has not been determined yet
                  </div>
                )}
              </div>
            </div>
            
            {/* Bulk Upload Section */}
            <div className="mt-6 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-3">Bulk Upload Players</h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload a CSV file with all teams and players at once. Each row should contain a team name and player name separated by a comma.
              </p>
              
              {bulkCsvError && (
                <div className="mb-3 p-2 text-sm text-red-600 bg-red-50 rounded">
                  {bulkCsvError}
                </div>
              )}
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">File Format Example:</h4>
                  <pre className="text-xs bg-white p-2 border rounded overflow-auto max-h-32">
                    Team,Player<br />
                    Boston Celtics,Jayson Tatum<br />
                    Boston Celtics,Jaylen Brown<br />
                    Los Angeles Lakers,LeBron James<br />
                    Los Angeles Lakers,Anthony Davis<br />
                    ...
                  </pre>
                </div>
                
                <div className="flex flex-col justify-between">
                  <div>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleBulkFileChange}
                      ref={bulkFileInputRef}
                      className="mb-3 text-sm w-full"
                    />
                    
                    <button
                      onClick={handleBulkCsvUpload}
                      disabled={!bulkCsvFile || bulkCsvLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400 flex items-center justify-center w-full"
                    >
                      {bulkCsvLoading ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                          Processing All Teams...
                        </>
                      ) : (
                        <>
                          <FaUpload className="mr-2" /> Upload All Teams & Players
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    This will add any missing teams and players from your CSV file. Existing teams and duplicated players will be preserved.
                  </div>
                </div>
              </div>
            </div>
            
            {/* Save Button */}
            {!isArchived && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded flex items-center disabled:bg-gray-400"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaSave className="mr-2" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminMVPManagement;