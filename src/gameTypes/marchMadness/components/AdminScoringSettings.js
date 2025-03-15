// src/gameTypes/marchMadness/components/ScoringSettings.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaUndo, FaInfoCircle } from 'react-icons/fa';

/**
 * Component for managing tournament scoring settings
 */
const AdminScoringSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [leagueData, setLeagueData] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLeagueArchived, setIsLeagueArchived] = useState(false);
  
  // Initialize scoring settings with defaults
  const [scoringSettings, setScoringSettings] = useState({
    roundOf64: 1,
    roundOf32: 2,
    sweet16: 4,
    elite8: 8,
    finalFour: 16,
    championship: 32,
    bonusPerSeedDifference: 0.5, // Bonus for upsets based on seed difference
    bonusEnabled: true,
    bonusType: 'seedDifference', // 'seedDifference' or 'flat'
    flatBonusValue: 0.5 // Flat bonus value for any upset
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  
  const { leagueId } = useParams();
  const navigate = useNavigate();
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
        
        // Check if league is archived
        setIsLeagueArchived(leagueData.status === 'archived');
        
        // Check if user is owner
        setIsOwner(leagueData.ownerId === userId);
        
        if (leagueData.ownerId !== userId) {
          setError("You don't have permission to access this page");
          setIsLoading(false);
          return;
        }
        
        // Get scoring settings if they exist
        const scoringRef = doc(db, "leagues", leagueId, "settings", "scoring");
        const scoringSnap = await getDoc(scoringRef);
        
        if (scoringSnap.exists()) {
          // Use existing scoring settings
          const existingSettings = scoringSnap.data();
          // If bonusType doesn't exist in the existing settings, default to 'seedDifference'
          if (!existingSettings.bonusType) {
            existingSettings.bonusType = 'seedDifference';
          }
          // If flatBonusValue doesn't exist, default to 0.5
          if (!existingSettings.flatBonusValue) {
            existingSettings.flatBonusValue = 0.5;
          }
          setScoringSettings(existingSettings);
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
    // Convert to number and validate
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) return;
    
    // Update state
    setScoringSettings(prev => ({
      ...prev,
      [field]: numValue
    }));
    
    setHasChanges(true);
  };
  
  // Handle toggle for bonus points
  const handleToggleBonus = () => {
    setScoringSettings(prev => ({
      ...prev,
      bonusEnabled: !prev.bonusEnabled
    }));
    
    setHasChanges(true);
  };
  
  // Handle bonus type change
  const handleBonusTypeChange = (type) => {
    setScoringSettings(prev => ({
      ...prev,
      bonusType: type
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
        roundOf64: 1,
        roundOf32: 2,
        sweet16: 4,
        elite8: 8,
        finalFour: 16,
        championship: 32,
        bonusPerSeedDifference: 0.5,
        bonusEnabled: true,
        bonusType: 'seedDifference',
        flatBonusValue: 0.5
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
      // Save scoring settings to Firestore
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
  
  // Handle back navigation
  const handleBack = () => {
    if (hasChanges) {
      const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmLeave) return;
    }
    
    navigate(`/league/${leagueId}/admin`);
  };
  
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
          
          <h1 className="text-2xl font-bold">Scoring Settings</h1>
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
      
      {/* Archived warning */}
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
      
      {/* Scoring Information */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6">
        <div className="flex items-start">
          <FaInfoCircle className="mt-1 mr-3 text-blue-500" />
          <div>
            <h3 className="font-bold mb-1">About Scoring Settings</h3>
            <p className="mb-2">
              These settings determine how points are awarded for correct picks in the tournament bracket.
            </p>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li>Set point values for each round of the tournament</li>
              <li>Enable or disable bonus points for correctly predicting upsets</li>
              <li>Choose between flat bonus points or seed-difference based bonus</li>
              <li>Changes will apply to all future scoring calculations</li>
              <li>Changing these settings will not automatically recalculate existing scores</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Settings Form */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Point Values by Round</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Round of 64 */}
          <div className="form-group">
            <label className="block text-gray-700 font-semibold mb-2">
              Round of 64 Points
            </label>
            <input
              type="number"
              value={scoringSettings.roundOf64}
              onChange={(e) => handleInputChange('roundOf64', e.target.value)}
              min="0"
              step="0.5"
              disabled={isLeagueArchived}
              className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            <p className="text-sm text-gray-500 mt-1">Points for each correct First Round pick</p>
          </div>
          
          {/* Round of 32 */}
          <div className="form-group">
            <label className="block text-gray-700 font-semibold mb-2">
              Round of 32 Points
            </label>
            <input
              type="number"
              value={scoringSettings.roundOf32}
              onChange={(e) => handleInputChange('roundOf32', e.target.value)}
              min="0"
              step="0.5"
              disabled={isLeagueArchived}
              className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            <p className="text-sm text-gray-500 mt-1">Points for each correct Second Round pick</p>
          </div>
          
          {/* Sweet 16 */}
          <div className="form-group">
            <label className="block text-gray-700 font-semibold mb-2">
              Sweet 16 Points
            </label>
            <input
              type="number"
              value={scoringSettings.sweet16}
              onChange={(e) => handleInputChange('sweet16', e.target.value)}
              min="0"
              step="0.5"
              disabled={isLeagueArchived}
              className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            <p className="text-sm text-gray-500 mt-1">Points for each correct Sweet 16 pick</p>
          </div>
          
          {/* Elite 8 */}
          <div className="form-group">
            <label className="block text-gray-700 font-semibold mb-2">
              Elite 8 Points
            </label>
            <input
              type="number"
              value={scoringSettings.elite8}
              onChange={(e) => handleInputChange('elite8', e.target.value)}
              min="0"
              step="0.5"
              disabled={isLeagueArchived}
              className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            <p className="text-sm text-gray-500 mt-1">Points for each correct Elite 8 pick</p>
          </div>
          
          {/* Final Four */}
          <div className="form-group">
            <label className="block text-gray-700 font-semibold mb-2">
              Final Four Points
            </label>
            <input
              type="number"
              value={scoringSettings.finalFour}
              onChange={(e) => handleInputChange('finalFour', e.target.value)}
              min="0"
              step="0.5"
              disabled={isLeagueArchived}
              className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            <p className="text-sm text-gray-500 mt-1">Points for each correct Final Four pick</p>
          </div>
          
          {/* Championship */}
          <div className="form-group">
            <label className="block text-gray-700 font-semibold mb-2">
              Championship Points
            </label>
            <input
              type="number"
              value={scoringSettings.championship}
              onChange={(e) => handleInputChange('championship', e.target.value)}
              min="0"
              step="0.5"
              disabled={isLeagueArchived}
              className={`w-full px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            />
            <p className="text-sm text-gray-500 mt-1">Points for correct Championship pick</p>
          </div>
        </div>
        
        {/* Bonus Points Settings */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Bonus Points</h2>
          
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={scoringSettings.bonusEnabled}
                onChange={handleToggleBonus}
                disabled={isLeagueArchived}
                className={`form-checkbox h-5 w-5 text-indigo-600 rounded ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
              />
              <span className="ml-2 text-gray-700 font-semibold">Enable Upset Bonus Points</span>
            </label>
            <p className="text-sm text-gray-500 mt-1 ml-7">
              Award bonus points when users correctly predict an upset (lower seed beats higher seed)
            </p>
          </div>
          
          {scoringSettings.bonusEnabled && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-3">Bonus Type</h3>
                
                <div className="flex flex-col space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="bonusType"
                      value="seedDifference"
                      checked={scoringSettings.bonusType === 'seedDifference'}
                      onChange={() => handleBonusTypeChange('seedDifference')}
                      disabled={isLeagueArchived}
                      className={`form-radio h-4 w-4 text-indigo-600 ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                    />
                    <span className="ml-2 text-gray-700">Seed Difference-Based Bonus</span>
                  </label>
                  <p className="text-sm text-gray-500 ml-6">
                    Award bonus points based on the difference between seeds (bigger upsets = more points)
                  </p>
                  
                  <label className="flex items-center cursor-pointer mt-2">
                    <input
                      type="radio"
                      name="bonusType"
                      value="flat"
                      checked={scoringSettings.bonusType === 'flat'}
                      onChange={() => handleBonusTypeChange('flat')}
                      disabled={isLeagueArchived}
                      className={`form-radio h-4 w-4 text-indigo-600 ${isLeagueArchived ? 'cursor-not-allowed' : ''}`}
                    />
                    <span className="ml-2 text-gray-700">Flat Bonus Points</span>
                  </label>
                  <p className="text-sm text-gray-500 ml-6">
                    Award the same bonus points for any upset, regardless of seed difference
                  </p>
                </div>
              </div>
              
              {scoringSettings.bonusType === 'seedDifference' ? (
                <div className="form-group mt-4">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Points Per Seed Difference
                  </label>
                  <input
                    type="number"
                    value={scoringSettings.bonusPerSeedDifference}
                    onChange={(e) => handleInputChange('bonusPerSeedDifference', e.target.value)}
                    min="0"
                    step="0.1"
                    disabled={isLeagueArchived}
                    className={`w-full md:w-1/3 px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Bonus points awarded for each seed difference in a correctly predicted upset<br />
                    <span className="italic">Example: If set to 0.5, a 12-seed beating a 5-seed (difference of 7) would earn 3.5 bonus points</span>
                  </p>
                </div>
              ) : (
                <div className="form-group mt-4">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Flat Bonus Value
                  </label>
                  <input
                    type="number"
                    value={scoringSettings.flatBonusValue}
                    onChange={(e) => handleInputChange('flatBonusValue', e.target.value)}
                    min="0"
                    step="0.1"
                    disabled={isLeagueArchived}
                    className={`w-full md:w-1/3 px-3 py-2 border rounded-lg ${isLeagueArchived ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Fixed bonus points awarded for any correctly predicted upset<br />
                    <span className="italic">Example: If set to 0.5, any correctly predicted upset earns an additional 0.5 points</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Preview/Example */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Examples with Current Settings</h2>
          
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h3 className="font-semibold mb-2">Correct Pick Examples</h3>
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
                  <td className="py-2">Round of 64: 1 seed defeats 16 seed</td>
                  <td className="text-right">{scoringSettings.roundOf64}</td>
                  <td className="text-right">0</td>
                  <td className="text-right font-semibold">{scoringSettings.roundOf64}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Round of 64: 12 seed upsets 5 seed</td>
                  <td className="text-right">{scoringSettings.roundOf64}</td>
                  <td className="text-right">
                    {scoringSettings.bonusEnabled 
                      ? (scoringSettings.bonusType === 'seedDifference' 
                          ? `${(7 * scoringSettings.bonusPerSeedDifference).toFixed(1)}` 
                          : scoringSettings.flatBonusValue)
                      : '0'
                    }
                  </td>
                  <td className="text-right font-semibold">
                    {scoringSettings.bonusEnabled 
                      ? (scoringSettings.bonusType === 'seedDifference'
                          ? (scoringSettings.roundOf64 + 7 * scoringSettings.bonusPerSeedDifference).toFixed(1)
                          : (scoringSettings.roundOf64 + scoringSettings.flatBonusValue).toFixed(1))
                      : scoringSettings.roundOf64}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Sweet 16: 3 seed defeats 2 seed</td>
                  <td className="text-right">{scoringSettings.sweet16}</td>
                  <td className="text-right">
                    {scoringSettings.bonusEnabled 
                      ? (scoringSettings.bonusType === 'seedDifference'
                          ? `${(1 * scoringSettings.bonusPerSeedDifference).toFixed(1)}`
                          : scoringSettings.flatBonusValue)
                      : '0'
                    }
                  </td>
                  <td className="text-right font-semibold">
                    {scoringSettings.bonusEnabled 
                      ? (scoringSettings.bonusType === 'seedDifference'
                          ? (scoringSettings.sweet16 + 1 * scoringSettings.bonusPerSeedDifference).toFixed(1)
                          : (scoringSettings.sweet16 + scoringSettings.flatBonusValue).toFixed(1))
                      : scoringSettings.sweet16}
                  </td>
                </tr>
                <tr>
                  <td className="py-2">Championship: 6 seed wins championship (vs 1 seed)</td>
                  <td className="text-right">{scoringSettings.championship}</td>
                  <td className="text-right">
                    {scoringSettings.bonusEnabled 
                      ? (scoringSettings.bonusType === 'seedDifference'
                          ? `${(5 * scoringSettings.bonusPerSeedDifference).toFixed(1)}`
                          : scoringSettings.flatBonusValue)
                      : '0'
                    }
                  </td>
                  <td className="text-right font-semibold">
                    {scoringSettings.bonusEnabled 
                      ? (scoringSettings.bonusType === 'seedDifference'
                          ? (scoringSettings.championship + 5 * scoringSettings.bonusPerSeedDifference).toFixed(1)
                          : (scoringSettings.championship + scoringSettings.flatBonusValue).toFixed(1))
                      : scoringSettings.championship}
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