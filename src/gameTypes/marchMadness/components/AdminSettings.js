// src/gameTypes/marchMadness/components/AdminSettings.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaUpload, FaDownload, FaTrash, FaRedo, FaLock } from 'react-icons/fa';
import BracketEditor from './BracketEditor';


/**
 * Component for tournament administration and settings
 */
const AdminSettings = () => {
  const [tournamentData, setTournamentData] = useState(null);
  const [teamsData, setTeamsData] = useState({
    eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [activeTab, setActiveTab] = useState('teams');
  const [editMode, setEditMode] = useState(false);
  const [isLeagueArchived, setIsLeagueArchived] = useState(false);
  
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const fileInputRef = useRef(null);
  
  // Fetch league and tournament data
  useEffect(() => {
    if (!leagueId || !userId) {
      setError("League ID and user ID are required");
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Check if user is league owner
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        const leagueData = leagueSnap.data();
        setIsOwner(leagueData.ownerId === userId);
        
        // Check if league is archived
        setIsLeagueArchived(leagueData.status === 'archived');
        
        if (leagueData.ownerId !== userId) {
          setError("You don't have permission to access this page");
          setIsLoading(false);
          return;
        }
        
        // Get tournament data
        const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (tournamentSnap.exists()) {
          const data = tournamentSnap.data();
          setTournamentData(data);
          
          // Extract teams data if available
          if (data.SetTeams) {
            setTeamsData(data.SetTeams);
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading tournament data:", err);
        setError("Failed to load tournament data. Please try again.");
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [leagueId, userId]);
  
  // Handle team name change
  const handleTeamNameChange = (region, index, newName) => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    const updatedTeams = { ...teamsData };
    updatedTeams[region][index].name = newName;
    setTeamsData(updatedTeams);
  };
  
  // Move a team up in the seeding
  const handleTeamMoveUp = (region, index) => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (index === 0) return; // Can't move up the top seed
    
    const updatedTeams = { ...teamsData };
    const temp = updatedTeams[region][index - 1].name;
    updatedTeams[region][index - 1].name = updatedTeams[region][index].name;
    updatedTeams[region][index].name = temp;
    
    setTeamsData(updatedTeams);
  };
  
  // Move a team down in the seeding
  const handleTeamMoveDown = (region, index) => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (index === 15) return; // Can't move down the bottom seed
    
    const updatedTeams = { ...teamsData };
    const temp = updatedTeams[region][index + 1].name;
    updatedTeams[region][index + 1].name = updatedTeams[region][index].name;
    updatedTeams[region][index].name = temp;
    
    setTeamsData(updatedTeams);
  };
  
  // Swap team between regions
  const handleTeamSwapRegion = (sourceRegion, targetRegion, index) => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    const updatedTeams = { ...teamsData };
    const temp = updatedTeams[targetRegion][index].name;
    updatedTeams[targetRegion][index].name = updatedTeams[sourceRegion][index].name;
    updatedTeams[sourceRegion][index].name = temp;
    
    setTeamsData(updatedTeams);
  };
  
  // Save tournament changes
  const handleSaveChanges = async () => {
    if (!isOwner || !leagueId) return;
    
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Prepare updated tournament data
      const updatedTournament = {
        ...tournamentData,
        SetTeams: teamsData
      };
      
      // Update rounds if needed based on team changes
      if (editMode) {
        // Recalculate the bracket based on the new teams
        // This would involve fairly complex logic to update the bracket
        // For now, we'll just reset the bracket to empty
        updatedTournament.RoundOf64 = generateInitialRoundOf64(teamsData);
        updatedTournament.RoundOf32 = Array(16).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        }));
        updatedTournament.Sweet16 = Array(8).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        }));
        updatedTournament.Elite8 = Array(4).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        }));
        updatedTournament.FinalFour = Array(2).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        }));
        updatedTournament.Championship = { 
          team1: "", team1Seed: null,
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null
        };
        updatedTournament.Champion = "";
        updatedTournament.ChampionSeed = null;
      }
      
      // Save to Firestore
      await setDoc(doc(db, "leagues", leagueId, "gameData", "current"), updatedTournament);
      
      // Update bracket template for new users
      await createBracketTemplate(leagueId, updatedTournament);
      
      setTournamentData(updatedTournament);
      setFeedback("Tournament settings saved successfully!");
      setEditMode(false);
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error("Error saving tournament data:", err);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Generate initial Round of 64 matchups
  const generateInitialRoundOf64 = (teams) => {
    // Standard NCAA tournament seeding pairs
    const seedPairs = [
      [0, 15], // 1 vs 16
      [7, 8],  // 8 vs 9
      [4, 11], // 5 vs 12
      [3, 12], // 4 vs 13
      [5, 10], // 6 vs 11
      [2, 13], // 3 vs 14
      [6, 9],  // 7 vs 10
      [1, 14]  // 2 vs 15
    ];
    
    // Create matchups for each region
    const eastMatchups = seedPairs.map(([seedIdx1, seedIdx2]) => ({
      team1: teams.eastRegion[seedIdx1].name,
      team1Seed: teams.eastRegion[seedIdx1].seed,
      team2: teams.eastRegion[seedIdx2].name,
      team2Seed: teams.eastRegion[seedIdx2].seed,
      winner: "",
      winnerSeed: null
    }));
    
    const westMatchups = seedPairs.map(([seedIdx1, seedIdx2]) => ({
      team1: teams.westRegion[seedIdx1].name,
      team1Seed: teams.westRegion[seedIdx1].seed,
      team2: teams.westRegion[seedIdx2].name,
      team2Seed: teams.westRegion[seedIdx2].seed,
      winner: "",
      winnerSeed: null
    }));
    
    const midwestMatchups = seedPairs.map(([seedIdx1, seedIdx2]) => ({
      team1: teams.midwestRegion[seedIdx1].name,
      team1Seed: teams.midwestRegion[seedIdx1].seed,
      team2: teams.midwestRegion[seedIdx2].name,
      team2Seed: teams.midwestRegion[seedIdx2].seed,
      winner: "",
      winnerSeed: null
    }));
    
    const southMatchups = seedPairs.map(([seedIdx1, seedIdx2]) => ({
      team1: teams.southRegion[seedIdx1].name,
      team1Seed: teams.southRegion[seedIdx1].seed,
      team2: teams.southRegion[seedIdx2].name,
      team2Seed: teams.southRegion[seedIdx2].seed,
      winner: "",
      winnerSeed: null
    }));
    
    // Combine all regions
    return [...eastMatchups, ...westMatchups, ...midwestMatchups, ...southMatchups];
  };
  
  // Create a bracket template for new users
  const createBracketTemplate = async (leagueId, tournamentData) => {
    try {
      // Create a template with the RoundOf64 matchups but no winners
      const templateData = {
        RoundOf64: tournamentData.RoundOf64.map(matchup => ({
          team1: matchup.team1 || "",
          team1Seed: matchup.team1Seed || null,
          team2: matchup.team2 || "",
          team2Seed: matchup.team2Seed || null,
          winner: "", // No winner
          winnerSeed: null
        })),
        // Empty arrays for other rounds
        RoundOf32: Array(16).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        Sweet16: Array(8).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        Elite8: Array(4).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        FinalFour: Array(2).fill().map(() => ({ 
          team1: "", team1Seed: null, 
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null 
        })),
        Championship: { 
          team1: "", team1Seed: null,
          team2: "", team2Seed: null,
          winner: "", winnerSeed: null
        },
        Champion: "",
        ChampionSeed: null,
        createdAt: new Date().toISOString(),
        isTemplate: true
      };
      
      // Save the template
      await setDoc(doc(db, "leagues", leagueId, "bracketTemplate", "current"), templateData);
      
      return true;
    } catch (error) {
      console.error("Error creating bracket template:", error);
      throw error;
    }
  };
  
  // Handle file upload click
  const handleUploadClick = () => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Handle file selection for team import
  const handleFileUpload = async (e) => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Read file content
      const content = await readFileContent(file);
      
      // Parse file based on extension
      let importedTeams;
      
      if (file.name.endsWith('.csv')) {
        importedTeams = parseCSV(content);
      } else if (file.name.endsWith('.json')) {
        importedTeams = parseJSON(content);
      } else {
        throw new Error("Unsupported file type. Please upload a CSV or JSON file.");
      }
      
      // Update state with imported teams
      setTeamsData(importedTeams);
      setFeedback("Teams imported successfully!");
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error("Error importing teams:", err);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    }
    
    // Reset input
    e.target.value = null;
  };
  
  // Read file content as text
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsText(file);
    });
  };
  
  // Parse CSV file for team import
  const parseCSV = (content) => {
    // Split content into lines and remove empty lines
    const lines = content.split('\n').filter(line => line.trim());
    
    // Check if we have a header row and data
    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and at least one data row.");
    }
    
    // Parse header row
    const header = lines[0].split(',').map(col => col.trim().toLowerCase());
    
    // Verify required columns exist
    const requiredColumns = ['region', 'seed', 'name'];
    const missingColumns = requiredColumns.filter(col => !header.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
    }
    
    // Find column indices
    const regionIndex = header.indexOf('region');
    const seedIndex = header.indexOf('seed');
    const nameIndex = header.indexOf('name');
    
    // Initialize empty teams data
    const teamsData = {
      eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
    };
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(val => val.trim());
      
      if (values.length >= 3) {
        const region = values[regionIndex].toLowerCase();
        const seed = parseInt(values[seedIndex]);
        const seedIndex0Based = seed - 1; // Convert to 0-based index
        const teamName = values[nameIndex];
        
        // Validate seed
        if (isNaN(seed) || seed < 1 || seed > 16) {
          throw new Error(`Invalid seed value in row ${i+1}. Seed must be between 1 and 16.`);
        }
        
        // Map region name to property name
        let regionKey;
        if (region === 'east') regionKey = 'eastRegion';
        else if (region === 'west') regionKey = 'westRegion';
        else if (region === 'midwest') regionKey = 'midwestRegion';
        else if (region === 'south') regionKey = 'southRegion';
        else continue; // Skip invalid regions
        
        // Update team name
        if (teamsData[regionKey] && teamsData[regionKey][seedIndex0Based]) {
          teamsData[regionKey][seedIndex0Based].name = teamName;
        }
      }
    }
    
    return teamsData;
  };
  
  // Parse JSON file for team import
  const parseJSON = (content) => {
    try {
      const data = JSON.parse(content);
      
      // Initialize empty teams data
      const teamsData = {
        eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
        westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
        midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
        southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
      };
      
      // Process each team in the JSON array
      if (Array.isArray(data)) {
        data.forEach(team => {
          if (team.region && team.seed && team.name) {
            const region = team.region.toLowerCase();
            const seed = parseInt(team.seed);
            const seedIndex0Based = seed - 1; // Convert to 0-based index
            
            // Validate seed
            if (isNaN(seed) || seed < 1 || seed > 16) {
              throw new Error(`Invalid seed value ${team.seed}. Seed must be between 1 and 16.`);
            }
            
            // Map region name to property name
            let regionKey;
            if (region === 'east') regionKey = 'eastRegion';
            else if (region === 'west') regionKey = 'westRegion';
            else if (region === 'midwest') regionKey = 'midwestRegion';
            else if (region === 'south') regionKey = 'southRegion';
            else return; // Skip invalid regions
            
            // Update team name
            if (teamsData[regionKey] && teamsData[regionKey][seedIndex0Based]) {
              teamsData[regionKey][seedIndex0Based].name = team.name;
            }
          }
        });
      } else {
        throw new Error("JSON file must contain an array of team objects.");
      }
      
      return teamsData;
    } catch (error) {
      throw new Error(`Error parsing JSON: ${error.message}`);
    }
  };
  
  // Generate a template CSV file for download
  const generateTemplateCSV = () => {
    const csvContent = [
      'Region,Seed,Name',
      'East,1,Team Name',
      'East,2,Team Name',
      'East,3,Team Name',
      '...',
      'West,1,Team Name',
      'West,2,Team Name',
      'West,3,Team Name',
      '...',
      'Midwest,1,Team Name',
      'Midwest,2,Team Name',
      'Midwest,3,Team Name',
      '...',
      'South,1,Team Name',
      'South,2,Team Name',
      'South,3,Team Name',
      '...'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tournament_teams_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Export tournament data as JSON
  const handleExportData = () => {
    if (!tournamentData) return;
    
    // Create a copy of the data to export
    const exportData = {
      ...tournamentData,
      exportedAt: new Date().toISOString(),
    };
    
    // Convert to JSON string with formatting for readability
    const jsonContent = JSON.stringify(exportData, null, 2);
    
    // Create and download the file
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tournament_data_${leagueId}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setFeedback("Tournament data exported successfully!");
    setTimeout(() => setFeedback(''), 3000);
  };
  
  // Clear all team names
  const handleClearAllTeams = () => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (!window.confirm("Are you sure you want to clear all team names? This cannot be undone.")) {
      return;
    }
    
    const emptyTeams = {
      eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
    };
    
    setTeamsData(emptyTeams);
    setFeedback("All team names have been cleared");
    setTimeout(() => setFeedback(''), 3000);
  };
  
  // Reset bracket to empty state
  const handleResetBracket = () => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (!window.confirm("Are you sure you want to reset the entire bracket? This will clear all results. This cannot be undone.")) {
      return;
    }
    
    const updatedTournament = {
      ...tournamentData,
      RoundOf64: generateInitialRoundOf64(teamsData),
      RoundOf32: Array(16).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Sweet16: Array(8).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Elite8: Array(4).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      FinalFour: Array(2).fill().map(() => ({ 
        team1: "", team1Seed: null, 
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null 
      })),
      Championship: { 
        team1: "", team1Seed: null,
        team2: "", team2Seed: null,
        winner: "", winnerSeed: null
      },
      Champion: "",
      ChampionSeed: null
    };
    
    setTournamentData(updatedTournament);
    setFeedback("Bracket has been reset to initial state");
    setTimeout(() => setFeedback(''), 3000);
  };


  // Update the next round when a winner is selected
