// src/gameTypes/common/components/BaseLeagueSetup.js
import React, { useState } from 'react';
import { FaCog, FaInfoCircle, FaLock } from 'react-icons/fa';

/**
 * BaseLeagueSetup - A reusable component for setting up leagues for different game types
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onCreateLeague - Function to call when creating the league
 * @param {Object} props.currentUser - Current user information
 * @param {React.Component} props.GameIcon - Icon component for the specific game type
 * @param {string} props.gameTypeId - ID of the game type
 * @param {string} props.gameTypeName - Display name of the game type
 * @param {React.Component} props.AdvancedOptions - Component to render game-specific advanced options
 * @param {Function} props.validateGameSpecificFields - Function to validate game-specific fields
 * @param {Function} props.getGameSpecificData - Function to get game-specific data for submission
 */
const BaseLeagueSetup = ({
  onCreateLeague,
  currentUser,
  GameIcon,
  gameTypeId,
  gameTypeName = 'League',
  AdvancedOptions = null,
  validateGameSpecificFields = () => ({}),
  getGameSpecificData = () => ({})
}) => {
  // Common form state
  const [leagueName, setLeagueName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Validate common form fields
  const validateCommonFields = () => {
    const newErrors = {};
    
    if (!leagueName.trim()) {
      newErrors.leagueName = 'League name is required';
    } else if (leagueName.length > 50) {
      newErrors.leagueName = 'League name must be 50 characters or less';
    }
    
    if (description && description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }
    
    if (isPasswordProtected && !password.trim()) {
      newErrors.password = 'Password is required for password-protected leagues';
    } else if (isPasswordProtected && password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    return newErrors;
  };
  
  // Validate the entire form
  const validateForm = () => {
    // Validate common fields
    const commonErrors = validateCommonFields();
    
    // Validate game-specific fields
    const gameSpecificErrors = validateGameSpecificFields ? validateGameSpecificFields() : {};
    
    // Combine errors
    const combinedErrors = {...commonErrors, ...gameSpecificErrors};
    
    setErrors(combinedErrors);
    return Object.keys(combinedErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare league data with common fields
      const leagueData = {
        title: leagueName.trim(),
        description: description.trim(),
        private: isPrivate,
        passwordProtected: isPasswordProtected,
        password: isPasswordProtected ? password : null,
        gameTypeId: gameTypeId,
        createdBy: currentUser?.uid,
        createdAt: new Date().toISOString(),
      };
      
      // Get game-specific data
      const gameData = await getGameSpecificData();
      
      // Combine the data
      const combinedData = {
        ...leagueData,
        ...gameData
      };
      
      // Submit the data
      const result = await onCreateLeague(combinedData);
      
      if (!result.success) {
        setErrors({
          ...errors,
          submit: result.error || `Failed to create ${gameTypeName.toLowerCase()}`
        });
      }
    } catch (err) {
      console.error(`Error creating ${gameTypeName.toLowerCase()}:`, err);
      setErrors({
        ...errors,
        submit: err.message || 'An unexpected error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <div className="mr-4 bg-gray-100 p-3 rounded-full">
          {GameIcon ? <GameIcon className="text-indigo-500 text-2xl" /> : <FaCog className="text-indigo-500 text-2xl" />}
        </div>
        <h1 className="text-2xl font-bold">Create {gameTypeName}</h1>
      </div>
      
      {errors.submit && (
        <div className="mb-6 p-3 bg-red-100 text-red-800 rounded border border-red-200">
          {errors.submit}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Basic Info Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b">League Information</h2>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="leagueName">
              League Name*
            </label>
            <input
              id="leagueName"
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder={`e.g., Office ${gameTypeName} 2025`}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.leagueName ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength="50"
            />
            {errors.leagueName && (
              <p className="text-red-500 text-xs mt-1">{errors.leagueName}</p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell others what this league is about..."
              className={`w-full px-3 py-2 border rounded-md ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              rows="3"
              maxLength="500"
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              {description.length}/500 characters
            </p>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center">
              <input
                id="private"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-gray-700 text-sm font-bold" htmlFor="private">
                Private League
              </label>
            </div>
            <p className="text-gray-500 text-xs mt-1 ml-6">
              Private leagues are only accessible by invitation
            </p>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center">
              <input
                id="passwordProtected"
                type="checkbox"
                checked={isPasswordProtected}
                onChange={(e) => {
                  setIsPasswordProtected(e.target.checked);
                  if (!e.target.checked) {
                    setPassword('');
                    setErrors({...errors, password: null});
                  }
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-gray-700 text-sm font-bold" htmlFor="passwordProtected">
                Password Protected
              </label>
            </div>
            <p className="text-gray-500 text-xs mt-1 ml-6">
              Require a password to join this league
            </p>
            
            {isPasswordProtected && (
              <div className="mt-3 ml-6">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                  Password*
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a password for your league"
                    className={`w-full pl-10 px-3 py-2 border rounded-md ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Members will need this password to join your league
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Advanced Options Section */}
        {AdvancedOptions && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-indigo-600 hover:text-indigo-800 text-sm font-medium focus:outline-none"
            >
              {showAdvanced ? '- Hide Advanced Options' : '+ Show Advanced Options'}
            </button>
            
            {showAdvanced && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <AdvancedOptions errors={errors} setErrors={setErrors} />
              </div>
            )}
          </div>
        )}
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? `Creating ${gameTypeName}...` : `Create ${gameTypeName}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BaseLeagueSetup;