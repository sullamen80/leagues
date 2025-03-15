import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaLock } from 'react-icons/fa';

// Import panel components
import AdminTeamsPanel from './AdminSettingsPanels/AdminTeamsPanel';
import AdminBracketPanel from './AdminSettingsPanels/AdminBracketPanel';
import AdminAdvancedPanel from './AdminSettingsPanels/AdminAdvancedPanel';

import BaseAdminSettings from '../../common/components/BaseAdminSettings';

/**
 * Component for March Madness tournament administration and settings
 * Extends the BaseAdminSettings component with game-specific functionality
 */
const AdminSettings = () => {
  // Initialize empty teams data
  const getEmptyTeamsData = () => ({
    eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
    southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
  });

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
      if (tournamentData.SetTeams) {
        teamsData = tournamentData.SetTeams;
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
    
    // Prepare updated tournament data
    const updatedTournament = {
      ...tournamentData,
      SetTeams: teamsData
    };
    
    // Update rounds if needed based on team changes
    if (editMode) {
      // Recalculate the bracket based on the new teams
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
    
    return updatedTournament;
  };
  
  // Define tabs for the settings interface
  const tabs = [
    {
      id: 'teams',
      title: 'Teams',
      panel: (
        <AdminTeamsPanel 
          generateInitialRoundOf64={generateInitialRoundOf64}
          getEmptyTeamsData={getEmptyTeamsData}
        />
      )
    },
    {
      id: 'bracket',
      title: 'Bracket',
      panel: (
        <AdminBracketPanel 
          generateInitialRoundOf64={generateInitialRoundOf64}
        />
      )
    },
    {
      id: 'advanced',
      title: 'Advanced',
      panel: (
        <AdminAdvancedPanel 
          generateInitialRoundOf64={generateInitialRoundOf64}
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
          <p>Settings for March Madness tournament will appear here.</p>
          <p>Please check your console for error details.</p>
        </div>
      </div>
    );
  }
  
  // If BaseAdminSettings is available, use it
  return (
    <BaseAdminSettings
      gameType="marchMadness"
      tabs={tabs}
      defaultTab="teams"
      fetchData={fetchTournamentData}
      saveChanges={saveTournamentData}
      canSave={(data) => !data?.isLeagueArchived}
      pageTitle="Tournament Settings"
    />
  );
};

export default AdminSettings;