const updateNextRound = (bracket, currentRound, matchupIndex, winner, winnerSeed) => {
  const roundMapping = {
    'RoundOf64': 'RoundOf32',
    'RoundOf32': 'Sweet16',
    'Sweet16': 'Elite8',
    'Elite8': 'FinalFour',
    'FinalFour': 'Championship'
  };
  
  const nextRound = roundMapping[currentRound];
  if (!nextRound) return; // No next round for Championship
  
  // Special case for Championship
  if (nextRound === 'Championship') {
    // For FinalFour to Championship, we need both winners
    if (currentRound === 'FinalFour') {
      // Get the other FinalFour matchup
      const otherIndex = matchupIndex === 0 ? 1 : 0;
      const otherWinner = bracket.FinalFour[otherIndex]?.winner || '';
      const otherWinnerSeed = bracket.FinalFour[otherIndex]?.winnerSeed || null;
      
      // Update Championship matchup
      if (matchupIndex === 0) {
        bracket.Championship = {
          team1: winner,
          team1Seed: winnerSeed,
          team2: otherWinner,
          team2Seed: otherWinnerSeed,
          winner: '', // Reset winner
          winnerSeed: null
        };
      } else {
        bracket.Championship = {
          team1: otherWinner,
          team1Seed: otherWinnerSeed,
          team2: winner,
          team2Seed: winnerSeed,
          winner: '', // Reset winner
          winnerSeed: null
        };
      }
      
      // Reset Champion
      bracket.Champion = '';
      bracket.ChampionSeed = null;
    }
    
    return;
  }
  
  // For regular rounds
  const nextMatchupIndex = Math.floor(matchupIndex / 2);
  const isFirstTeam = matchupIndex % 2 === 0;
  
  // Ensure next round array exists
  if (!Array.isArray(bracket[nextRound])) {
    bracket[nextRound] = [];
  }
  
  // Ensure the next matchup exists
  if (!bracket[nextRound][nextMatchupIndex]) {
    bracket[nextRound][nextMatchupIndex] = {
      team1: '', team1Seed: null,
      team2: '', team2Seed: null,
      winner: '', winnerSeed: null
    };
  }
  
  // Update the appropriate team in the next matchup
  if (isFirstTeam) {
    bracket[nextRound][nextMatchupIndex].team1 = winner;
    bracket[nextRound][nextMatchupIndex].team1Seed = winnerSeed;
  } else {
    bracket[nextRound][nextMatchupIndex].team2 = winner;
    bracket[nextRound][nextMatchupIndex].team2Seed = winnerSeed;
  }
  
  // Reset winner for the next matchup
  bracket[nextRound][nextMatchupIndex].winner = '';
  bracket[nextRound][nextMatchupIndex].winnerSeed = null;
  
  // Recursively update subsequent rounds
  clearSubsequentRounds(bracket, nextRound, nextMatchupIndex);
};

