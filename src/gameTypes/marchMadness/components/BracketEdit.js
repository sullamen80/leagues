// src/gameTypes/marchMadness/components/BracketEdit.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaUndo, FaInfoCircle } from 'react-icons/fa';
import BracketEditor from './BracketEditor';

/**
 * Component for editing a user's bracket
 */
const BracketEdit = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false
}) => {
  const [tournamentData, setTournamentData] = useState(null);
  const [userBracket, setUserBracket] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Use either the prop leagueId or the one from useParams
  const params = useParams();
  const navigate = useNavigate();
  const leagueId = propLeagueId || params.leagueId;
  const userId = auth.currentUser?.uid;
  
  // Fetch tournament data and lock status
  useEffect(() => {
    if (!leagueId || !userId) {
      setError("You must be logged in to edit a bracket");
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        console.log("Fetching data for league:", leagueId, "user:", userId);
        
        // Get league data to check lock status
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        // Check lock status from locks subcollection
        try {
          const locksRef = doc(db, "leagues", leagueId, "locks", "lockStatus");
          const locksSnap = await getDoc(locksRef);
          
          if (locksSnap.exists()) {
            const lockData = locksSnap.data();
            // If RoundOf64 is locked, the entire bracket is locked
            if (lockData.RoundOf64?.locked) {
              setIsLocked(true);
              console.log("Bracket is locked");
            }
          }
        } catch (lockErr) {
          console.error('Error fetching lock status:', lockErr);
          // Continue anyway - assume not locked
        }
        
        // Get tournament data (will be used as template for new brackets)
        const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (tournamentSnap.exists()) {
          const data = tournamentSnap.data();
          setTournamentData(data);
          console.log("Tournament data loaded");
          
          // Get user's bracket if it exists
          const userBracketRef = doc(db, "leagues", leagueId, "userData", userId);
          const userBracketSnap = await getDoc(userBracketRef);
          
          if (userBracketSnap.exists()) {
            setUserBracket(userBracketSnap.data());
            console.log("User bracket loaded");
          } else {
            console.log("Creating new bracket from template");
            // User doesn't have a bracket yet - use tournament data as template
            const emptyBracket = createEmptyBracketFromTemplate(data);
            setUserBracket(emptyBracket);
          }
          
          setIsLoading(false);
        } else {
          console.error("Tournament data not found");
          setError("Tournament data not found");
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error loading bracket data:", err);
        setError("Failed to load bracket data. Please try again.");
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [leagueId, userId]);
  
  // Create an empty bracket from tournament template
  const createEmptyBracketFromTemplate = (template) => {
    // Ensure template exists
    if (!template) return null;
    
    // Start with a copy of template
    const emptyBracket = { ...template };
    
    // Ensure RoundOf64 exists and contains the initial matchups
    if (!Array.isArray(emptyBracket.RoundOf64)) {
      emptyBracket.RoundOf64 = [];
    }
    
    // Clear winners for Round of 64
    emptyBracket.RoundOf64 = (emptyBracket.RoundOf64 || []).map(matchup => ({
      ...matchup,
      winner: '',
      winnerSeed: null
    }));
    
    // Initialize or clear other rounds
    const emptyRounds = {
      RoundOf32: Array(16).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      Sweet16: Array(8).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      Elite8: Array(4).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      FinalFour: Array(2).fill().map(() => ({ 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      })),
      Championship: { 
        team1: '', team1Seed: null,
        team2: '', team2Seed: null,
        winner: '', winnerSeed: null
      },
      Champion: '',
      ChampionSeed: null
    };
    
    return { ...emptyBracket, ...emptyRounds };
  };
  
  // Handle selecting a winner for a matchup
  const handleSelectWinner = (round, index, winner, winnerSeed) => {
    if (isLocked) {
      setFeedback("Bracket is locked and cannot be edited");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    setHasChanges(true);
    
    // Create a copy of the user's bracket to modify
    const updatedBracket = { ...userBracket };
    
    // Handle special case for Championship round
    if (round === 'Championship') {
      updatedBracket.Championship = {
        ...updatedBracket.Championship,
        winner,
        winnerSeed
      };
      
      // Also update the Champion field
      updatedBracket.Champion = winner;
      updatedBracket.ChampionSeed = winnerSeed;
    } 
    // Handle regular rounds (arrays of matchups)
    else {
      // Ensure the round array exists
      if (!Array.isArray(updatedBracket[round])) {
        updatedBracket[round] = [];
      }
      
      // Ensure the matchup at this index exists
      if (!updatedBracket[round][index]) {
        updatedBracket[round][index] = {
          team1: '', team1Seed: null,
          team2: '', team2Seed: null,
          winner: '', winnerSeed: null
        };
      }
      
      // Update the winner
      updatedBracket[round][index] = {
        ...updatedBracket[round][index],
        winner,
        winnerSeed
      };
      
      // Update the next round's matchups
      updateNextRound(updatedBracket, round, index, winner, winnerSeed);
    }
    
    setUserBracket(updatedBracket);
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
        // Only reset if we're directly affecting the championship
        if (roundOrder[i-1] === 'FinalFour' && (nextMatchupIndex === 0)) {
          bracket.Championship.winner = '';
          bracket.Championship.winnerSeed = null;
          bracket.Champion = '';
          bracket.ChampionSeed = null;
        }
      } 
      // For array rounds
      else if (Array.isArray(bracket[round]) && bracket[round][nextMatchupIndex]) {
        // Only reset the winner, not the teams
        if (bracket[round][nextMatchupIndex].winner) {
          bracket[round][nextMatchupIndex].winner = '';
          bracket[round][nextMatchupIndex].winnerSeed = null;
        }
      }
    }
  };
  
  // Reset bracket to match the official tournament teams
  const handleResetBracket = () => {
    if (!tournamentData) return;
    
    const confirmReset = window.confirm("Are you sure you want to reset your bracket? This will clear all your picks.");
    if (confirmReset) {
      // Create a new bracket with tournament teams but no winners
      const resetBracket = createEmptyBracketFromTemplate(tournamentData);
      
      setUserBracket(resetBracket);
      setHasChanges(true);
      setFeedback("Bracket has been reset");
      setTimeout(() => setFeedback(''), 3000);
    }
  };
  
  // Save the bracket to the database
  const handleSaveBracket = async () => {
    if (isLocked) {
      setFeedback("Bracket is locked and cannot be edited");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (!userBracket) {
      setFeedback("No bracket data to save");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save to Firebase
      await setDoc(doc(db, "leagues", leagueId, "userData", userId), {
        ...userBracket,
        updatedAt: new Date().toISOString()
      });
      
      setHasChanges(false);
      setFeedback("Bracket saved successfully!");
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error("Error saving bracket:", err);
      setFeedback("Error saving bracket. Please try again.");
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle back navigation with unsaved changes check
  const handleBack = () => {
    if (isEmbedded) {
      // No navigation when embedded
      return;
    }
    
    if (hasChanges) {
      const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmLeave) return;
    }
    
    navigate(`/league/${leagueId}`);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading bracket data...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
        {!isEmbedded && !hideBackButton && (
          <div className="flex items-center mb-6">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
          </div>
        )}
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md">
      {/* Header with actions and back button - only show if not embedded */}
      {!isEmbedded && !hideBackButton && (
        <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition"
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
            
            <h1 className="text-2xl font-bold">Edit Your Bracket</h1>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleResetBracket}
              disabled={isLocked || isSaving}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUndo className="mr-2" /> Reset
            </button>
            
            <button
              onClick={handleSaveBracket}
              disabled={isLocked || isSaving || !hasChanges}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSave className="mr-2" /> {isSaving ? "Saving..." : "Save Bracket"}
            </button>
          </div>
        </div>
      )}
      
      {/* When embedded, show a simpler header with just the save buttons */}
      {(isEmbedded || hideBackButton) && (
        <div className="flex justify-end mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleResetBracket}
              disabled={isLocked || isSaving}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUndo className="mr-2" /> Reset
            </button>
            
            <button
              onClick={handleSaveBracket}
              disabled={isLocked || isSaving || !hasChanges}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSave className="mr-2" /> {isSaving ? "Saving..." : "Save Bracket"}
            </button>
          </div>
        </div>
      )}
      
      {/* Feedback message */}
      {feedback && (
        <div className={`mb-4 p-3 rounded border ${
          feedback.includes('Error') 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback}
        </div>
      )}
      
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6">
        <div className="flex items-start">
          <FaInfoCircle className="mt-1 mr-3 text-blue-500" />
          <div>
            <h3 className="font-bold mb-1">How to fill out your bracket:</h3>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li>Click on a team name to select them as the winner of that matchup</li>
              <li>Winners will automatically advance to the next round</li>
              <li>You can change your picks at any time until the tournament begins</li>
              <li>Don't forget to save your bracket when you're done!</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Bracket Editor */}
      <div className="bg-white border rounded-lg p-6">
        {userBracket ? (
          <BracketEditor 
            bracketData={userBracket}
            onSelectWinner={handleSelectWinner}
            isAdmin={false}
            isLocked={isLocked}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Unable to load bracket data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BracketEdit;