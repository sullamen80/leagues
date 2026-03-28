// src/gameTypes/nflPlayoffs/components/AdminMVPManagement.js
import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaMedal, FaPlus, FaTrash, FaUpload, FaSave, FaTimes, FaArrowLeft } from 'react-icons/fa';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';
import { useNavigate, useLocation } from 'react-router-dom';
import { createBracketTemplate } from '../services/bracketService';

const NFL_TEAM_FALLBACK = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
];

/**
 * Admin MVP Management Component for NFL Playoffs
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
  const [propBets, setPropBets] = useState([]);
  const [savingProps, setSavingProps] = useState(false);
  
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
          if (Array.isArray(data.propBets)) {
            const normalizedProps = data.propBets.map((prop) => {
              const normalizedOptions = formatPropOptions(prop.options);
              return {
                id: prop.id || generatePropId(),
                line: prop.line || prop.title || '',
                round: prop.round || ROUND_KEYS.SUPER_BOWL,
                matchupIndex: Number(prop.matchupIndex) || 0,
                options:
                  normalizedOptions.length > 0 ? normalizedOptions : ['Option 1', 'Option 2'],
                officialAnswer: prop.officialAnswer || '',
                active: prop.active !== false
              };
            });
            setPropBets(normalizedProps);
          } else {
            setPropBets([]);
          }
          
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
  
  // Function to extract playoff teams
const extractPlayoffTeams = (data) => {
    const teams = {};

    if (!data) {
      NFL_TEAM_FALLBACK.forEach((team) => {
        teams[team] = [];
      });
      return teams;
    }

    const addTeam = (teamName) => {
      if (!teamName || typeof teamName !== 'string') return;
      teams[teamName] = teams[teamName] || [];
    };

    const addFromMatchups = (roundData) => {
      if (!roundData) return;
      if (Array.isArray(roundData)) {
        roundData.forEach((matchup) => {
          addTeam(matchup?.team1);
          addTeam(matchup?.team2);
        });
      } else if (typeof roundData === 'object') {
        addTeam(roundData.team1);
        addTeam(roundData.team2);
      }
    };

    if (data.playoffTeams) {
      Object.values(data.playoffTeams).forEach((conferenceTeams) => {
        if (Array.isArray(conferenceTeams)) {
          conferenceTeams.forEach((entry) => {
            const teamName = entry?.name || entry?.teamName || entry?.fullName || entry?.id;
            addTeam(teamName);
          });
        }
      });
    }

    [ROUND_KEYS.FIRST_ROUND, ROUND_KEYS.CONF_SEMIS, ROUND_KEYS.CONF_FINALS, ROUND_KEYS.SUPER_BOWL].forEach((roundKey) => {
      addFromMatchups(data[roundKey]);
    });

    if (!Object.keys(teams).length && data.allTeams) {
      Object.values(data.allTeams).forEach((conference) => {
        Object.values(conference).forEach((division) => {
          division.forEach((team) => addTeam(team?.name));
        });
      });
    }

    if (!Object.keys(teams).length) {
      NFL_TEAM_FALLBACK.forEach((team) => {
        teams[team] = [];
      });
    }

  return teams;
};

const roundOptions = [
  ROUND_KEYS.FIRST_ROUND,
  ROUND_KEYS.CONF_SEMIS,
  ROUND_KEYS.CONF_FINALS,
  ROUND_KEYS.SUPER_BOWL
];

const getMatchupsForRound = (data, roundKey) => {
  if (!data) return [];
  if (roundKey === ROUND_KEYS.SUPER_BOWL) {
    const matchup = data[ROUND_KEYS.SUPER_BOWL];
    if (!matchup) return [];
    const team1 = matchup.team1 || 'TBD';
    const team2 = matchup.team2 || 'TBD';
    return [{ index: 0, label: `${team1} vs ${team2}` }];
  }

  const roundData = data[roundKey];
  if (!Array.isArray(roundData)) return [];
  return roundData.map((matchup, idx) => {
    const team1 = matchup?.team1 || `Team ${idx * 2 + 1}`;
    const team2 = matchup?.team2 || `Team ${idx * 2 + 2}`;
    return {
      index: idx,
      label: `${team1} vs ${team2}`
    };
  });
};

const formatPropOptions = (options = []) =>
  Array.isArray(options) ? options.filter(Boolean) : [];

const generatePropId = () => `prop_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const handleAddPropBet = () => {
  if (isArchived) return;
  setPropBets((prev) => [
    ...prev,
    {
      id: generatePropId(),
      line: '',
      round: ROUND_KEYS.SUPER_BOWL,
      matchupIndex: 0,
      options: ['Option 1', 'Option 2'],
      officialAnswer: '',
      active: true
    }
  ]);
};

const handlePropFieldChange = (propId, field, value) => {
  setPropBets((prev) =>
    prev.map((prop) => {
      if (prop.id !== propId) return prop;
      const updated = { ...prop };
      if (field === 'round') {
        updated.round = value;
        updated.matchupIndex = 0;
      } else if (field === 'matchupIndex') {
        updated.matchupIndex = Number(value) || 0;
      } else {
        updated[field] = value;
      }
      return updated;
    })
  );
};

const handlePropOptionChange = (propId, optionIndex, value) => {
  setPropBets((prev) =>
    prev.map((prop) => {
      if (prop.id !== propId) return prop;
      const options = [...(prop.options || [])];
      options[optionIndex] = value;
      return { ...prop, options };
    })
  );
};

const handleAddPropOption = (propId) => {
  setPropBets((prev) =>
    prev.map((prop) =>
      prop.id === propId
        ? { ...prop, options: [...(prop.options || []), ''] }
        : prop
    )
  );
};

const handleRemovePropOption = (propId, optionIndex) => {
  setPropBets((prev) =>
    prev.map((prop) => {
      if (prop.id !== propId) return prop;
      const options = [...(prop.options || [])];
      if (options.length <= 2) return prop;
      const removedValue = options[optionIndex];
      options.splice(optionIndex, 1);
      const official =
        prop.officialAnswer === removedValue ? '' : prop.officialAnswer;
      return { ...prop, options, officialAnswer: official };
    })
  );
};

const handleOfficialAnswerSelect = (propId, option) => {
  setPropBets((prev) =>
    prev.map((prop) =>
      prop.id === propId ? { ...prop, officialAnswer: option } : prop
    )
  );
};

  const handleRemoveProp = (propId) => {
    if (isArchived) return;
    setPropBets((prev) => prev.filter((prop) => prop.id !== propId));
  };

  const handleSavePropBets = async () => {
    if (isArchived) {
      setFeedback({
        type: 'error',
        message: 'League is archived. Prop bets cannot be changed.'
      });
      return;
    }

    setSavingProps(true);
    try {
      const cleanProps = propBets.map((prop) => {
        const round = prop.round || ROUND_KEYS.SUPER_BOWL;
        const matchupIndex = Number(prop.matchupIndex) || 0;
        const matchups = getMatchupsForRound(gameData, round);
        const label = matchups.find((match) => match.index === matchupIndex)?.label || '';
        const options = formatPropOptions(prop.options);
        const normalizedOptions =
          options.length >= 2 ? options : ['Option 1', 'Option 2'];
        const official = normalizedOptions.includes(prop.officialAnswer)
          ? prop.officialAnswer
          : '';

        return {
          id: prop.id || generatePropId(),
          line: prop.line?.trim() || 'Prop Bet',
          round,
          matchupIndex,
          matchupLabel: label,
          options: normalizedOptions,
          officialAnswer: official,
          active: prop.active !== false
        };
      });

      await updateDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), {
        propBets: cleanProps,
        updatedAt: new Date().toISOString()
      });
      try {
        await createBracketTemplate(leagueId, {
          ...(gameData || {}),
          propBets: cleanProps
        });
      } catch (templateErr) {
        console.warn('Failed to refresh bracket template with prop bets:', templateErr);
      }

      setFeedback({
        type: 'success',
        message: 'Prop bets updated successfully.'
      });
      setGameData((prev) => ({
        ...(prev || {}),
        propBets: cleanProps
      }));
      setPropBets(cleanProps);
    } catch (error) {
      console.error('Error saving prop bets:', error);
      setFeedback({
        type: 'error',
        message: 'Failed to save prop bets: ' + error.message
      });
    } finally {
      setSavingProps(false);
    }
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
      
      // Update with both mvpCandidates and the Super Bowl MVP
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
  
  // Get finalist teams based on Super Bowl data
  const getFinalistTeams = () => {
    if (!gameData) return [];
    
    const superBowlData = gameData[ROUND_KEYS.SUPER_BOWL];
    
    if (superBowlData) {
      if (Array.isArray(superBowlData)) {
        if (superBowlData.length === 0) return [];
        const matchup = superBowlData[0];
        return [matchup?.team1, matchup?.team2].filter(Boolean);
      }
      if (typeof superBowlData === 'object') {
        return [superBowlData.team1, superBowlData.team2].filter(Boolean);
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
  
  // Determine if the Super Bowl matchup is set
  const isSuperBowlSet = getFinalistTeams().length === 2;
  
  // Determine if the playoffs are completed based on Champion existence
  const isPlayoffsCompleted = !!(gameData && gameData[ROUND_KEYS.CHAMPION]);
  
  return (
    <div className="mvp-management">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-bold">Super Bowl MVP Management</h2>
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
                <FaMedal className="text-amber-500 mr-2" /> Super Bowl MVP Status
              </h3>
              
              {isSuperBowlSet ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    The Super Bowl matchup is set between: <strong>{getFinalistTeams().join(' vs. ')}</strong>
                  </p>
                  
                  {officialMVP ? (
                    <div className="flex items-center justify-between bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <div className="flex items-center">
                        <FaMedal className="text-amber-500 mr-2 text-xl" />
                        <div>
                          <div className="font-bold text-lg">{officialMVP}</div>
                          <div className="text-sm text-gray-600">Official Super Bowl MVP</div>
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
                    'No Super Bowl MVP has been selected yet. You can select one from the list of players below.'
                      }
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Super Bowl matchup has not been determined yet. Once the title game is set, you can select an MVP from the finalist teams.
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
                <h3 className="font-bold mb-3">Select Super Bowl MVP</h3>
                
                {isSuperBowlSet ? (
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
                    Super Bowl matchup has not been determined yet
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
                    San Francisco 49ers,Brock Purdy<br />
                    San Francisco 49ers,Christian McCaffrey<br />
                    Kansas City Chiefs,Patrick Mahomes<br />
                    Kansas City Chiefs,Travis Kelce<br />
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
            
            {/* Prop Bets Section */}
            <div className="mt-10 border-t pt-6">
              <div className="flex flex-wrap justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold">Prop Bets</h3>
                  <p className="text-sm text-gray-600">
                    Create prop bets that players can wager on. Configure scoring and wagers in the scoring settings.
                  </p>
                </div>
                <button
                  onClick={handleAddPropBet}
                  disabled={isArchived}
                  className="mt-3 md:mt-0 px-4 py-2 bg-indigo-600 text-white rounded flex items-center disabled:bg-gray-400"
                >
                  <FaPlus className="mr-2" /> Add Prop Bet
                </button>
              </div>

              {propBets.length === 0 ? (
                <div className="p-4 border rounded bg-gray-50 text-gray-500 text-sm">
                  No prop bets defined yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {propBets.map((prop) => {
                    const roundKey = prop.round || ROUND_KEYS.SUPER_BOWL;
                    const matchupOptions = getMatchupsForRound(gameData, roundKey);
                    const matchupLabel =
                      matchupOptions.find((opt) => opt.index === prop.matchupIndex)?.label ||
                      'Matchup';
                    const options = prop.options || [];

                    return (
                      <div key={prop.id} className="p-4 border rounded-lg bg-white shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-base font-semibold text-gray-800">Prop Bet</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {ROUND_DISPLAY_NAMES[roundKey]} • {matchupLabel}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="flex items-center text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={prop.active !== false}
                                onChange={(e) =>
                                  handlePropFieldChange(prop.id, 'active', e.target.checked)
                                }
                                disabled={isArchived}
                                className="mr-1"
                              />
                              Active
                            </label>
                            <button
                              onClick={() => handleRemoveProp(prop.id)}
                              disabled={isArchived}
                              className="text-red-600 hover:text-red-800 text-sm disabled:text-gray-400"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              Round
                            </label>
                            <select
                              value={roundKey}
                              onChange={(e) => handlePropFieldChange(prop.id, 'round', e.target.value)}
                              disabled={isArchived}
                              className="w-full px-3 py-2 border rounded"
                            >
                              {roundOptions.map((key) => (
                                <option key={key} value={key}>
                                  {ROUND_DISPLAY_NAMES[key]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              Matchup
                            </label>
                            <select
                              value={prop.matchupIndex || 0}
                              onChange={(e) =>
                                handlePropFieldChange(prop.id, 'matchupIndex', e.target.value)
                              }
                              disabled={isArchived || matchupOptions.length === 0}
                              className="w-full px-3 py-2 border rounded"
                            >
                              {matchupOptions.length === 0 ? (
                                <option value="0">No matchups available</option>
                              ) : (
                                matchupOptions.map((option) => (
                                  <option key={option.index} value={option.index}>
                                    {option.label}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              Prop Line
                            </label>
                            <input
                              type="text"
                              value={prop.line}
                              onChange={(e) => handlePropFieldChange(prop.id, 'line', e.target.value)}
                              disabled={isArchived}
                              placeholder="e.g., Which team scores first?"
                              className="w-full px-3 py-2 border rounded"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Options & Official Result
                          </label>
                          <div className="space-y-2">
                            {options.map((option, idx) => (
                              <div key={`${prop.id}-option-${idx}`} className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name={`official-${prop.id}`}
                                  checked={prop.officialAnswer === option && !!option}
                                  onChange={() => handleOfficialAnswerSelect(prop.id, option)}
                                  disabled={isArchived || !option}
                                />
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => handlePropOptionChange(prop.id, idx, e.target.value)}
                                  disabled={isArchived}
                                  className="flex-1 px-3 py-2 border rounded"
                                  placeholder={`Option ${idx + 1}`}
                                />
                                {options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePropOption(prop.id, idx)}
                                    disabled={isArchived}
                                    className="text-sm text-red-600 disabled:text-gray-400"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => handleAddPropOption(prop.id)}
                              disabled={isArchived}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              + Add option
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isArchived && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSavePropBets}
                    disabled={savingProps}
                    className="px-4 py-2 bg-green-600 text-white rounded flex items-center disabled:bg-gray-400"
                  >
                    {savingProps ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                        Saving Props...
                      </>
                    ) : (
                      <>
                        <FaSave className="mr-2" /> Save Prop Bets
                      </>
                    )}
                  </button>
                </div>
              )}
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
