// src/gameTypes/nflPlayoffs/components/AdminScoringSettings.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaUndo, FaInfoCircle } from 'react-icons/fa';
// Import constants for scoring settings
import { ROUND_KEYS } from '../constants/playoffConstants';
import {
  getDefaultScoringSettings,
  normalizeScoringSettings,
  getRoundConfigs
} from '../config/scoringConfig';

/**
 * Component for managing NFL Playoffs scoring settings
 */
const AdminScoringSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLeagueArchived, setIsLeagueArchived] = useState(false);
  
  // Initialize scoring settings with defaults
  const [scoringSettings, setScoringSettings] = useState(getDefaultScoringSettings);
  const roundConfigs = getRoundConfigs();
  
  const [hasChanges, setHasChanges] = useState(false);
  const [propBets, setPropBets] = useState([]);
  
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
        
        const leagueInfo = leagueSnap.data();
        setIsLeagueArchived(leagueInfo.status === 'archived');
        
        if (leagueInfo.ownerId !== userId) {
          setError("You don't have permission to access this page");
          setIsLoading(false);
          return;
        }
        // Get scoring settings
        const scoringSnap = await getDoc(doc(db, "leagues", leagueId, "settings", "scoring"));
        const updatedSettings = scoringSnap.exists()
          ? normalizeScoringSettings(scoringSnap.data())
          : getDefaultScoringSettings();
        
        setScoringSettings(updatedSettings);

        // Load prop bet definitions
        try {
          const gameDataSnap = await getDoc(doc(db, "leagues", leagueId, "gameData", "current"));
          if (gameDataSnap.exists()) {
            setPropBets(gameDataSnap.data().propBets || []);
          } else {
            setPropBets([]);
          }
        } catch (propErr) {
          console.error("Error loading prop bets:", propErr);
          setPropBets([]);
        }

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

    setScoringSettings((prev) => ({
      ...prev,
      [field]: numValue
    }));

    setHasChanges(true);
  };

  const handleRoundValueChange = (field, roundKey, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setScoringSettings((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] || {}),
        [roundKey]: numValue
      }
    }));

    setHasChanges(true);
  };

  const handlePropDefaultChange = (field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setScoringSettings((prev) => ({
      ...prev,
      propBetDefaults: {
        ...(prev.propBetDefaults || {}),
        [field]: numValue
      }
    }));

    setHasChanges(true);
  };

  const handlePropOverrideChange = (propId, field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setScoringSettings((prev) => ({
      ...prev,
      propBetOverrides: {
        ...(prev.propBetOverrides || {}),
        [propId]: {
          ...(prev.propBetOverrides?.[propId] || {}),
          [field]: numValue
        }
      }
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
      setScoringSettings(getDefaultScoringSettings());
      
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
          
          <h1 className="text-2xl font-bold">NFL Playoffs Settings</h1>
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
            <h3 className="font-bold mb-1">About NFL Playoffs Settings</h3>
            <p className="mb-2">
              These settings determine how points are awarded for correct picks in the playoff bracket.
            </p>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li>Set point values for each round of the NFL Playoffs</li>
              <li>Configure bonus points for potential upsets and long-shot picks</li>
              <li>Changes will apply to all future scoring calculations</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Settings Form */}
      <div className="bg-white border rounded-lg p-6">
        {/* Point Values by Round */}
        <h2 className="text-xl font-bold mb-4">Point Values by Round</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {roundConfigs.map(({ key, label }) => (
            <PointValueField
              key={key}
              label={`${label} Points`}
              field={key}
              helpText={`Points for each correct ${label} pick`}
            />
          ))}
          
          <PointValueField 
            label="Super Bowl MVP Points" 
            field={ROUND_KEYS.FINALS_MVP} 
            helpText="Points for correctly predicting the Super Bowl MVP" 
          />
          <PointValueField 
            label="Early Super Bowl Winner Points"
            field="superWinnerPoints"
            helpText="Points for correctly picking the champion before the playoffs begin"
          />
        </div>
        
        {/* Bonus Settings */}
        <div className="border-t pt-6 mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">Upset Bonus</h2>
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
                  Bonus Per Seed Difference
                </label>
                <input
                  type="number"
                  value={scoringSettings.bonusPerSeedDifference}
                  onChange={(e) => handleInputChange('bonusPerSeedDifference', e.target.value)}
                  min="0"
                  step="0.5"
                  disabled={isLeagueArchived}
                  className={`w-full md:w-1/3 px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Bonus added for each seed difference when users correctly pick an upset
                </p>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Spread Picks</h2>
            <div className="text-sm text-gray-500 mb-2">
              Enable spread predictions and set point values per round.
            </div>
            <div className="space-y-3">
              {roundConfigs.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex flex-col md:flex-row md:items-center md:space-x-4 p-3 border rounded-lg"
                >
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(scoringSettings.spreadEnabledRounds?.[key])}
                      onChange={() =>
                        setScoringSettings((prev) => ({
                          ...prev,
                          spreadEnabledRounds: {
                            ...prev.spreadEnabledRounds,
                            [key]: !prev.spreadEnabledRounds?.[key]
                          }
                        }))
                      }
                      disabled={isLeagueArchived}
                      className={`form-checkbox h-4 w-4 text-indigo-600 rounded ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                    />
                    <span className="font-semibold text-gray-700">{label}</span>
                  </label>
                  <div className="mt-2 md:mt-0 flex-1">
                    <input
                      type="number"
                      value={scoringSettings.spreadPoints?.[key] ?? 0}
                      onChange={(e) =>
                        handleRoundValueChange('spreadPoints', key, e.target.value)
                      }
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived || !scoringSettings.spreadEnabledRounds?.[key]}
                      className={`w-full md:w-32 px-3 py-2 border rounded-lg ${
                        isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Over/Under Picks</h2>
            <div className="text-sm text-gray-500 mb-2">
              Enable total points predictions and set point values per round.
            </div>
            <div className="space-y-3">
              {roundConfigs.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex flex-col md:flex-row md:items-center md:space-x-4 p-3 border rounded-lg"
                >
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(scoringSettings.overUnderEnabledRounds?.[key])}
                      onChange={() =>
                        setScoringSettings((prev) => ({
                          ...prev,
                          overUnderEnabledRounds: {
                            ...prev.overUnderEnabledRounds,
                            [key]: !prev.overUnderEnabledRounds?.[key]
                          }
                        }))
                      }
                      disabled={isLeagueArchived}
                      className={`form-checkbox h-4 w-4 text-indigo-600 rounded ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                    />
                    <span className="font-semibold text-gray-700">{label}</span>
                  </label>
                  <div className="mt-2 md:mt-0 flex-1">
                    <input
                      type="number"
                      value={scoringSettings.overUnderPoints?.[key] ?? 0}
                      onChange={(e) =>
                        handleRoundValueChange('overUnderPoints', key, e.target.value)
                      }
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived || !scoringSettings.overUnderEnabledRounds?.[key]}
                      className={`w-full md:w-32 px-3 py-2 border rounded-lg ${
                        isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Score Accuracy Bonus</h2>
            <p className="text-sm text-gray-500 mb-2">
              Reward the closest predicted final score when users stay within the configured tolerances.
            </p>
            <div className="space-y-3 mb-4">
              {roundConfigs.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex flex-col md:flex-row md:items-center md:space-x-4 p-3 border rounded-lg"
                >
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(scoringSettings.scoreBonusEnabledRounds?.[key])}
                      onChange={() =>
                        setScoringSettings((prev) => ({
                          ...prev,
                          scoreBonusEnabledRounds: {
                            ...prev.scoreBonusEnabledRounds,
                            [key]: !prev.scoreBonusEnabledRounds?.[key]
                          }
                        }))
                      }
                      disabled={isLeagueArchived}
                      className={`form-checkbox h-4 w-4 text-indigo-600 rounded ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                    />
                    <span className="font-semibold text-gray-700">{label}</span>
                  </label>
                  <div className="mt-2 md:mt-0 flex-1">
                    <input
                      type="number"
                      value={scoringSettings.scoreBonusPoints?.[key] ?? 0}
                      onChange={(e) => handleRoundValueChange('scoreBonusPoints', key, e.target.value)}
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived || !scoringSettings.scoreBonusEnabledRounds?.[key]}
                      className={`w-full md:w-32 px-3 py-2 border rounded-lg ${
                        isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Total Points Threshold
                </label>
                <input
                  type="number"
                  value={scoringSettings.scoreBonusTotalThreshold}
                  onChange={(e) => handleInputChange('scoreBonusTotalThreshold', e.target.value)}
                  min="0"
                  step="1"
                  disabled={isLeagueArchived}
                  className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Max difference between predicted and actual combined score (default 10).
                </p>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Per Team Threshold
                </label>
                <input
                  type="number"
                  value={scoringSettings.scoreBonusTeamThreshold}
                  onChange={(e) => handleInputChange('scoreBonusTeamThreshold', e.target.value)}
                  min="0"
                  step="1"
                  disabled={isLeagueArchived}
                  className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Max difference per team score (default 7).
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Perfect Score Bonus</h2>
            <p className="text-sm text-gray-500 mb-2">
              Reward users who predict the exact final score.
            </p>
            <div className="space-y-3 mb-4">
              {roundConfigs.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex flex-col md:flex-row md:items-center md:space-x-4 p-3 border rounded-lg"
                >
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(scoringSettings.perfectScoreEnabledRounds?.[key])}
                      onChange={() =>
                        setScoringSettings((prev) => ({
                          ...prev,
                          perfectScoreEnabledRounds: {
                            ...prev.perfectScoreEnabledRounds,
                            [key]: !prev.perfectScoreEnabledRounds?.[key]
                          }
                        }))
                      }
                      disabled={isLeagueArchived}
                      className={`form-checkbox h-4 w-4 text-indigo-600 rounded ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                    />
                    <span className="font-semibold text-gray-700">{label}</span>
                  </label>
                  <div className="mt-2 md:mt-0 flex-1">
                    <input
                      type="number"
                      value={scoringSettings.perfectScorePoints?.[key] ?? 0}
                      onChange={(e) =>
                        handleRoundValueChange('perfectScorePoints', key, e.target.value)
                      }
                      min="0"
                      step="0.5"
                      disabled={isLeagueArchived || !scoringSettings.perfectScoreEnabledRounds?.[key]}
                      className={`w-full md:w-32 px-3 py-2 border rounded-lg ${
                        isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Prop Bets */}
        <div className="border-t pt-6 mt-10 space-y-4">
          <h2 className="text-xl font-bold">Prop Bets</h2>
          <p className="text-sm text-gray-500">
            Configure wager limits for prop bets defined in the props manager. Correct answers pay whatever was wagered.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Default Max Wager
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={scoringSettings.propBetDefaults?.maxWager ?? 3}
                onChange={(e) => handlePropDefaultChange('maxWager', e.target.value)}
                disabled={isLeagueArchived}
                className={`w-full md:w-40 px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              />
              <p className="text-sm text-gray-500 mt-1">Players can wager up to this amount unless overridden per prop.</p>
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Max Prop Selections
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={scoringSettings.propBetSelectionLimit ?? 0}
                onChange={(e) => handleInputChange('propBetSelectionLimit', e.target.value)}
                disabled={isLeagueArchived}
                className={`w-full md:w-40 px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              />
              <p className="text-sm text-gray-500 mt-1">
                Maximum number of props a player may wager on (0 for unlimited).
              </p>
            </div>
          </div>

          {propBets.length === 0 ? (
            <div className="p-4 bg-gray-50 border rounded text-gray-500 text-sm">
              No prop bets defined yet. Add them from the Props & MVP management screen.
            </div>
          ) : (
            <div className="space-y-4">
              {propBets.map((prop) => (
                <div
                  key={prop.id}
                  className="p-4 border rounded-lg bg-white shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-gray-800">
                        {prop.title || prop.matchupLabel || prop.line || 'Untitled Prop'}
                      </div>
                      <div className="text-sm text-gray-500">{prop.description}</div>
                    </div>
                    <span className="mt-2 md:mt-0 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {prop.type === 'text' ? 'Freeform' : 'Multiple Choice'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Max Wager
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={scoringSettings.propBetOverrides?.[prop.id]?.maxWager ?? ''}
                        onChange={(e) => handlePropOverrideChange(prop.id, 'maxWager', e.target.value)}
                        disabled={isLeagueArchived}
                        placeholder={`${scoringSettings.propBetDefaults?.maxWager ?? 3} (default)`}
                        className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  <td className="py-2">First Round: 1 seed defeats 8 seed</td>
                  <td className="text-right">{scoringSettings[ROUND_KEYS.FIRST_ROUND]}</td>
                  <td className="text-right">0</td>
                  <td className="text-right font-semibold">
                    {scoringSettings[ROUND_KEYS.FIRST_ROUND]}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">First Round: 6 seed upsets 3 seed</td>
                  <td className="text-right">{scoringSettings[ROUND_KEYS.FIRST_ROUND]}</td>
                  <td className="text-right">
                    {scoringSettings.upsetBonusEnabled ? `+${scoringSettings.bonusPerSeedDifference} (upset)` : '0'}
                  </td>
                  <td className="text-right font-semibold">
                    {scoringSettings[ROUND_KEYS.FIRST_ROUND] + 
                      (scoringSettings.upsetBonusEnabled ? scoringSettings.bonusPerSeedDifference : 0)}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Super Bowl: Correctly predict matchup, winner, and MVP</td>
                  <td className="text-right">
                    {`${scoringSettings[ROUND_KEYS.SUPER_BOWL]} + ${scoringSettings[ROUND_KEYS.FINALS_MVP]}`}
                  </td>
                  <td className="text-right">0</td>
                  <td className="text-right font-semibold">
                    {scoringSettings[ROUND_KEYS.SUPER_BOWL] + 
                      scoringSettings[ROUND_KEYS.FINALS_MVP]}
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
