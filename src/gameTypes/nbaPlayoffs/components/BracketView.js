// src/gameTypes/nbaPlayoffs/components/BracketView.js
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaTrophy, FaEyeSlash, FaLock, FaBasketballBall } from 'react-icons/fa';
import BaseView from '../../common/components/BaseView';
import BracketEditor from './BracketEditor';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Component for viewing an NBA Playoffs bracket in read-only mode
 */
const BracketView = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  initialBracketId = null,
  onBracketSelect = null,
  hideBackButton = false,
  fogOfWarEnabled = false,
  tournamentCompleted = false
}) => {
  // State to store scoring settings
  const [scoringSettings, setScoringSettings] = useState(null);

  // Fetch scoring settings when the league ID changes
  useEffect(() => {
    if (propLeagueId) {
      fetchScoringSettings(propLeagueId);
    }
  }, [propLeagueId]);

  // Function to fetch scoring settings for the league
  const fetchScoringSettings = async (leagueId) => {
    try {
      const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
      const scoringSnap = await getDoc(scoringRef);
      
      if (scoringSnap.exists()) {
        // No standardization needed, data should already use ROUND_KEYS
        const settings = scoringSnap.data();
        setScoringSettings(settings);
        return settings;
      }
      
      setScoringSettings(null);
      return null;
    } catch (error) {
      console.error("Error fetching scoring settings:", error);
      setScoringSettings(null);
      return null;
    }
  };

  // Function to fetch the official tournament bracket
  const fetchOfficialBracket = async (leagueId) => {
    try {
      const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (tournamentSnap.exists()) {
        // No standardization needed, data should already use ROUND_KEYS
        return tournamentSnap.data();
      }
      return null;
    } catch (error) {
      console.error("Error fetching official bracket:", error);
      return null;
    }
  };
  
  // Function to fetch a specific bracket
  const fetchBracketData = async (leagueId, bracketId) => {
    try {
      let bracketRef;
      if (bracketId === 'tournament') {
        // Official tournament bracket
        bracketRef = doc(db, "leagues", leagueId, "gameData", "current");
      } else {
        // User bracket
        bracketRef = doc(db, "leagues", leagueId, "userData", bracketId);
      }
      
      const bracketSnap = await getDoc(bracketRef);
      
      if (bracketSnap.exists()) {
        // No standardization needed, data should already use ROUND_KEYS
        return bracketSnap.data();
      }
      return null;
    } catch (error) {
      console.error(`Error fetching bracket data:`, error);
      return null;
    }
  };
  
  // Function to fetch all brackets
  const fetchBrackets = async (leagueId, leagueData, userId) => {
    try {
      // Start with the official tournament bracket
      const brackets = [
        { id: 'tournament', name: 'Official Tournament', isOfficial: true }
      ];
      
      // Fetch user brackets from userData collection
      const userBracketsRef = collection(db, "leagues", leagueId, "userData");
      const userBracketsSnap = await getDocs(userBracketsRef);
      
      if (userBracketsSnap.size === 0) {
        return brackets;
      }
      
      // Process user data with name lookup
      const userBrackets = await Promise.all(userBracketsSnap.docs.map(async (bracketDoc) => {
        const bracketId = bracketDoc.id;
        let username = "Unknown User";
        
        // Try getting user info directly from the users collection
        try {
          const userRef = doc(db, "users", bracketId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            username = userData.displayName || userData.username || userData.email || "Unknown User";
          } else if (Array.isArray(leagueData?.users)) {
            // Fallback to league data if user doc doesn't exist
            const userEntry = leagueData.users.find(user => {
              return typeof user === 'string' 
                ? user === bracketId 
                : user?.id === bracketId;
            });
            
            if (userEntry && typeof userEntry !== 'string') {
              username = userEntry.displayName || userEntry.username || userEntry.email || "Unknown User";
            }
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
        
        return {
          id: bracketId,
          name: username ? username.trim() : "Unknown User",
          isOfficial: false,
          isCurrentUser: bracketId === userId
        };
      }));
      
      return [...brackets, ...userBrackets];
    } catch (error) {
      console.error("Error fetching brackets:", error);
      return [{ id: 'tournament', name: 'Official Tournament', isOfficial: true }];
    }
  };
  
  // Function to determine if a bracket is visible under fog of war
  const isBracketVisible = (bracket, userId, activeBracketId) => {
    return bracket.isOfficial || bracket.isCurrentUser || bracket.id === activeBracketId;
  };
  
  // Function to determine if the tournament is completed
  const isGameCompleted = (data) => {
    return data?.[ROUND_KEYS.NBA_FINALS]?.winner && data[ROUND_KEYS.NBA_FINALS].winner !== "";
  };
  
  // Component renderers
  const Renderers = {
    // Loading renderer
    Loading: () => (
      <div className="max-w-full sm:max-w-7xl mx-0 sm:mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">    
        <div className="flex flex-col items-center justify-center p-4 sm:p-8">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-indigo-500 mb-3 sm:mb-4"></div>
          <p className="text-gray-600">Loading bracket data...</p>
        </div>
      </div>
    ),

    // Error renderer
    Error: ({ error }) => (
      <div className="bg-red-100 border-0 sm:border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-none sm:rounded mb-4">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    ),

    // Hidden bracket renderer for fog of war
    HiddenBracket: ({ isAdmin, userId, handleEntryChange, officialEntryId }) => (
      <div className="text-center py-6 sm:py-12">
        <FaEyeSlash className="text-4xl sm:text-6xl text-gray-300 mx-auto mb-3 sm:mb-4" />
        <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Bracket Hidden</h3>
        <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base px-2 sm:px-0">
          This bracket is hidden while Fog of War mode is active. You can view the official tournament 
          bracket and your own bracket, but other players' brackets will remain hidden until the playoffs 
          are completed.
          {isAdmin && " As admin, you are also subject to Fog of War to ensure fair play."}
        </p>
        <div className="flex flex-col sm:flex-row justify-center mt-4 sm:mt-6 space-y-2 sm:space-y-0 sm:space-x-4">
          <button
            onClick={() => handleEntryChange(officialEntryId)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            View Official Tournament
          </button>
          {userId && (
            <button
              onClick={() => handleEntryChange(userId)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              View Your Bracket
            </button>
          )}
        </div>
      </div>
    ),

    // Empty bracket state
    EmptyBracket: ({ activeEntryId, officialEntryId }) => (
      <div className="text-center py-6 sm:py-8 text-gray-500">
        {!activeEntryId ? (
          <p>No bracket selected. Please select a bracket to view.</p>
        ) : (
          <div className="flex flex-col items-center">
            <FaLock className="text-3xl sm:text-4xl mb-2 sm:mb-3 text-gray-400" />
            <p className="mb-1">Bracket data not available</p>
            <p className="text-xs sm:text-sm text-gray-400">
              {activeEntryId === officialEntryId 
                ? "The official tournament bracket hasn't been created yet." 
                : "This user hasn't filled out their bracket yet."}
            </p>
          </div>
        )}
      </div>
    ),

    // Bracket selector component
    BracketSelector: ({ entries, activeEntryId, onEntrySelect }) => (
      <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex whitespace-nowrap sm:flex-wrap gap-1 sm:gap-2">
          {entries.length > 1 ? (
            <>
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onEntrySelect(entry.id)}
                  className={`flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded transition text-sm ${
                    activeEntryId === entry.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {entry.isOfficial ? 
                    <FaTrophy className="mr-1 sm:mr-2" /> : 
                    <FaBasketballBall className="mr-1 sm:mr-2" />
                  }
                  <span className="truncate max-w-32 sm:max-w-none">
                    {entry.name}
                    {entry.isCurrentUser ? " (You)" : ""}
                  </span>
                </button>
              ))}
            </>
          ) : (
            <div className="text-gray-500 italic text-sm">
              No user brackets found. Only the official tournament bracket is available.
            </div>
          )}
        </div>
      </div>
    ),
    
    // Bracket view wrapper (read-only mode) - now with scoring settings
    BracketViewWrapper: (props) => (
      <BracketEditor
        {...props}
        isLocked={true}
        scoringSettings={scoringSettings}
      />
    )
  };

  return (
    <BaseView
      isEmbedded={isEmbedded}
      leagueId={propLeagueId}
      initialEntryId={initialBracketId}
      onEntrySelect={onBracketSelect}
      hideBackButton={hideBackButton}
      fogOfWarEnabled={fogOfWarEnabled}
      gameCompleted={tournamentCompleted}
      entryType="Bracket"
      officialEntryId="tournament"
      officialEntryName="Official Tournament"
      fetchOfficialEntry={fetchOfficialBracket}
      fetchEntryData={fetchBracketData}
      fetchEntries={fetchBrackets}
      isEntryVisible={isBracketVisible}
      isGameCompleted={isGameCompleted}
      EntryViewer={Renderers.BracketViewWrapper}
      EntrySelector={Renderers.BracketSelector}
      EmptyEntryRenderer={Renderers.EmptyBracket}
      LoadingRenderer={Renderers.Loading}
      ErrorRenderer={Renderers.Error}
      HiddenEntryRenderer={Renderers.HiddenBracket}
      backPath="/dashboard"
    />
  );
};

export default BracketView;