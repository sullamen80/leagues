// src/gameTypes/nbaPlayoffs/components/PlayoffsAdminScoringSettings.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaUndo, FaInfoCircle } from 'react-icons/fa';
// Import constants for scoring settings
import { 
  ROUND_KEYS,
  ROUND_DISPLAY_NAMES,
  DEFAULT_POINT_VALUES, 
  DEFAULT_SERIES_BONUS,
  SERIES_LENGTH_KEYS
} from '../constants/playoffConstants';

/**
 * Component for managing NBA Playoffs scoring settings and Play-In Tournament toggle
 */
const AdminScoringSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [leagueData, setLeagueData] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLeagueArchived, setIsLeagueArchived] = useState(false);
  const [gameData, setGameData] = useState(null);
  
  // Initialize scoring settings with defaults
  const [scoringSettings, setScoringSettings] = useState({
    [ROUND_KEYS.FIRST_ROUND]: DEFAULT_POINT_VALUES[ROUND_KEYS.FIRST_ROUND],
    [ROUND_KEYS.CONF_SEMIS]: DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_SEMIS],
    [ROUND_KEYS.CONF_FINALS]: DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_FINALS],
    [ROUND_KEYS.NBA_FINALS]: DEFAULT_POINT_VALUES[ROUND_KEYS.NBA_FINALS],
    [ROUND_KEYS.FINALS_MVP]: DEFAULT_POINT_VALUES[ROUND_KEYS.FINALS_MVP],
    // Series length bonus values
    [SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.FIRST_ROUND],
    [SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_SEMIS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_SEMIS],
    [SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_FINALS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_FINALS],
    [SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.NBA_FINALS],
    // Feature toggles and other settings
    upsetBonus: 2,
    upsetBonusEnabled: true,
    seriesLengthBonusEnabled: true,
    playInTournamentEnabled: false,
    playInCorrectPrediction: 1
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = auth.currentUser?.uid;
  
  // Fetch league data and scoring settings
  useEffect(() => {
    if (!leagueId || !userId) {
      setError("League ID and user ID are required");
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Get league data
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        const leagueData = leagueSnap.data();
        setLeagueData(leagueData);
        setIsLeagueArchived(leagueData.status === 'archived');
        setIsOwner(leagueData.ownerId === userId);
        
        if (leagueData.ownerId !== userId) {
          setError("You don't have permission to access this page");
          setIsLoading(false);
          return;
        }
        
        // Get game data and scoring settings
        const [gameDataSnap, scoringSnap] = await Promise.all([
          getDoc(doc(db, "leagues", leagueId, "gameData", "current")),
          getDoc(doc(db, "leagues", leagueId, "settings", "scoring"))
        ]);
        
        let updatedSettings = {...scoringSettings};
        
        // Apply game data settings if they exist
        if (gameDataSnap.exists()) {
          const gameData = gameDataSnap.data();
          setGameData(gameData);
          
          if ('playInTournamentEnabled' in gameData) {
            updatedSettings.playInTournamentEnabled = gameData.playInTournamentEnabled;
          }
        }
        
        // Apply scoring settings if they exist - Using standardized keys directly
        if (scoringSnap.exists()) {
          // Apply all settings directly, assuming standardized format
          updatedSettings = {
            ...updatedSettings,
            ...scoringSnap.data()
          };
        }
        
        setScoringSettings(updatedSettings);
        setIsLoading(false);
        
      } catch (err) {
        console.error("Error loading scoring settings:", err);
        setError("Failed to load scoring settings. Please try again.");
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [leagueId, userId]);
  
  // Handle input changes
  const handleInputChange = (field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    setScoringSettings(prev => ({
      ...prev,
      [field]: numValue
    }));
    
    setHasChanges(true);
  };
  
  // Handle checkbox toggle for boolean settings
  const handleToggleChange = (field) => {
    setScoringSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
    
    setHasChanges(true);
  };
  
  // Reset to defaults
  const handleResetDefaults = () => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and settings cannot be changed");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    const confirmReset = window.confirm("Are you sure you want to reset to default scoring settings? This will discard any changes.");
    
    if (confirmReset) {
      setScoringSettings({
        [ROUND_KEYS.FIRST_ROUND]: DEFAULT_POINT_VALUES[ROUND_KEYS.FIRST_ROUND],
        [ROUND_KEYS.CONF_SEMIS]: DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_SEMIS],
        [ROUND_KEYS.CONF_FINALS]: DEFAULT_POINT_VALUES[ROUND_KEYS.CONF_FINALS],
        [ROUND_KEYS.NBA_FINALS]: DEFAULT_POINT_VALUES[ROUND_KEYS.NBA_FINALS],
        [ROUND_KEYS.FINALS_MVP]: DEFAULT_POINT_VALUES[ROUND_KEYS.FINALS_MVP],
        // Series length bonus values
        [SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.FIRST_ROUND],
        [SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_SEMIS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_SEMIS],
        [SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_FINALS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.CONF_FINALS],
        [SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS]]: DEFAULT_SERIES_BONUS[ROUND_KEYS.NBA_FINALS],
        // Feature toggles and other settings
        upsetBonus: 2,
        upsetBonusEnabled: true,
        seriesLengthBonusEnabled: true,
        playInTournamentEnabled: false,
        playInCorrectPrediction: 1
      });
      
      setHasChanges(true);
      setFeedback("Scoring settings reset to defaults");
      setTimeout(() => setFeedback(''), 3000);
    }
  };
  
  // Save scoring settings
  const handleSaveSettings = async () => {
    if (isLeagueArchived) {
      setFeedback("This league is archived and settings cannot be changed");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (!hasChanges) return;
    
    setIsSaving(true);
    
    try {
      // Save scoring settings directly to Firestore without standardization
      const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
      await setDoc(scoringRef, {
        ...scoringSettings,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      });
      
      // If Play-In Tournament setting changed, update gameData as well
      if (gameData && gameData.playInTournamentEnabled !== scoringSettings.playInTournamentEnabled) {
        const gameDataRef = doc(db, "leagues", leagueId, "gameData", "current");
        await updateDoc(gameDataRef, {
          playInTournamentEnabled: scoringSettings.playInTournamentEnabled,
          updatedAt: new Date().toISOString()
        });
      }
      
      setHasChanges(false);
      setFeedback("Scoring settings saved successfully!");
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error("Error saving scoring settings:", err);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle back navigation - Updated to use query parameters
  const handleBack = () => {
    if (hasChanges) {
      const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmLeave) return;
    }
    
    // Use URL parameter approach
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.delete('subview');
    navigate(`${location.pathname.split('/').slice(0, 3).join('/')}?${searchParams.toString()}`, { replace: true });
  };
  
  // Reusable form field component
  const PointValueField = ({ label, field, helpText }) => (
    <div className="form-group">
      <label className="block text-gray-700 font-semibold mb-2">
        {label}
      </label>
      <input
        type="number"
        value={scoringSettings[field]}
        onChange={(e) => handleInputChange(field, e.target.value)}
        min="0"
        step="0.5"
        disabled={isLeagueArchived}
        className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      />
      <p className="text-sm text-gray-500 mt-1">{helpText}</p>
    </div>
  );
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading scoring settings...</p>
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
            <FaArrowLeft className="mr-2" /> Back to Admin Dashboard
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
          
          <h1 className="text-2xl font-bold">NBA Playoffs Settings</h1>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleResetDefaults}
            disabled={isLeagueArchived || isSaving}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaUndo className="mr-2" /> Reset to Defaults
          </button>
          
          <button
            onClick={handleSaveSettings}
            disabled={isLeagueArchived || isSaving || !hasChanges}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaSave className="mr-2" /> {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
      
      {/* Feedback & Warnings */}
      {feedback && (
        <div className={`mb-4 p-3 rounded border ${
          feedback.includes('Error') 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback}
        </div>
      )}
      
      {isLeagueArchived && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <FaInfoCircle className="text-red-500 mr-3 text-xl" />
            <div>
              <h3 className="font-bold text-red-700">League is Archived</h3>
              <p className="text-red-700">
                This league has been archived and settings cannot be changed. You can view the scoring settings but cannot make changes.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6">
        <div className="flex items-start">
          <FaInfoCircle className="mt-1 mr-3 text-blue-500" />
          <div>
            <h3 className="font-bold mb-1">About NBA Playoffs Settings</h3>
            <p className="mb-2">
              These settings determine how points are awarded for correct picks in the playoff bracket.
            </p>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li>Set point values for each round of the NBA Playoffs</li>
              <li>Enable or disable the Play-In Tournament</li>
              <li>Configure bonus points for series length and upset predictions</li>
              <li>Changes will apply to all future scoring calculations</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Settings Form */}
      <div className="bg-white border rounded-lg p-6">
        {/* Play-In Tournament Toggle */}
        <div className="border-b pb-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Tournament Format</h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div 
                className={`w-16 h-8 flex items-center ${scoringSettings.playInTournamentEnabled ? 'bg-green-500' : 'bg-gray-300'} rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out`}
                onClick={() => !isLeagueArchived && handleToggleChange('playInTournamentEnabled')}
              >
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${scoringSettings.playInTournamentEnabled ? 'translate-x-8' : ''}`}></div>
              </div>
              <div className="ml-3">
                <h3 className="font-bold text-lg">Play-In Tournament</h3>
                <p className="text-sm text-gray-600">
                  {scoringSettings.playInTournamentEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <p className="text-sm mt-2">
              The Play-In Tournament determines the 7th and 8th seeds in each conference. 
              When enabled, teams ranked 7-10 in each conference participate in a mini-tournament.
            </p>
          </div>
          
          {scoringSettings.playInTournamentEnabled && (
            <div className="form-group ml-6 mt-4">
              <label className="block text-gray-700 font-semibold mb-2">
                Play-In Correct Prediction Points
              </label>
              <input
                type="number"
                value={scoringSettings.playInCorrectPrediction}
                onChange={(e) => handleInputChange('playInCorrectPrediction', e.target.value)}
                min="0"
                step="0.5"
                disabled={isLeagueArchived}
                className={`w-full md:w-1/3 px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              />
              <p className="text-sm text-gray-500 mt-1">
                Points awarded for correctly predicting Play-In Tournament outcomes
              </p>
            </div>
          )}
        </div>
        
        {/* Point Values by Round */}
        <h2 className="text-xl font-bold mb-4">Point Values by Round</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <PointValueField 
            label="First Round Points" 
            field={ROUND_KEYS.FIRST_ROUND} 
            helpText="Points for each correct First Round pick" 
          />
          
          <PointValueField 
            label="Conference Semifinals Points" 
            field={ROUND_KEYS.CONF_SEMIS} 
            helpText="Points for each correct Conference Semifinals pick" 
          />
          
          <PointValueField 
            label="Conference Finals Points" 
            field={ROUND_KEYS.CONF_FINALS} 
            helpText="Points for each correct Conference Finals pick" 
          />
          
          <PointValueField 
            label="NBA Finals Points" 
            field={ROUND_KEYS.NBA_FINALS} 
            helpText="Points for correctly picking the NBA Finals matchup and champion" 
          />
          
          <PointValueField 
            label="Finals MVP Points" 
            field={ROUND_KEYS.FINALS_MVP} 
            helpText="Points for correctly predicting the Finals MVP" 
          />
        </div>
        
        {/* Bonus Settings */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Bonus Points</h2>
          
          {/* Series Length Bonus */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={scoringSettings.seriesLengthBonusEnabled}
                  onChange={() => handleToggleChange('seriesLengthBonusEnabled')}
                  disabled={isLeagueArchived}
                  className={`form-checkbox h-5 w-5 text-indigo-600 rounded ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                />
                <span className="ml-2 text-gray-700 font-semibold">Enable Series Length Bonus</span>
              </label>
              
              <div className="text-sm text-gray-500">
                {scoringSettings.seriesLengthBonusEnabled ? "Enabled" : "Disabled"}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1 ml-7">
              Award bonus points when users correctly predict how many games a series will last
            </p>
            
            {scoringSettings.seriesLengthBonusEnabled && (
              <div className="form-group ml-7 mt-4">
                <h3 className="block text-gray-700 font-semibold mb-2">Series Length Bonus Points by Round</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">First Round</label>
                    <input
                      type="number"
                      value={scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]]}
                      onChange={(e) => handleInputChange(SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND], e.target.value)}
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived}
                      className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">Conference Semifinals</label>
                    <input
                      type="number"
                      value={scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_SEMIS]]}
                      onChange={(e) => handleInputChange(SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_SEMIS], e.target.value)}
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived}
                      className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">Conference Finals</label>
                    <input
                      type="number"
                      value={scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_FINALS]]}
                      onChange={(e) => handleInputChange(SERIES_LENGTH_KEYS[ROUND_KEYS.CONF_FINALS], e.target.value)}
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived}
                      className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1">NBA Finals</label>
                    <input
                      type="number"
                      value={scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS]]}
                      onChange={(e) => handleInputChange(SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS], e.target.value)}
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived}
                      className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                    />
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 mt-1">
                  Bonus points awarded for correctly predicting the number of games in a series (4, 5, 6, or 7)
                </p>
              </div>
            )}
          </div>
          
          {/* Upset Bonus */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={scoringSettings.upsetBonusEnabled}
                  onChange={() => handleToggleChange('upsetBonusEnabled')}
                  disabled={isLeagueArchived}
                  className={`form-checkbox h-5 w-5 text-indigo-600 rounded ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                />
                <span className="ml-2 text-gray-700 font-semibold">Enable Upset Bonus</span>
              </label>
              
              <div className="text-sm text-gray-500">
                {scoringSettings.upsetBonusEnabled ? "Enabled" : "Disabled"}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1 ml-7">
              Award bonus points when users correctly predict an upset (lower seed beats higher seed)
            </p>
            
            {scoringSettings.upsetBonusEnabled && (
              <div className="form-group ml-7 mt-4">
                <label className="block text-gray-700 font-semibold mb-2">
                  Upset Bonus Points
                </label>
                <input
                  type="number"
                  value={scoringSettings.upsetBonus}
                  onChange={(e) => handleInputChange('upsetBonus', e.target.value)}
                  min="0"
                  step="0.5"
                  disabled={isLeagueArchived}
                  className={`w-full md:w-1/3 px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Bonus points awarded for correctly predicting an upset
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Examples */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Examples with Current Settings</h2>
          
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h3 className="font-semibold mb-2">Scoring Examples</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Scenario</th>
                  <th className="text-right py-2">Base Points</th>
                  <th className="text-right py-2">Bonus Points</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">First Round: 1 seed defeats 8 seed in 5 games</td>
                  <td className="text-right">{scoringSettings[ROUND_KEYS.FIRST_ROUND]}</td>
                  <td className="text-right">
                    {scoringSettings.seriesLengthBonusEnabled ? 
                      `+${scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]]} (series length)` : 
                      '0'}
                  </td>
                  <td className="text-right font-semibold">
                    {scoringSettings.seriesLengthBonusEnabled 
                      ? scoringSettings[ROUND_KEYS.FIRST_ROUND] + scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]] 
                      : scoringSettings[ROUND_KEYS.FIRST_ROUND]}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">First Round: 6 seed upsets 3 seed in 7 games</td>
                  <td className="text-right">{scoringSettings[ROUND_KEYS.FIRST_ROUND]}</td>
                  <td className="text-right">
                    {`${scoringSettings.upsetBonusEnabled ? `+${scoringSettings.upsetBonus} (upset)` : '0'} ${
                      scoringSettings.seriesLengthBonusEnabled ? 
                        `+${scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]]} (series length)` : 
                        ''
                    }`}
                  </td>
                  <td className="text-right font-semibold">
                    {scoringSettings[ROUND_KEYS.FIRST_ROUND] + 
                      (scoringSettings.upsetBonusEnabled ? scoringSettings.upsetBonus : 0) +
                      (scoringSettings.seriesLengthBonusEnabled ? 
                        scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.FIRST_ROUND]] : 
                        0)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">NBA Finals: Correctly predict matchup, winner, and MVP</td>
                  <td className="text-right">
                    {`${scoringSettings[ROUND_KEYS.NBA_FINALS]} + ${scoringSettings[ROUND_KEYS.FINALS_MVP]}`}
                  </td>
                  <td className="text-right">
                    {scoringSettings.seriesLengthBonusEnabled ? 
                      `+${scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS]]} (series length)` : 
                      '0'}
                  </td>
                  <td className="text-right font-semibold">
                    {scoringSettings[ROUND_KEYS.NBA_FINALS] + 
                      scoringSettings[ROUND_KEYS.FINALS_MVP] +
                      (scoringSettings.seriesLengthBonusEnabled ? 
                        scoringSettings[SERIES_LENGTH_KEYS[ROUND_KEYS.NBA_FINALS]] : 
                        0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminScoringSettings;