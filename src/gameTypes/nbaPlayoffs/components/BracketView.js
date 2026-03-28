import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaTrophy, FaEyeSlash, FaLock, FaBasketballBall, FaPlayCircle } from 'react-icons/fa';
import BaseView from '../../common/components/BaseView';
import BracketEditor from './BracketEditor';
import PlayInTabs from './PlayInTabs';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Component for viewing an NBA Playoffs bracket in read-only mode with play-in tournament support
 */
const BracketView = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  initialBracketId = null,
  onBracketSelect = null,
  hideBackButton = false,
  fogOfWarEnabled = false,
  tournamentCompleted = false,
}) => {
  // State for scoring settings, bracket data, and play-in data
  const [scoringSettings, setScoringSettings] = useState(null);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('bracket');
  const [officialPlayInData, setOfficialPlayInData] = useState(null);
  const [userPlayInData, setUserPlayInData] = useState(null);
  const [isSavingPlayIn, setIsSavingPlayIn] = useState(false);
  const [playInFeedback, setPlayInFeedback] = useState(null);
  const [isPlayInLoading, setIsPlayInLoading] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const isAdmin = false;

  // Refs to prevent duplicate fetches
  const loadedUserDataRef = useRef(new Set());
  const officialDataLoadedRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Fetch scoring settings when leagueId changes
  useEffect(() => {
    if (propLeagueId) {
      fetchScoringSettings(propLeagueId);
    }
  }, [propLeagueId]);

  const fetchScoringSettings = async (leagueId) => {
    try {
      const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
      const scoringSnap = await getDoc(scoringRef);
      setScoringSettings(scoringSnap.exists() ? scoringSnap.data() : null);
    } catch (error) {
      console.error("Error fetching scoring settings:", error);
      setScoringSettings(null);
      setError("Failed to load scoring settings.");
    }
  };

  // Load play-in data
  const loadPlayInData = useCallback(async () => {
    if (!propLeagueId) return;
    setIsPlayInLoading(true);
    try {
      // Fetch official play-in data (full gameData/current document)
      if (!officialDataLoadedRef.current) {
        const officialRef = doc(db, "leagues", propLeagueId, "gameData", "current");
        const officialSnap = await getDoc(officialRef);
        if (officialSnap.exists()) {
          const data = officialSnap.data();
          console.log("Official play-in data:", data); // Debug log
          setOfficialPlayInData(data); // Pass full document to match working version
          if (isAdmin) {
            setAdminData({ tournamentData: data });
          }
          officialDataLoadedRef.current = true;
        } else {
          console.warn("Official play-in data not found, using default.");
          setOfficialPlayInData({
            "Play In Tournament": {
              east: {
                seventhSeed: { seed: 7, team: "TBD", teamId: "", colors: [], division: "" },
                eighthSeed: { seed: 8, team: "TBD", teamId: "", colors: [], division: "" },
                ninthSeed: { seed: 9, team: "TBD", teamId: "", colors: [], division: "" },
                tenthSeed: { seed: 10, team: "TBD", teamId: "", colors: [], division: "" },
                seventhEighthWinner: { seed: null, team: "" },
                ninthTenthWinner: { seed: null, team: "" },
                winnerTeam: { seed: null, team: "" },
                loserTeam: { seed: null, team: "" },
                finalWinner: { seed: null, team: "" },
              },
              west: {
                seventhSeed: { seed: 7, team: "TBD", teamId: "", colors: [], division: "" },
                eighthSeed: { seed: 8, team: "TBD", teamId: "", colors: [], division: "" },
                ninthSeed: { seed: 9, team: "TBD", teamId: "", colors: [], division: "" },
                tenthSeed: { seed: 10, team: "TBD", teamId: "", colors: [], division: "" },
                seventhEighthWinner: { seed: null, team: "" },
                ninthTenthWinner: { seed: null, team: "" },
                winnerTeam: { seed: null, team: "" },
                loserTeam: { seed: null, team: "" },
                finalWinner: { seed: null, team: "" },
              },
            },
            playInTournamentEnabled: true,
            playInComplete: false,
            settings: {},
            scoringSettings: scoringSettings || {},
          });
        }
      }

      // Fetch user play-in data
      if (initialBracketId && initialBracketId !== 'tournament' && !loadedUserDataRef.current.has(initialBracketId)) {
        const userRef = doc(db, "leagues", propLeagueId, "userData", initialBracketId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserPlayInData(data);
          loadedUserDataRef.current.add(initialBracketId);
        } else {
          console.warn(`User play-in data for ${initialBracketId} not found.`);
          setUserPlayInData(null);
        }
      }
    } catch (error) {
      console.error("Error loading play-in data:", error);
      setError("Failed to load play-in data.");
    } finally {
      setIsPlayInLoading(false);
    }
  }, [propLeagueId, initialBracketId, scoringSettings, isAdmin]);

  // Load play-in data on initial load or tab switch
  useEffect(() => {
    if (isInitialLoadRef.current && propLeagueId) {
      loadPlayInData();
      isInitialLoadRef.current = false;
    }
  }, [propLeagueId, loadPlayInData]);

  useEffect(() => {
    if (activeView === 'play-in') {
      loadPlayInData();
    }
  }, [activeView, loadPlayInData]);

  useEffect(() => {
    if (initialBracketId && !isInitialLoadRef.current) {
      loadPlayInData();
    }
  }, [initialBracketId, loadPlayInData]);

  // Handle play-in bracket updates
  const handleUpdatePlayInBracket = (updatedBracket) => {
    setUserPlayInData(updatedBracket);
  };

  // Handle admin data changes
  const handleAdminDataChange = (updatedData) => {
    setAdminData(updatedData);
  };

  // Save play-in bracket
  const handleSavePlayInBracket = async () => {
    if (!propLeagueId || !initialBracketId || initialBracketId === 'tournament') return;
    try {
      setIsSavingPlayIn(true);
      setPlayInFeedback(null);
      const bracketRef = doc(db, "leagues", propLeagueId, "userData", initialBracketId);
      await setDoc(bracketRef, { playIn: userPlayInData }, { merge: true });
      setPlayInFeedback("Play-in predictions saved successfully!");
      setTimeout(() => setPlayInFeedback(null), 3000);
    } catch (error) {
      console.error("Error saving play-in predictions:", error);
      setPlayInFeedback("Failed to save play-in predictions. Please try again.");
      setError("Failed to save play-in predictions.");
    } finally {
      setIsSavingPlayIn(false);
    }
  };

  // Fetch the official tournament bracket
  const fetchOfficialBracket = useCallback(async (leagueId) => {
    try {
      const tournamentRef = doc(db, "leagues", leagueId, "gameData", "current");
      const tournamentSnap = await getDoc(tournamentRef);
      if (tournamentSnap.exists()) {
        const data = tournamentSnap.data();
        setOfficialPlayInData(data);
        officialDataLoadedRef.current = true;
        return data;
      }
      console.warn("Official bracket not found.");
      return null;
    } catch (error) {
      console.error("Error fetching official bracket:", error);
      setError("Failed to load official bracket.");
      return null;
    }
  }, []);

  // Fetch a specific bracket (official or user)
  const fetchBracketData = useCallback(async (leagueId, bracketId) => {
    try {
      const bracketRef =
        bracketId === 'tournament'
          ? doc(db, "leagues", leagueId, "gameData", "current")
          : doc(db, "leagues", leagueId, "userData", bracketId);
      const bracketSnap = await getDoc(bracketRef);
      if (bracketSnap.exists()) {
        const data = bracketSnap.data();
        if (bracketId === 'tournament') {
          setOfficialPlayInData(data);
          officialDataLoadedRef.current = true;
        } else if (bracketId === initialBracketId) {
          setUserPlayInData(data);
          loadedUserDataRef.current.add(bracketId);
        }
        return data;
      }
      console.warn(`Bracket ${bracketId} not found.`);
      return null;
    } catch (error) {
      console.error(`Error fetching bracket ${bracketId}:`, error);
      setError(`Failed to load bracket data for ${bracketId}.`);
      return null;
    }
  }, [initialBracketId]);

  // Fetch all brackets (official + users)
  const fetchBrackets = useCallback(async (leagueId, leagueData, userId) => {
    try {
      const brackets = [{ id: 'tournament', name: 'Official Tournament', isOfficial: true }];
      if (leagueData?.users && Array.isArray(leagueData.users)) {
        const userBrackets = await Promise.all(
          leagueData.users.map(async (user) => {
            const bracketId = typeof user === 'string' ? user : user?.id;
            if (!bracketId) return null;
            let username = "Unknown User";
            try {
              const userRef = doc(db, "users", bracketId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                username =
                  userData.displayName || userData.username || userData.email || "Unknown User";
              } else if (typeof user !== 'string' && user) {
                username =
                  user.displayName || user.username || user.email || "Unknown User";
              }
            } catch (err) {
              console.error(`Error fetching user data for ${bracketId}:`, err);
            }
            const userBracketRef = doc(db, "leagues", leagueId, "userData", bracketId);
            const userBracketSnap = await getDoc(userBracketRef);
            return {
              id: bracketId,
              name: username.trim(),
              isOfficial: false,
              isCurrentUser: bracketId === userId,
              hasData: userBracketSnap.exists(),
            };
          })
        );
        brackets.push(...userBrackets.filter((bracket) => bracket !== null));
      }
      return brackets;
    } catch (error) {
      console.error("Error fetching brackets:", error);
      setError("Failed to load brackets.");
      return [{ id: 'tournament', name: 'Official Tournament', isOfficial: true }];
    }
  }, []);

  const isBracketVisible = useCallback((bracket, userId, activeBracketId) => {
    console.log('isBracketVisible called with:', { 
      bracket, 
      userId, 
      activeBracketId, 
      fogOfWarEnabled 
    });
    
    // If Fog of War is disabled, all brackets are visible
    if (!fogOfWarEnabled) {
      console.log('Fog of War disabled, showing all brackets');
      return true;
    }
    
    // Official bracket is always visible
    if (bracket.isOfficial) {
      console.log('Official bracket, always visible');
      return true;
    }
    
    // User's own bracket is always visible
    if (bracket.isCurrentUser || bracket.id === userId) {
      console.log('User\'s own bracket, always visible');
      return true;
    }
    
    // With Fog of War enabled, other users' brackets should be hidden
    console.log('Other user bracket, hiding due to Fog of War');
    return false;
  }, [fogOfWarEnabled]);


  console.log('Props passed to BaseView:', {
    fogOfWarEnabled,
    tournamentCompleted
  });

const isGameCompleted = useCallback((data) => {
  return data?.[ROUND_KEYS.NBA_FINALS]?.winner && data[ROUND_KEYS.NBA_FINALS].winner !== "";
}, []);

  // Renderers for different states
  const Renderers = {
    Loading: () => (
      <div className="max-w-full sm:max-w-7xl mx-0 sm:mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">
        <div className="flex flex-col items-center justify-center p-4 sm:p-8">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-indigo-500 mb-3 sm:mb-4"></div>
          <p className="text-gray-600">Loading bracket data...</p>
        </div>
      </div>
    ),

    Error: ({ error: errorMsg }) => (
      <div className="bg-red-100 border-0 sm:border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-none sm:rounded mb-4">
        <p className="font-bold">Error</p>
        <p>{errorMsg || "An unexpected error occurred."}</p>
      </div>
    ),

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

    BracketSelector: ({ entries, activeEntryId, onEntrySelect }) => (
      <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex whitespace-nowrap sm:flex-wrap gap-1 sm:gap-2">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onEntrySelect(entry.id)}
                className={`flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded transition text-sm ${
                  activeEntryId === entry.id
                    ? 'bg-indigo-600 text-white'
                    : entry.hasData
                    ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {entry.isOfficial ? (
                  <FaTrophy className="mr-1 sm:mr-2" />
                ) : (
                  <FaBasketballBall className="mr-1 sm:mr-2" />
                )}
                <span className="truncate max-w-32 sm:max-w-none">
                  {entry.name}
                  {entry.isCurrentUser ? " (You)" : ""}
                  {!entry.isOfficial && !entry.hasData ? " (Not Submitted)" : ""}
                </span>
              </button>
            ))
          ) : (
            <div className="text-gray-500 italic text-sm">No brackets available</div>
          )}
        </div>
      </div>
    ),

    BracketViewWrapper: (props) => {
      const { bracketData, officialEntryData, activeEntryId, isCurrentUserEntry, bracketsLocked } = props;
      const effectiveOfficialData = officialPlayInData || officialEntryData;
      let effectiveBracketData = activeEntryId === 'tournament' 
        ? effectiveOfficialData 
        : (userPlayInData || bracketData);

      // Ensure First Round is always present
      if (
        !effectiveBracketData ||
        !effectiveBracketData[ROUND_KEYS.FIRST_ROUND] ||
        effectiveBracketData[ROUND_KEYS.FIRST_ROUND].length < 8
      ) {
        effectiveBracketData = {
          ...effectiveBracketData,
          [ROUND_KEYS.FIRST_ROUND]:
            effectiveOfficialData?.[ROUND_KEYS.FIRST_ROUND]?.length === 8
              ? effectiveOfficialData[ROUND_KEYS.FIRST_ROUND].map((matchup) => ({
                  ...matchup,
                  winner:
                    effectiveBracketData?.[ROUND_KEYS.FIRST_ROUND]?.find(
                      (m) => m.team1 === matchup.team1 && m.team2 === matchup.team2
                    )?.winner || matchup.winner || '',
                  winnerSeed:
                    effectiveBracketData?.[ROUND_KEYS.FIRST_ROUND]?.find(
                      (m) => m.team1 === matchup.team1 && m.team2 === matchup.team2
                    )?.winnerSeed || matchup.winnerSeed || null,
                  numGames:
                    effectiveBracketData?.[ROUND_KEYS.FIRST_ROUND]?.find(
                      (m) => m.team1 === matchup.team1 && m.team2 === matchup.team2
                    )?.numGames || matchup.numGames || null,
                }))
              : Array(8)
                  .fill()
                  .map((_, i) => ({
                    team1: effectiveOfficialData?.[ROUND_KEYS.FIRST_ROUND]?.[i]?.team1 || `TBD ${i + 1}-1`,
                    team1Seed: effectiveOfficialData?.[ROUND_KEYS.FIRST_ROUND]?.[i]?.team1Seed || null,
                    team2: effectiveOfficialData?.[ROUND_KEYS.FIRST_ROUND]?.[i]?.team2 || `TBD ${i + 1}-2`,
                    team2Seed: effectiveOfficialData?.[ROUND_KEYS.FIRST_ROUND]?.[i]?.team2Seed || null,
                    winner: '',
                    winnerSeed: null,
                    numGames: null,
                    conference: i < 4 ? 'East' : 'West',
                  })),
        };
      }


      return (
        <div>
          <div className="flex mb-4 border-b">
            <button
              onClick={() => setActiveView('bracket')}
              className={`flex items-center px-4 py-2 font-medium text-sm ${
                activeView === 'bracket'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FaBasketballBall className="mr-2" />
              Bracket
            </button>
            <button
              onClick={() => setActiveView('play-in')}
              className={`flex items-center px-4 py-2 font-medium text-sm ${
                activeView === 'play-in'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FaPlayCircle className="mr-2" />
              Play-In Tournament
            </button>
          </div>
          {error && <Renderers.Error error={error} />}
          {activeView === 'bracket' ? (
            <BracketEditor
              {...props}
              bracketData={effectiveBracketData}
              isLocked={true}
              scoringSettings={scoringSettings}
            />
          ) : isPlayInLoading ? (
            <div className="flex flex-col items-center justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
              <p className="text-gray-600 text-sm">Loading Play-In Tournament data...</p>
            </div>
          ) : (
            <PlayInTabs
              gameData={effectiveOfficialData}
              userBracket={userPlayInData}
              onUpdateBracket={handleUpdatePlayInBracket}
              onSaveBracket={handleSavePlayInBracket}
              isLocked={bracketsLocked || !isCurrentUserEntry}
              isSaving={isSavingPlayIn}
              saveFeedback={playInFeedback}
              tournamentCompleted={tournamentCompleted}
              hideAboutSection={activeView === 'play-in'}
              hidePredictionsLockedMessage={activeView === 'play-in'}
              isAdmin={isAdmin}
              adminData={adminData || { tournamentData: effectiveOfficialData }}
              onAdminDataChange={handleAdminDataChange}
              isAdminLoading={false}
              isLeagueArchived={false}
              onBack={() => setActiveView('bracket')}
              scoringSettings={scoringSettings}
            />
          )}
        </div>
      );
    },
  };
console.log(fogOfWarEnabled)

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