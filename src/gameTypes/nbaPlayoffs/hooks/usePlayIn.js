import { useState, useEffect, useContext } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { AuthContext } from '../../auth/AuthContext';
import { useLeague } from '../../league/LeagueContext';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Hook for managing Play-In Tournament functionality
 */
export const usePlayIn = () => {
  const { currentUser } = useContext(AuthContext);
  const { league } = useLeague();
  const [playInData, setPlayInData] = useState(null);
  const [userPredictions, setUserPredictions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Play-In Tournament data and user predictions
  useEffect(() => {
    const fetchData = async () => {
      if (!league || !league.id || !currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Get league data which includes Play-In settings
        const leagueRef = doc(db, "leagues", league.id);
        const leagueDoc = await getDoc(leagueRef);
        
        if (leagueDoc.exists()) {
          const leagueData = leagueDoc.data();
          
          // Check if Play-In Tournament is enabled for this league
          if (leagueData.gameData?.settings?.playInTournamentEnabled) {
            setPlayInData({
              isEnabled: true,
              status: leagueData.gameData?.playInTournament?.status || 'pending', // pending, active, completed
              teams: leagueData.gameData?.playInTournament?.teams || {},
              results: leagueData.gameData?.playInTournament?.results || null
            });
            
            // Get user predictions if available
            const userBracketRef = doc(db, "leagues", league.id, "brackets", currentUser.uid);
            const userBracketDoc = await getDoc(userBracketRef);
            
            if (userBracketDoc.exists()) {
              const bracketData = userBracketDoc.data();
              if (bracketData[ROUND_KEYS.PLAY_IN]) {
                setUserPredictions(bracketData[ROUND_KEYS.PLAY_IN]);
              }
            }
          } else {
            setPlayInData({ isEnabled: false });
          }
        }
      } catch (err) {
        console.error("Error fetching Play-In data:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [league, currentUser]);

  /**
   * Save user's Play-In Tournament predictions
   * @param {Object} predictions - User's Play-In predictions
   */
  const savePlayInPredictions = async (predictions) => {
    if (!league || !league.id || !currentUser) {
      setError("Cannot save predictions: Missing league or user data");
      return { success: false, error: "Missing data" };
    }

    try {
      const userBracketRef = doc(db, "leagues", league.id, "brackets", currentUser.uid);
      
      // Check if user bracket exists already
      const bracketDoc = await getDoc(userBracketRef);
      
      if (bracketDoc.exists()) {
        // Update existing bracket with Play-In predictions
        await updateDoc(userBracketRef, {
          [ROUND_KEYS.PLAY_IN]: predictions,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Create new bracket document with Play-In predictions
        await setDoc(userBracketRef, {
          userId: currentUser.uid,
          userName: currentUser.displayName || "Anonymous",
          [ROUND_KEYS.PLAY_IN]: predictions,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
      
      // Update local state
      setUserPredictions(predictions);
      
      return { success: true };
    } catch (err) {
      console.error("Error saving Play-In predictions:", err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Update a specific Play-In prediction
   * @param {string} conference - 'east' or 'west'
   * @param {Object} conferencePredictions - Predictions for this conference
   */
  const updatePlayInPrediction = (conference, conferencePredictions) => {
    // Update local state, but don't save to database yet
    setUserPredictions(prev => {
      if (!prev) {
        const newPredictions = {
          east: {
            seventhEighthGame: { winner: null },
            ninthTenthGame: { winner: null },
            finalGame: { winner: null }
          },
          west: {
            seventhEighthGame: { winner: null },
            ninthTenthGame: { winner: null },
            finalGame: { winner: null }
          }
        };
        newPredictions[conference] = conferencePredictions;
        return newPredictions;
      }
      
      return {
        ...prev,
        [conference]: conferencePredictions
      };
    });
  };

  /**
   * Admin function to enable/disable Play-In Tournament
   * @param {boolean} enabled - Whether to enable the Play-In Tournament
   */
  const setPlayInTournamentEnabled = async (enabled) => {
    if (!league || !league.id || !currentUser) {
      setError("Cannot update: Missing league or user data");
      return { success: false, error: "Missing data" };
    }

    try {
      const leagueRef = doc(db, "leagues", league.id);
      
      // Update the settings to enable/disable Play-In Tournament
      await updateDoc(leagueRef, {
        'gameData.settings.playInTournamentEnabled': enabled
      });
      
      // If enabling, also initialize the Play-In structure if not exists
      if (enabled) {
        const leagueDoc = await getDoc(leagueRef);
        const leagueData = leagueDoc.data();
        
        // Only initialize if not already set
        if (!leagueData.gameData.playInTournament) {
          await updateDoc(leagueRef, {
            'gameData.playInTournament': {
              status: 'pending',
              teams: {
                east: {
                  7: null,
                  8: null,
                  9: null,
                  10: null
                },
                west: {
                  7: null,
                  8: null,
                  9: null,
                  10: null
                }
              },
              results: null
            }
          });
        }
      }
      
      // Update local state
      setPlayInData(prev => ({
        ...prev,
        isEnabled: enabled
      }));
      
      return { success: true };
    } catch (err) {
      console.error("Error updating Play-In settings:", err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Admin function to set official Play-In results
   * @param {Object} results - Official Play-In Tournament results
   */
  const setPlayInResults = async (results) => {
    if (!league || !league.id || !currentUser) {
      setError("Cannot update: Missing league or user data");
      return { success: false, error: "Missing data" };
    }

    try {
      const leagueRef = doc(db, "leagues", league.id);
      
      // Update the Play-In Tournament results
      await updateDoc(leagueRef, {
        'gameData.playInTournament.results': results,
        'gameData.playInTournament.status': 'completed'
      });
      
      // Update local state
      setPlayInData(prev => ({
        ...prev,
        results,
        status: 'completed'
      }));
      
      return { success: true };
    } catch (err) {
      console.error("Error updating Play-In results:", err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Calculate a user's Play-In Tournament score
   * @param {Object} userPredictions - User's Play-In predictions
   * @param {Object} officialResults - Official Play-In results
   */
  const calculatePlayInScore = (userPredictions, officialResults) => {
    if (!userPredictions || !officialResults) return { total: 0, details: {} };
    
    let total = 0;
    const details = {
      east: { correct: 0, total: 0 },
      west: { correct: 0, total: 0 }
    };
    
    // Points per correct prediction
    const POINTS_PER_GAME = 0.5;
    
    // Check each conference
    ['east', 'west'].forEach(conference => {
      // Check each game
      ['seventhEighthGame', 'ninthTenthGame', 'finalGame'].forEach(game => {
        const userPick = userPredictions[conference][game].winner;
        const officialWinner = officialResults[conference][game].winner;
        
        // If the user made a prediction for this game
        if (userPick) {
          details[conference].total++;
          
          // If the prediction was correct
          if (userPick === officialWinner) {
            details[conference].correct++;
            total += POINTS_PER_GAME;
          }
        }
      });
    });
    
    return {
      total,
      details
    };
  };
  
  return {
    playInData,
    userPredictions,
    isLoading,
    error,
    savePlayInPredictions,
    updatePlayInPrediction,
    setPlayInTournamentEnabled,
    setPlayInResults,
    calculatePlayInScore
  };
};

export default usePlayIn;