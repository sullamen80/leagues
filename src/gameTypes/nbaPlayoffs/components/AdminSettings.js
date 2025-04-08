// src/gameTypes/nbaPlayoffs/components/AdminSettings/AdminSettings.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaLock } from 'react-icons/fa';
import { 
  ROUND_KEYS, 
  ROUND_DISPLAY_NAMES
} from '../constants/playoffConstants';

// Import panel components
import AdminTeamsPanel from './AdminSettings/AdminTeamsPanel';
import AdminBracketPanel from './AdminSettings/AdminBracketPanel';
import AdminPlayInPanel from './AdminSettings/AdminPlayInPanel';
import AdminAdvancedPanel from './AdminSettings/AdminAdvancePanel';

import BaseAdminSettings from '../../common/components/BaseAdminSettings';

/**
 * Component for NBA Playoffs tournament administration and settings
 * Extends the BaseAdminSettings component with NBA Playoffs-specific functionality
 */
const AdminSettings = () => {
  // Initialize empty teams data
  const getEmptyTeamsData = () => ({
    eastConference: Array(8).fill().map((_, i) => ({ name: "", seed: i + 1, teamId: null, division: null, colors: null })),
    westConference: Array(8).fill().map((_, i) => ({ name: "", seed: i + 1, teamId: null, division: null, colors: null })),
    // Optional Play-In tournament teams (9th and 10th seeds)
    playInEast: Array(4).fill().map((_, i) => ({ name: "", seed: i + 9, teamId: null, division: null, colors: null })),
    playInWest: Array(4).fill().map((_, i) => ({ name: "", seed: i + 9, teamId: null, division: null, colors: null }))
  });

  // Generate initial first round playoff matchups (1v8, 2v7, etc.)
  const generateInitialPlayoffMatchups = (teams) => {
    // Standard NBA Playoffs seeding pairs
    const seedPairs = [
      [0, 7], // 1 vs 8
      [3, 4], // 4 vs 5
      [2, 5], // 3 vs 6
      [1, 6]  // 2 vs 7
    ];
    
    // Create matchups array with both conferences
    const matchups = [
      // Eastern Conference matchups
      ...seedPairs.map(([seedIdx1, seedIdx2]) => ({
        team1: teams.eastConference[seedIdx1].name,
        team1Seed: teams.eastConference[seedIdx1].seed,
        team2: teams.eastConference[seedIdx2].name,
        team2Seed: teams.eastConference[seedIdx2].seed,
        winner: "",
        winnerSeed: null,
        numGames: null,
        conference: 'East'
      })),
      
      // Western Conference matchups
      ...seedPairs.map(([seedIdx1, seedIdx2]) => ({
        team1: teams.westConference[seedIdx1].name,
        team1Seed: teams.westConference[seedIdx1].seed,
        team2: teams.westConference[seedIdx2].name,
        team2Seed: teams.westConference[seedIdx2].seed,
        winner: "",
        winnerSeed: null,
        numGames: null,
        conference: 'West'
      }))
    ];
    
    // Return matchups using the standardized format
    const result = {};
    result[ROUND_KEYS.FIRST_ROUND] = matchups;
    return result;
  };
  
  // Create a bracket template for new users
  const createBracketTemplate = async (leagueId, tournamentData) => {
    try {
      // Create a template with the first round matchups but no winners
      const templateData = {
        // First round
        [ROUND_KEYS.FIRST_ROUND]: (tournamentData[ROUND_KEYS.FIRST_ROUND] || []).map(matchup => ({
          team1: matchup.team1 || "",
          team1Seed: matchup.team1Seed || null,
          team2: matchup.team2 || "",
          team2Seed: matchup.team2Seed || null,
          winner: "", // No winner
          winnerSeed: null,
          numGames: null,
          conference: matchup.conference
        })),
        
        // Conference semifinals
        [ROUND_KEYS.CONF_SEMIS]: Array(4).fill().map((_, i) => ({ 
          team1: "", 
          team1Seed: null, 
          team2: "", 
          team2Seed: null,
          winner: "", 
          winnerSeed: null,
          numGames: null,
          conference: i < 2 ? 'East' : 'West'
        })),
        
        // Conference finals
        [ROUND_KEYS.CONF_FINALS]: Array(2).fill().map((_, i) => ({ 
          team1: "", 
          team1Seed: null,
          team2: "", 
          team2Seed: null,
          winner: "", 
          winnerSeed: null,
          numGames: null,
          conference: i === 0 ? 'East' : 'West'
        })),
        
        // NBA Finals
        [ROUND_KEYS.NBA_FINALS]: { 
          team1: "", 
          team1Seed: null, 
          team1Conference: "East",
          team2: "", 
          team2Seed: null, 
          team2Conference: "West",
          winner: "", 
          winnerSeed: null, 
          winnerConference: "",
          numGames: null,
          predictedMVP: "" // Finals MVP
        },
        
        // Champion and MVP
        [ROUND_KEYS.CHAMPION]: "",
        "ChampionSeed": null,
        [ROUND_KEYS.FINALS_MVP]: "",
        
        createdAt: new Date().toISOString(),
        isTemplate: true,
        
        // Play-In Tournament results (if enabled)
        playInTournamentEnabled: tournamentData.playInTournamentEnabled || false,
        playInComplete: tournamentData.playInComplete || false,
        [ROUND_KEYS.PLAY_IN]: tournamentData[ROUND_KEYS.PLAY_IN] || null
      };
      
      // Save the template
      await setDoc(doc(db, "leagues", leagueId, "bracketTemplate", "current"), templateData);
      
      return true;
    } catch (error) {
      console.error("Error creating bracket template:", error);
      throw error;
    }
  };
  
  // Fetch tournament data
  const fetchTournamentData = async (leagueId, userId, leagueData) => {
    // Get tournament data
    const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
    const tournamentSnap = await getDoc(tournamentRef);
    
    let tournamentData = null;
    let teamsData = getEmptyTeamsData();
    let editMode = false;
    
    if (tournamentSnap.exists()) {
      tournamentData = tournamentSnap.data();
      
      // Extract teams data if available
      if (tournamentData.teamsData) {
        teamsData = tournamentData.teamsData;
      }
    }
    
    return {
      tournamentData,
      teamsData,
      editMode,
      isLeagueArchived: leagueData.status === 'archived'
    };
  };
  
  // Save tournament changes
  const saveTournamentData = async (data, leagueId, userId, setFeedback) => {
    const { tournamentData, teamsData, editMode } = data;
    
    // Create updated tournament data
    const updatedTournament = {
      ...tournamentData,
      teamsData: teamsData
    };
    
    // Only regenerate FirstRound if we're in team setup mode (editMode is true)
    if (editMode) {
      // Generate matchups based on the current team data
      const bracketData = generateInitialPlayoffMatchups(teamsData);
      
      // Use standardized format
      updatedTournament[ROUND_KEYS.FIRST_ROUND] = bracketData[ROUND_KEYS.FIRST_ROUND];
      
      // Reset later rounds if in edit mode
      updatedTournament[ROUND_KEYS.CONF_SEMIS] = Array(4).fill().map((_, i) => ({ 
        team1: "", 
        team1Seed: null, 
        team2: "", 
        team2Seed: null,
        winner: "", 
        winnerSeed: null,
        numGames: null,
        conference: i < 2 ? 'East' : 'West'
      }));
      
      updatedTournament[ROUND_KEYS.CONF_FINALS] = Array(2).fill().map((_, i) => ({ 
        team1: "", 
        team1Seed: null,
        team2: "", 
        team2Seed: null,
        winner: "", 
        winnerSeed: null,
        numGames: null,
        conference: i === 0 ? 'East' : 'West'
      }));
      
      updatedTournament[ROUND_KEYS.NBA_FINALS] = { 
        team1: "", 
        team1Seed: null, 
        team1Conference: "East",
        team2: "", 
        team2Seed: null, 
        team2Conference: "West",
        winner: "", 
        winnerSeed: null, 
        winnerConference: "",
        numGames: null,
        predictedMVP: "" // Finals MVP
      };
      
      updatedTournament[ROUND_KEYS.CHAMPION] = "";
      updatedTournament.ChampionSeed = null;
      updatedTournament[ROUND_KEYS.FINALS_MVP] = "";
    }
    
    // Add Play-In Tournament data if enabled
    if (updatedTournament.playInTournamentEnabled) {
      // Initialize ROUND_KEYS.PLAY_IN if not present
      if (!updatedTournament[ROUND_KEYS.PLAY_IN]) {
        updatedTournament[ROUND_KEYS.PLAY_IN] = {
          east: {
            seventhEighthWinner: { team: "", seed: null },
            ninthTenthWinner: { team: "", seed: null },
            finalWinner: { team: "", seed: null },
            loserTeam: { team: "", seed: null },
            winnerTeam: { team: "", seed: null }
          },
          west: {
            seventhEighthWinner: { team: "", seed: null },
            ninthTenthWinner: { team: "", seed: null },
            finalWinner: { team: "", seed: null },
            loserTeam: { team: "", seed: null },
            winnerTeam: { team: "", seed: null }
          }
        };
      }
    } else {
      // Remove Play-In data if disabled
      delete updatedTournament[ROUND_KEYS.PLAY_IN];
    }
    
    // Add timestamp
    updatedTournament.lastUpdated = new Date().toISOString();
    
    // Save to Firestore
    await setDoc(doc(db, "leagues", leagueId, "gameData", "current"), updatedTournament);
    
    // Update bracket template for new users
    await createBracketTemplate(leagueId, updatedTournament);
    
    return updatedTournament;
  };
  
  // Define tabs for the settings interface
  const tabs = [
    {
      id: 'teams',
      title: 'Teams',
      panel: (
        <AdminTeamsPanel 
          generateInitialPlayoffMatchups={generateInitialPlayoffMatchups}
          getEmptyTeamsData={getEmptyTeamsData}
        />
      )
    },
    {
      id: 'bracket',
      title: 'Bracket',
      panel: (
        <AdminBracketPanel 
          generateInitialPlayoffMatchups={generateInitialPlayoffMatchups}
        />
      )
    },
    {
      id: 'play-in',
      title: 'Play-In',
      panel: (
        <AdminPlayInPanel />
      )
    },
    {
      id: 'advanced',
      title: 'Advanced',
      panel: (
        <AdminAdvancedPanel 
          generateInitialPlayoffMatchups={generateInitialPlayoffMatchups}
          getEmptyTeamsData={getEmptyTeamsData}
        />
      )
    }
  ];
  
  // Handle the case where BaseAdminSettings might not be available
  if (!BaseAdminSettings) {
    console.error('BaseAdminSettings component not found');
    
    // Fallback to a simple UI when BaseAdminSettings is not available
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 p-4 rounded mb-6">
          <p className="font-bold">Notice</p>
          <p>The base admin settings component couldn't be loaded. Using standalone mode.</p>
        </div>
        
        {/* Minimal standalone implementation */}
        <div>
          <p>Settings for NBA Playoffs will appear here.</p>
          <p>Please check your console for error details.</p>
        </div>
      </div>
    );
  }
  
  // If BaseAdminSettings is available, use it
  return (
    <BaseAdminSettings
      gameType="nbaPlayoffs"
      tabs={tabs}
      defaultTab="teams"
      fetchData={fetchTournamentData}
      saveChanges={saveTournamentData}
      canSave={(data) => !data?.isLeagueArchived}
      pageTitle="NBA Playoffs Settings"
    />
  );
};

export default AdminSettings;