// Clear all subsequent rounds affected by a change
const clearSubsequentRounds = (bracket, startRound, matchupIndex) => {
  const roundOrder = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
  const startIndex = roundOrder.indexOf(startRound);
  
  // No need to proceed if this is the Championship or an invalid round
  if (startIndex === -1 || startIndex >= roundOrder.length - 1) return;
  
  // Process each subsequent round
  for (let i = startIndex + 1; i < roundOrder.length; i++) {
    const round = roundOrder[i];
    const nextMatchupIndex = Math.floor(matchupIndex / Math.pow(2, i - startIndex));
    
    // For Championship (object, not array)
    if (round === 'Championship') {
      // Only clear Championship if we're affecting one of its feeding matchups
      if (roundOrder[i - 1] === 'FinalFour' && (matchupIndex === 0 || matchupIndex === 1)) {
        bracket.Championship = {
          team1: bracket.Championship.team1 || '',
          team1Seed: bracket.Championship.team1Seed,
          team2: bracket.Championship.team2 || '',
          team2Seed: bracket.Championship.team2Seed,
          winner: '', 
          winnerSeed: null
        };
        bracket.Champion = '';
        bracket.ChampionSeed = null;
      }
    } 
    // For array rounds
    else if (Array.isArray(bracket[round]) && bracket[round][nextMatchupIndex]) {
      // Only clear the winner, not the teams themselves
      if (bracket[round][nextMatchupIndex].winner) {
        bracket[round][nextMatchupIndex].winner = '';
        bracket[round][nextMatchupIndex].winnerSeed = null;
      }
    }
  }
};
  
  // Navigate back to admin dashboard
  const handleBack = () => {
    navigate(`/league/${leagueId}/admin`);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading tournament settings...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition"
          >
            <FaArrowLeft className="mr-2" /> Back to Dashboard
          </button>
        </div>
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition"
          >
            <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
          </button>
          
          <h1 className="text-2xl font-bold">Tournament Settings</h1>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleSaveChanges}
            disabled={isSaving || isLeagueArchived}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaSave className="mr-2" /> {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
      
      {/* Archived League Warning */}
      {isLeagueArchived && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <FaLock className="text-red-500 mr-3 text-xl" />
            <div>
              <h3 className="font-bold text-red-700">League is Archived</h3>
              <p className="text-red-700">
                This league has been archived and cannot be edited. You can view the tournament data but cannot make changes.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Feedback messages */}
      {feedback && (
        <div className={`mb-4 p-3 rounded border ${
          feedback.includes('Error') 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback}
        </div>
      )}
      
      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex flex-wrap -mb-px">
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-2 px-4 font-medium text-sm mr-2 ${
              activeTab === 'teams'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Teams
          </button>
          
          <button
            onClick={() => setActiveTab('bracket')}
            className={`py-2 px-4 font-medium text-sm mr-2 ${
              activeTab === 'bracket'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Bracket
          </button>
          
          <button
            onClick={() => setActiveTab('advanced')}
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'advanced'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Advanced
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="mb-6">
        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div>
            <div className="flex flex-wrap justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Tournament Teams</h2>
              
              <div className="flex flex-wrap gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.json"
                  className="hidden"
                />
                
                <button
                  onClick={handleUploadClick}
                  disabled={isLeagueArchived}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaUpload className="inline mr-2" /> Upload Teams
                </button>
                
                <button
                  onClick={generateTemplateCSV}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                >
                  <FaDownload className="inline mr-2" /> Template
                </button>
                
                <button
                  onClick={() => {
                    if (isLeagueArchived) {
                      setFeedback("This league is archived and cannot be edited.");
                      setTimeout(() => setFeedback(''), 3000);
                      return;
                    }
                    setEditMode(!editMode);
                  }}
                  disabled={isLeagueArchived}
                  className={`px-4 py-2 rounded transition ${
                    editMode 
                      ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                      : "bg-gray-200 hover:bg-gray-300"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {editMode ? "Finish Editing" : "Edit Teams"}
                </button>
                
                <button
                  onClick={handleClearAllTeams}
                  disabled={isLeagueArchived}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTrash className="inline mr-2" /> Clear All
                </button>
              </div>
            </div>
            
            {/* File format info */}
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
              <h3 className="font-bold mb-1">File Upload Format</h3>
              <p className="text-sm mb-2">Upload a CSV or JSON file with the following format:</p>
              <div className="text-sm">
                <p className="font-bold">CSV Format:</p>
                <code className="bg-blue-100 p-1 block mb-2">Region,Seed,Name<br/>East,1,Duke<br/>West,2,Gonzaga<br/>...</code>
                
                <p className="font-bold">JSON Format:</p>
                <code className="bg-blue-100 p-1 block">
                  [<br/>
                  &nbsp;&nbsp;{"{"}"region": "East", "seed": 1, "name": "Duke"{"}"}<br/>
                  &nbsp;&nbsp;{"{"}"region": "West", "seed": 2, "name": "Gonzaga"{"}"}<br/>
                  &nbsp;&nbsp;...<br/>
                  ]
                </code>
              </div>
            </div>
            
            {/* Teams display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* East Region */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-bold mb-3 text-blue-700">East Region</h3>
                <div className="space-y-2">
                  {teamsData.eastRegion.map((team, idx) => (
                    <div key={`east-${idx}`} className="flex items-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700 w-8">{idx + 1}</div>
                      
                      {editMode && !isLeagueArchived ? (
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => handleTeamNameChange('eastRegion', idx, e.target.value)}
                          className="flex-1 mx-2 px-2 py-1 border rounded"
                          placeholder={`Seed #${idx + 1} team`}
                        />
                      ) : (
                        <div className="flex-1 mx-2">{team.name || "TBD"}</div>
                      )}
                      
                      {editMode && !isLeagueArchived && (
                        <div className="flex space-x-2">
                          {idx > 0 && (
                            <button
                              onClick={() => handleTeamMoveUp('eastRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          
                          {idx < 15 && (
                            <button
                              onClick={() => handleTeamMoveDown('eastRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleTeamSwapRegion('eastRegion', 'westRegion', idx)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            title="Move to West"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* West Region */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-bold mb-3 text-red-700">West Region</h3>
                <div className="space-y-2">
                  {teamsData.westRegion.map((team, idx) => (
                    <div key={`west-${idx}`} className="flex items-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700 w-8">{idx + 1}</div>
                      
                      {editMode && !isLeagueArchived ? (
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => handleTeamNameChange('westRegion', idx, e.target.value)}
                          className="flex-1 mx-2 px-2 py-1 border rounded"
                          placeholder={`Seed #${idx + 1} team`}
                        />
                      ) : (
                        <div className="flex-1 mx-2">{team.name || "TBD"}</div>
                      )}
                      
                      {editMode && !isLeagueArchived && (
                        <div className="flex space-x-2">
                          {idx > 0 && (
                            <button
                              onClick={() => handleTeamMoveUp('westRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          
                          {idx < 15 && (
                            <button
                              onClick={() => handleTeamMoveDown('westRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleTeamSwapRegion('westRegion', 'eastRegion', idx)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            title="Move to East"
                          >
                            ←
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Midwest Region */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-bold mb-3 text-yellow-700">Midwest Region</h3>
                <div className="space-y-2">
                  {teamsData.midwestRegion.map((team, idx) => (
                    <div key={`midwest-${idx}`} className="flex items-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700 w-8">{idx + 1}</div>
                      
                      {editMode && !isLeagueArchived ? (
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => handleTeamNameChange('midwestRegion', idx, e.target.value)}
                          className="flex-1 mx-2 px-2 py-1 border rounded"
                          placeholder={`Seed #${idx + 1} team`}
                        />
                      ) : (
                        <div className="flex-1 mx-2">{team.name || "TBD"}</div>
                      )}
                      
                      {editMode && !isLeagueArchived && (
                        <div className="flex space-x-2">
                          {idx > 0 && (
                            <button
                              onClick={() => handleTeamMoveUp('midwestRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          
                          {idx < 15 && (
                            <button
                              onClick={() => handleTeamMoveDown('midwestRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleTeamSwapRegion('midwestRegion', 'southRegion', idx)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            title="Move to South"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* South Region */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-bold mb-3 text-green-700">South Region</h3>
                <div className="space-y-2">
                  {teamsData.southRegion.map((team, idx) => (
                    <div key={`south-${idx}`} className="flex items-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-700 w-8">{idx + 1}</div>
                      
                      {editMode && !isLeagueArchived ? (
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => handleTeamNameChange('southRegion', idx, e.target.value)}
                          className="flex-1 mx-2 px-2 py-1 border rounded"
                          placeholder={`Seed #${idx + 1} team`}
                        />
                      ) : (
                        <div className="flex-1 mx-2">{team.name || "TBD"}</div>
                      )}
                      
                      {editMode && !isLeagueArchived && (
                        <div className="flex space-x-2">
                          {idx > 0 && (
                            <button
                              onClick={() => handleTeamMoveUp('southRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          
                          {idx < 15 && (
                            <button
                              onClick={() => handleTeamMoveDown('southRegion', idx)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleTeamSwapRegion('southRegion', 'midwestRegion', idx)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            title="Move to Midwest"
                          >
                            ←
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Bracket Tab */}
        {activeTab === 'bracket' && (
          <div>
            <div className="flex flex-wrap justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Tournament Bracket</h2>
              
              <div>
                <button
                  onClick={handleResetBracket}
                  disabled={isLeagueArchived}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaRedo className="inline mr-2" /> Reset Bracket
                </button>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Important:</p>
              <p>
                After inputting teams you must reset the bracket to see the changes. 
                Resetting the bracket will clear all results while keeping team configurations. This action cannot be undone.
                Use the bracket editor below to set winners for each matchup. 
              </p>
            </div>
            
        {/* Bracket editor */}
            <div className="bg-white border rounded-lg p-6">
              <BracketEditor 
                bracketData={tournamentData}
                onSelectWinner={(round, matchupIndex, winner, winnerSeed) => {
                  if (isLeagueArchived) {
                    setFeedback("This league is archived and cannot be edited.");
                    setTimeout(() => setFeedback(''), 3000);
                    return;
                  }
                  
                  // Create a copy of tournament data
                  const updatedTournament = { ...tournamentData };
                  
                  // Handle Championship round (object, not array)
                  if (round === 'Championship') {
                    updatedTournament.Championship = {
                      ...updatedTournament.Championship,
                      winner,
                      winnerSeed
                    };
                    updatedTournament.Champion = winner;
                    updatedTournament.ChampionSeed = winnerSeed;
                  } else {
                    // For array rounds
                    if (Array.isArray(updatedTournament[round]) && updatedTournament[round][matchupIndex]) {
                      updatedTournament[round][matchupIndex] = {
                        ...updatedTournament[round][matchupIndex],
                        winner,
                        winnerSeed
                      };
                      
                      // Update next round with this winner
                      updateNextRound(updatedTournament, round, matchupIndex, winner, winnerSeed);
                    }
                  }
                  
                  setTournamentData(updatedTournament);
                }}
                isAdmin={true}
                isLocked={isLeagueArchived}
              />
            </div>
          </div>
        )}
        
        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Advanced Settings</h2>
            
            <div className="bg-white border rounded-lg p-6 mb-4">
              <h3 className="text-lg font-semibold mb-3">Data Management</h3>
              <p className="text-gray-600 mb-4">
                These options allow you to export and import tournament data. Use with caution.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold mb-2">Export Data</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Download the complete tournament data as a JSON file.
                  </p>
                  <button
                    onClick={handleExportData}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    <FaDownload className="inline mr-2" /> Export JSON
                  </button>
                </div>
                
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold mb-2">Reset Bracket</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Clear all results while keeping team configurations.
                  </p>
                  <button
                    onClick={handleResetBracket}
                    disabled={isLeagueArchived}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaRedo className="inline mr-2" /> Reset Bracket
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Danger Zone</h3>
              <p className="text-red-600 mb-4">
                These actions cannot be undone. Use extreme caution.
              </p>
              
              <div className="border border-red-300 rounded-lg p-4 bg-red-50">
                <h4 className="font-semibold mb-2">Clear All Teams</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Remove all team names from all regions. This will also reset the bracket.
                </p>
                <button
                  onClick={handleClearAllTeams}
                  disabled={isLeagueArchived}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTrash className="inline mr-2" /> Clear All Teams
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;