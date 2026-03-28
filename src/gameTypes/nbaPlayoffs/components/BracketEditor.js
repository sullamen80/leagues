import React, { useState, useEffect, useRef } from 'react';
import { FaTrophy, FaInfoCircle, FaMedal } from 'react-icons/fa';
import Matchup from './Matchup';
import MVPSelector from './MVPSelector';
import { 
  ROUND_KEYS, 
  ROUND_DISPLAY_NAMES
} from '../constants/playoffConstants';

/**
 * NBA Playoffs bracket editor component
 * Modified to work with the standardized Firebase data structure
 * Dark mode friendly version
 */
const BracketEditor = ({ 
  bracketData, 
  onSeriesPrediction,
  onMVPSelect,
  isAdmin = false, 
  isLocked = false,
  officialBracket = null,
  hasPlayInTournament = false,
  mvpPredictionMode = false,
  scoringSettings = null,
  teamPlayers = {},
  officialMVP = null 
}) => {
  // Initialize state for the bracket using the standardized format
  const [processedData, setProcessedData] = useState({
    [ROUND_KEYS.FIRST_ROUND]: [],
    [ROUND_KEYS.CONF_SEMIS]: [],
    [ROUND_KEYS.CONF_FINALS]: [],
    [ROUND_KEYS.NBA_FINALS]: null,
    [ROUND_KEYS.CHAMPION]: '',
    ChampionSeed: null,
    [ROUND_KEYS.FINALS_MVP]: ''
  });

  // State to track pending selections (team selected but not yet confirmed with games)
  const [pendingSelections, setPendingSelections] = useState({
    // Format: { roundKey-index: { winner, winnerSeed, conference, round, index } }
  });
  
  // Track bracket data reference for change detection
  const prevBracketDataRef = useRef(null);
  
  // Track all local changes we've made
  const localChangesRef = useRef({});
  
  
  // Process the incoming bracket data on changes
  useEffect(() => {
    if (!bracketData) return;
    
    // Create a processed version of the data using only standardized format
    const processed = {
      [ROUND_KEYS.FIRST_ROUND]: bracketData[ROUND_KEYS.FIRST_ROUND] || [],
      [ROUND_KEYS.CONF_SEMIS]: bracketData[ROUND_KEYS.CONF_SEMIS] || [],
      [ROUND_KEYS.CONF_FINALS]: bracketData[ROUND_KEYS.CONF_FINALS] || [],
      [ROUND_KEYS.NBA_FINALS]: bracketData[ROUND_KEYS.NBA_FINALS] || null,
      [ROUND_KEYS.CHAMPION]: bracketData[ROUND_KEYS.CHAMPION] || '',
      ChampionSeed: bracketData.ChampionSeed || null,
      [ROUND_KEYS.FINALS_MVP]: bracketData[ROUND_KEYS.FINALS_MVP] || ''
    };
    
    // Apply all our local changes on top of the incoming data
    const localChanges = localChangesRef.current;
    Object.entries(localChanges).forEach(([key, change]) => {
      const { round, index, winner, winnerSeed, numGames } = change;
      
      if (
        (round === ROUND_KEYS.FIRST_ROUND || 
        round === ROUND_KEYS.CONF_SEMIS || 
        round === ROUND_KEYS.CONF_FINALS) && 
        processed[round][index]
      ) {
        processed[round][index].winner = winner;
        processed[round][index].winnerSeed = winnerSeed;
        processed[round][index].numGames = numGames;
      }
      else if (round === ROUND_KEYS.NBA_FINALS && processed[ROUND_KEYS.NBA_FINALS]) {
        processed[ROUND_KEYS.NBA_FINALS].winner = winner;
        processed[ROUND_KEYS.NBA_FINALS].winnerSeed = winnerSeed;
        processed[ROUND_KEYS.NBA_FINALS].numGames = numGames;
      }
    });
    
    setProcessedData(processed);
  }, [bracketData]);
  
  // Get the champion name
  const getChampionName = () => {
    if (processedData[ROUND_KEYS.CHAMPION]) {
      return processedData[ROUND_KEYS.CHAMPION];
    } else if (processedData[ROUND_KEYS.NBA_FINALS] && processedData[ROUND_KEYS.NBA_FINALS].winner) {
      return processedData[ROUND_KEYS.NBA_FINALS].winner;
    }
    return "";
  };
  
  // Get the Finals MVP
  const getFinalsMVP = () => {
    if (processedData[ROUND_KEYS.FINALS_MVP]) {
      return processedData[ROUND_KEYS.FINALS_MVP];
    } else if (processedData[ROUND_KEYS.NBA_FINALS] && processedData[ROUND_KEYS.NBA_FINALS].mvp) {
      return processedData[ROUND_KEYS.NBA_FINALS].mvp;
    }
    return "";
  };
  
  // Check if a team has valid data (from the original data in Firebase)
  const hasValidTeam = (matchup) => {
    // More thorough validation for teams
    if (!matchup) return false;
    
    // Check for team names
    if (matchup.team1 || matchup.team2) {
      return true;
    }
    
    // Check for team seeds
    if ((matchup.team1Seed !== null && matchup.team1Seed !== undefined) || 
        (matchup.team2Seed !== null && matchup.team2Seed !== undefined)) {
      return true;
    }
    
    // No valid team data found
    return false;
  };
  
  // Attempt to get team data from various sources
  const getTeamName = (matchup, teamKey) => {
    if (!matchup) return "";
    
    // Check if team name exists directly
    if (matchup[teamKey] && matchup[teamKey].trim() !== "") {
      return matchup[teamKey];
    }
    
    // If we only have seed info, create a placeholder name
    const seedKey = `${teamKey}Seed`;
    if (matchup[seedKey] !== null && matchup[seedKey] !== undefined) {
      // Use conference if available
      if (matchup.conference) {
        return `${matchup.conference} #${matchup[seedKey]} Seed`;
      }
      return `#${matchup[seedKey]} Seed`;
    }
    
    return "";
  };
  
  // Handle series prediction - only called after both team and games are selected
  const handleSeriesPrediction = (round, index, winner, winnerSeed, numGames, mvp = null) => {
    if (isLocked || !onSeriesPrediction) return;
    
    // Make sure we have both a winner and numGames
    if (!winner || !numGames) {
      console.log("Missing winner or numGames, cannot complete prediction");
      return;
    }
    
    
    // Store this change in our local changes ref
    const changeKey = `${round}-${index}`;
    localChangesRef.current[changeKey] = {
      round, index, winner, winnerSeed, numGames
    };
    
    // IMPORTANT: Also update our local state to reflect the change immediately
    updateLocalState(round, index, winner, winnerSeed, numGames);
    
    // This is calling the parent component's function
    onSeriesPrediction(round, index, winner, winnerSeed, numGames, mvp);
  };

  // Update local state to reflect changes immediately
  const updateLocalState = (round, index, winner, winnerSeed, numGames) => {
    // Create a deep copy of the processed data
    const updatedData = JSON.parse(JSON.stringify(processedData));
    
    // Update the appropriate part of the data
    if ((round === ROUND_KEYS.FIRST_ROUND || round === ROUND_KEYS.CONF_SEMIS || round === ROUND_KEYS.CONF_FINALS) && 
        updatedData[round][index]) {
      updatedData[round][index].winner = winner;
      updatedData[round][index].winnerSeed = winnerSeed;
      updatedData[round][index].numGames = numGames;
    }
    else if (round === ROUND_KEYS.NBA_FINALS && updatedData[ROUND_KEYS.NBA_FINALS]) {
      updatedData[ROUND_KEYS.NBA_FINALS].winner = winner;
      updatedData[ROUND_KEYS.NBA_FINALS].winnerSeed = winnerSeed;
      updatedData[ROUND_KEYS.NBA_FINALS].numGames = numGames;
      
      // Also update Champion
      updatedData[ROUND_KEYS.CHAMPION] = winner;
      updatedData.ChampionSeed = winnerSeed;
    }
    
    // Update the state to reflect changes immediately
    setProcessedData(updatedData);
  };
  
  // Handle MVP selection
  const handleMVPSelect = (mvp) => {
    if (!isLocked && onMVPSelect) {
      onMVPSelect(mvp);
      
      // Update local state
      setProcessedData(prev => ({
        ...prev,
        [ROUND_KEYS.FINALS_MVP]: mvp,
        [ROUND_KEYS.NBA_FINALS]: prev[ROUND_KEYS.NBA_FINALS] ? {
          ...prev[ROUND_KEYS.NBA_FINALS],
          mvp: mvp
        } : null
      }));
    }
  };
  
  // Handle winner selection - now just stores as pending
  const handleWinnerSelect = (round, index, winner, winnerSeed) => {
    if (isLocked) return;
    
    
    // Create a unique key for this matchup
    const matchupKey = `${round}-${index}`;
    
    // Store the pending winner selection but don't advance them yet
    setPendingSelections({
      ...pendingSelections,
      [matchupKey]: {
        winner,
        winnerSeed,
        round,
        index
      }
    });
  };
  
  // Handle games selection - now finalizes the winner selection
  const handleGamesSelect = (round, index, numGames) => {
    if (isLocked) return;
    
    
    // Create a unique key for this matchup
    const matchupKey = `${round}-${index}`;
    
    // Check if we have a pending winner selection for this matchup
    const pendingSelection = pendingSelections[matchupKey];
    
    if (pendingSelection) {
      console.log("Found pending selection:", pendingSelection);
      // We have both winner and games now, so finalize the selection
      const { winner, winnerSeed } = pendingSelection;
      
      // Call the full prediction handler to advance the team
      handleSeriesPrediction(round, index, winner, winnerSeed, numGames);
      
      // Clear the pending selection
      const updatedPendingSelections = { ...pendingSelections };
      delete updatedPendingSelections[matchupKey];
      setPendingSelections(updatedPendingSelections);
    } else {
      // If there's an existing winner already set (from a previous selection)
      // allow updating just the game count
      let matchup;
      if (round === ROUND_KEYS.FIRST_ROUND || round === ROUND_KEYS.CONF_SEMIS || round === ROUND_KEYS.CONF_FINALS) {
        matchup = processedData[round][index];
      } else if (round === ROUND_KEYS.NBA_FINALS) {
        matchup = processedData[ROUND_KEYS.NBA_FINALS];
      }
      
      // Only update if we have a winner already selected
      if (matchup && matchup.winner) {
        handleSeriesPrediction(
          round,
          index,
          matchup.winner,
          matchup.winnerSeed,
          numGames,
          matchup.mvp
        );
      }
    }
  };
  
  // Render a matchup for a specific round
  const renderMatchup = (round, index, matchup) => {
    if (!matchup) return null;
    
    // Create a unique key for this matchup
    const matchupKey = `${round}-${index}`;
    
    // Check if there's a pending selection for this matchup
    const pendingSelection = pendingSelections[matchupKey];
    
    // Get proper team names (or placeholders)
    const enhancedMatchup = {
      ...matchup,
      team1: getTeamName(matchup, 'team1'),
      team2: getTeamName(matchup, 'team2')
    };
    
    // Don't render empty matchups where neither team is set
    if (!hasValidTeam(matchup)) {
      return (
        <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          Awaiting teams...
        </div>
      );
    }
    
    // Get the matchup display title
    const matchupTitle = getMatchupTitle(round, index, matchup.conference);
    
    // Get the official result for comparison if available
    let officialResult = null;
    if (officialBracket && officialBracket[round] && officialBracket[round][index]) {
      officialResult = officialBracket[round][index];
    } else if (round === ROUND_KEYS.NBA_FINALS && officialBracket && officialBracket[ROUND_KEYS.NBA_FINALS]) {
      officialResult = officialBracket[ROUND_KEYS.NBA_FINALS];
    }
    
    return (
      <div className="mb-4">
        <Matchup
          matchup={enhancedMatchup}
          scoringSettings={scoringSettings}
          onWinnerSelect={(winner, winnerSeed) => 
            handleWinnerSelect(round, index, winner, winnerSeed)
          }
          onGamesSelect={(numGames) => 
            handleGamesSelect(round, index, numGames)
          }
          isLocked={isLocked}
          showSeed={true}
          className=""
          roundKey={round}
          officialResult={officialResult}
          pendingSelection={pendingSelection ? {
            teamName: pendingSelection.winner,
            teamSeed: pendingSelection.winnerSeed
          } : null}
        />
      </div>
    );
  };
  
  // Get a display title for a matchup
  const getMatchupTitle = (round, index, conference) => {
    if (round === ROUND_KEYS.FIRST_ROUND) {
      return `${conference} ${ROUND_DISPLAY_NAMES[ROUND_KEYS.FIRST_ROUND]} - Game ${index % 4 + 1}`;
    } else if (round === ROUND_KEYS.CONF_SEMIS) {
      return `${conference} ${ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_SEMIS]} - Game ${index % 2 + 1}`;
    } else if (round === ROUND_KEYS.CONF_FINALS) {
      return `${conference} ${ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_FINALS]}`;
    } else if (round === ROUND_KEYS.NBA_FINALS) {
      return ROUND_DISPLAY_NAMES[ROUND_KEYS.NBA_FINALS];
    }
    return '';
  };
  
  // Get style information for a conference
  const getConferenceStyle = (conference) => {
    if (conference === 'East') {
      return {
        title: 'Eastern Conference',
        textColor: 'text-blue-800 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900',
        borderColor: 'border-blue-200 dark:border-blue-700'
      };
    } else {
      return {
        title: 'Western Conference',
        textColor: 'text-red-800 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900',
        borderColor: 'border-red-200 dark:border-red-700'
      };
    }
  };
  
  // Render the first round section
  const renderFirstRound = () => {
    // Filter FirstRound data by conference
    const firstRoundEast = processedData[ROUND_KEYS.FIRST_ROUND].filter(m => m.conference === 'East');
    const firstRoundWest = processedData[ROUND_KEYS.FIRST_ROUND].filter(m => m.conference === 'West');
    
    const eastStyle = getConferenceStyle('East');
    const westStyle = getConferenceStyle('West');
    
    const hasEastMatchups = firstRoundEast.length > 0 && 
                          firstRoundEast.some(hasValidTeam);
                          
    const hasWestMatchups = firstRoundWest.length > 0 && 
                          firstRoundWest.some(hasValidTeam);
    
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.FIRST_ROUND]}
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Eastern Conference */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${eastStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${eastStyle.textColor}`}>
              {eastStyle.title}
            </h4>
            
            <div className="space-y-3">
              {hasEastMatchups ? 
                firstRoundEast.map((matchup, i) => {
                  // Find original index in the full FirstRound array
                  const originalIndex = processedData[ROUND_KEYS.FIRST_ROUND].findIndex(
                    m => m.conference === 'East' && 
                    m.team1Seed === matchup.team1Seed && 
                    m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`east-first-${i}`}>
                      {renderMatchup(ROUND_KEYS.FIRST_ROUND, originalIndex, matchup)}
                    </div>
                  );
                }) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  No matchups set for Eastern Conference
                </div>
              )}
            </div>
          </div>
          
          {/* Western Conference */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${westStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${westStyle.textColor}`}>
              {westStyle.title}
            </h4>
            
            <div className="space-y-3">
              {hasWestMatchups ? 
                firstRoundWest.map((matchup, i) => {
                  // Find original index in the full FirstRound array
                  const originalIndex = processedData[ROUND_KEYS.FIRST_ROUND].findIndex(
                    m => m.conference === 'West' && 
                    m.team1Seed === matchup.team1Seed && 
                    m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`west-first-${i}`}>
                      {renderMatchup(ROUND_KEYS.FIRST_ROUND, originalIndex, matchup)}
                    </div>
                  );
                }) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  No matchups set for Western Conference
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the conference semifinals (second round)
  const renderConferenceSemis = () => {
    // Filter ConferenceSemis data by conference
    const secondRoundEast = processedData[ROUND_KEYS.CONF_SEMIS].filter(m => m.conference === 'East');
    const secondRoundWest = processedData[ROUND_KEYS.CONF_SEMIS].filter(m => m.conference === 'West');
    
    const eastStyle = getConferenceStyle('East');
    const westStyle = getConferenceStyle('West');
    
    const hasEastMatchups = secondRoundEast.length > 0 && 
                          secondRoundEast.some(hasValidTeam);
                          
    const hasWestMatchups = secondRoundWest.length > 0 && 
                          secondRoundWest.some(hasValidTeam);
    
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_SEMIS]}
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Eastern Conference */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${eastStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${eastStyle.textColor}`}>
              {eastStyle.title}
            </h4>
            
            <div className="space-y-3">
              {hasEastMatchups ? 
                secondRoundEast.map((matchup, i) => {
                  // Find original index in the full ConferenceSemis array
                  const originalIndex = processedData[ROUND_KEYS.CONF_SEMIS].findIndex(
                    m => m.conference === 'East' && 
                    m.team1Seed === matchup.team1Seed && 
                    m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`east-second-${i}`}>
                      {renderMatchup(ROUND_KEYS.CONF_SEMIS, originalIndex, matchup)}
                    </div>
                  );
                }) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete first round to reveal conference semifinals
                </div>
              )}
            </div>
          </div>
          
          {/* Western Conference */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${westStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${westStyle.textColor}`}>
              {westStyle.title}
            </h4>
            
            <div className="space-y-3">
              {hasWestMatchups ? 
                secondRoundWest.map((matchup, i) => {
                  // Find original index in the full ConferenceSemis array
                  const originalIndex = processedData[ROUND_KEYS.CONF_SEMIS].findIndex(
                    m => m.conference === 'West' && 
                    m.team1Seed === matchup.team1Seed && 
                    m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`west-second-${i}`}>
                      {renderMatchup(ROUND_KEYS.CONF_SEMIS, originalIndex, matchup)}
                    </div>
                  );
                }) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete first round to reveal conference semifinals
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the conference finals
  const renderConferenceFinals = () => {
    // Find East and West finals from ConferenceFinals array
    const eastFinal = processedData[ROUND_KEYS.CONF_FINALS].find(m => m.conference === 'East');
    const westFinal = processedData[ROUND_KEYS.CONF_FINALS].find(m => m.conference === 'West');
    
    const eastStyle = getConferenceStyle('East');
    const westStyle = getConferenceStyle('West');
    
    const hasEastFinal = eastFinal && hasValidTeam(eastFinal);
    const hasWestFinal = westFinal && hasValidTeam(westFinal);
    
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_FINALS]}
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Eastern Conference */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${eastStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${eastStyle.textColor}`}>
              {eastStyle.title}
            </h4>
            
            <div className="space-y-3">
              {hasEastFinal ? (
                renderMatchup(
                  ROUND_KEYS.CONF_FINALS, 
                  processedData[ROUND_KEYS.CONF_FINALS].findIndex(m => m.conference === 'East'),
                  eastFinal
                )
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete semifinals to reveal conference finals
                </div>
              )}
            </div>
          </div>
          
          {/* Western Conference */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${westStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${westStyle.textColor}`}>
              {westStyle.title}
            </h4>
            
            <div className="space-y-3">
              {hasWestFinal ? (
                renderMatchup(
                  ROUND_KEYS.CONF_FINALS, 
                  processedData[ROUND_KEYS.CONF_FINALS].findIndex(m => m.conference === 'West'),
                  westFinal
                )
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete semifinals to reveal conference finals
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the NBA Finals
  const renderNBAFinals = () => {
    const finals = processedData[ROUND_KEYS.NBA_FINALS];
    const hasFinals = finals && hasValidTeam(finals);
    
    if (!hasFinals) {
      return (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
            {ROUND_DISPLAY_NAMES[ROUND_KEYS.NBA_FINALS]}
          </h3>
          <div className="max-w-lg mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-red-50 dark:from-blue-900 dark:to-red-900 p-6 rounded-lg shadow-md border border-amber-200 dark:border-amber-700">
              <h4 className="text-xl font-bold mb-4 text-center text-amber-900 text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <FaTrophy className="inline-block mr-2 text-amber-500 dark:text-grey-300 " />
                NBA Championship
              </h4>
              <div className="text-center text-gray-500 dark:text-gray-300 p-4">
                Awaiting Conference Finals winners...
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Get proper team names for finals
    const enhancedFinals = {
      ...finals,
      team1: getTeamName(finals, 'team1'),
      team2: getTeamName(finals, 'team2')
    };
    
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.NBA_FINALS]}
        </h3>
        <div className="max-w-lg mx-auto">
          <div className="bg-gradient-to-r from-blue-50 to-red-50 dark:from-blue-900 dark:to-red-900 p-6 rounded-lg shadow-md border border-amber-200 dark:border-amber-700">
            <h4 className="text-xl font-bold mb-4 text-center text-gray-700 dark:text-amber-300 pb-2 border-b border-amber-200 dark:border-amber-700">
              <FaTrophy className="inline-block mr-2 text-gray-500  " />
              NBA Championship
            </h4>
            
            {renderMatchup(ROUND_KEYS.NBA_FINALS, 0, enhancedFinals)}
          </div>
        </div>
      </div>
    );
  };
  
  // Render the champion display
  const renderChampion = () => {
    const champion = getChampionName();
    if (!champion) return null;
    
    return (
      <div className="mt-8 bg-amber-50 dark:bg-amber-900 p-4 rounded-lg border border-amber-200 dark:border-amber-700 text-center">
        <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-amber-300">
          <FaTrophy className="inline-block mr-2 text-gray-500" />
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.CHAMPION]}
        </h3>
        <div className="text-2xl font-bold text-gray-700 dark:text-amber-200">{champion}</div>
      </div>
    );
  };
  
  // Render the MVP prediction section
  const renderMVPPrediction = () => {
    const mvp = getFinalsMVP();
    const hasFinals = processedData[ROUND_KEYS.NBA_FINALS] && hasValidTeam(processedData[ROUND_KEYS.NBA_FINALS]);
    
    if (!hasFinals && !mvpPredictionMode) {
      return null;
    }
    
    // Get the finalist teams for the MVP selector
    const finalistTeams = [];
    if (hasFinals) {
      if (processedData[ROUND_KEYS.NBA_FINALS].team1) {
        finalistTeams.push(getTeamName(processedData[ROUND_KEYS.NBA_FINALS], 'team1'));
      }
      if (processedData[ROUND_KEYS.NBA_FINALS].team2) {
        finalistTeams.push(getTeamName(processedData[ROUND_KEYS.NBA_FINALS], 'team2'));
      }
    }
    
    return (
      <div className="mt-8 bg-amber-50 dark:bg-amber-900 p-6 rounded-lg border border-amber-200 dark:border-amber-700">
      <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-amber-300 text-center">
        <FaMedal className="inline-block mr-2" />
        {ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} Prediction
      </h3>
        
        <MVPSelector
          selectedMVP={mvp}
          onSelect={handleMVPSelect}
          finalistsTeams={finalistTeams}
          disabled={isLocked}
          officialMVP={officialMVP} 
          teamPlayers={teamPlayers} 
        />
      </div>
    );
  };
  
  // Simplified view for MVP prediction mode
  if (mvpPredictionMode) {
    return (
      <div className="bracket-editor overflow-x-auto">
        <div className="max-w-2xl mx-auto">
          {renderMVPPrediction()}
          
          {isLocked && (
            <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 p-3 rounded mt-4">
              <div className="flex items-center">
                <FaInfoCircle className="mr-2" />
                <span>{ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} predictions are now locked</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Full bracket editor view
  return (
    <div className="playoffs-bracket-editor overflow-x-auto">
      {!bracketData ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No bracket data available</p>
        </div>
      ) : (
        <div className="space-y-12">          
          {/* Regular playoffs rounds */}
          {renderFirstRound()}
          {renderConferenceSemis()}
          {renderConferenceFinals()}
          {renderNBAFinals()}
          
          {/* Champion display */}
          {renderChampion()}
          
          {/* MVP Prediction */}
          {renderMVPPrediction()}
        </div>
      )}
      
      {isLocked && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 p-3 rounded mt-4">
          <div className="flex items-center">
            <FaInfoCircle className="mr-2" />
            <span>This bracket is locked and cannot be edited</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BracketEditor;