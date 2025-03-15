// src/gameTypes/common/components/BaseEditor.js
// IMPORTANT: This component may cause bundling/import issues in some React configurations.
// If you encounter errors like "InvalidCharacterError: Failed to execute 'createElement' on 'Document'",
// you have several options:
// 1. Use the absolute path from src: import BaseEditor from '../../../gameTypes/common/components/BaseEditor';
// 2. Configure webpack/bundler aliases to resolve the path correctly
// 3. Copy the component's functionality directly into your specific component
// 
// These base components are intended for refactoring, but may require proper bundler configuration
// to work as expected across different parts of the application.
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaUndo, FaInfoCircle, FaLock } from 'react-icons/fa';

/**
 * BaseEditor - A reusable component for editing entries in different game types
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isEmbedded - Whether the component is embedded in another component
 * @param {string} props.leagueId - League ID from props (optional, will use URL param if not provided)
 * @param {boolean} props.hideBackButton - Whether to hide the back button 
 * @param {string} props.entryType - The type of entry being edited (for display purposes)
 * @param {Function} props.fetchData - Function to fetch game data and user entry
 * @param {Function} props.createEmptyEntry - Function to create an empty entry if user doesn't have one
 * @param {Function} props.saveEntry - Function to save the entry
 * @param {Function} props.resetEntry - Function to reset the entry
 * @param {Object} props.instructions - Instructions for the user {title, items}
 * @param {React.Component} props.EditorComponent - The specific editor component to render
 * @param {Object} props.editorProps - Additional props to pass to the editor component
 */
const BaseEditor = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  entryType = 'Entry',
  fetchData,
  createEmptyEntry,
  saveEntry,
  resetEntry,
  instructions = null,
  EditorComponent,
  editorProps = {}
}) => {
  // Common state for any editor
  const [gameData, setGameData] = useState(null);
  const [userEntry, setUserEntry] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLeagueArchived, setIsLeagueArchived] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Router hooks
  const params = useParams();
  const navigate = useNavigate();
  const leagueId = propLeagueId || params.leagueId;
  const userId = auth.currentUser?.uid;
  
  // Fetch data and check lock status
  useEffect(() => {
    if (!leagueId || !userId) {
      setError(`You must be logged in to edit ${entryType.toLowerCase()}`);
      setIsLoading(false);
      return;
    }
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Get league data to check archive status
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        // Check if league is archived
        const leagueData = leagueSnap.data();
        if (leagueData.status === 'archived') {
          setIsLeagueArchived(true);
          setIsLocked(true);
        }
        
        // Run the provided fetchData function to get game-specific data
        const { gameData, userEntry, isLocked: entryLocked } = await fetchData(leagueId, userId);
        
        setGameData(gameData);
        
        // If user has an entry, use it; otherwise, create an empty one
        if (userEntry) {
          setUserEntry(userEntry);
        } else if (gameData && createEmptyEntry) {
          const emptyEntry = createEmptyEntry(gameData);
          setUserEntry(emptyEntry);
        }
        
        // Update lock status if provided by the fetchData function
        if (entryLocked) {
          setIsLocked(true);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error(`Error loading ${entryType.toLowerCase()} data:`, err);
        setError(`Failed to load ${entryType.toLowerCase()} data. Please try again.`);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [leagueId, userId, fetchData, createEmptyEntry, entryType]);
  
  // Handle entry updating
  const handleEntryUpdate = (updatedEntry) => {
    setUserEntry(updatedEntry);
    setHasChanges(true);
  };
  
  // Reset entry
  const handleReset = () => {
    if (isLocked || isLeagueArchived) {
      setFeedback(isLeagueArchived 
        ? "This league is archived and entries cannot be edited" 
        : `${entryType} is locked and cannot be edited`);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (!gameData) return;
    
    const confirmReset = window.confirm(`Are you sure you want to reset your ${entryType.toLowerCase()}? This will clear all your selections.`);
    if (confirmReset) {
      // Use the provided reset function
      const resetData = resetEntry(gameData);
      
      setUserEntry(resetData);
      setHasChanges(true);
      setFeedback(`${entryType} has been reset`);
      setTimeout(() => setFeedback(''), 3000);
    }
  };
  
  // Save entry
  const handleSave = async () => {
    if (isLocked || isLeagueArchived) {
      setFeedback(isLeagueArchived 
        ? "This league is archived and entries cannot be edited" 
        : `${entryType} is locked and cannot be edited`);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    if (!userEntry) {
      setFeedback(`No ${entryType.toLowerCase()} data to save`);
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Use the provided save function
      await saveEntry(leagueId, userId, userEntry);
      
      setHasChanges(false);
      setFeedback(`${entryType} saved successfully!`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error(`Error saving ${entryType.toLowerCase()}:`, err);
      setFeedback(`Error saving ${entryType.toLowerCase()}. Please try again.`);
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
      const confirmLeave = window.confirm(`You have unsaved changes. Are you sure you want to leave?`);
      if (!confirmLeave) return;
    }
    
    navigate(`/league/${leagueId}`);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading {entryType.toLowerCase()} data...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-lg shadow-md dash-game-container">
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
    <div className="max-w-7xl mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-lg shadow-md dash-game-container">
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
            
            <h1 className="text-2xl font-bold">Edit Your {entryType}</h1>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReset}
              disabled={isLocked || isLeagueArchived || isSaving}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUndo className="mr-2" /> Reset
            </button>
            
            <button
              onClick={handleSave}
              disabled={isLocked || isLeagueArchived || isSaving || !hasChanges}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSave className="mr-2" /> {isSaving ? "Saving..." : `Save ${entryType}`}
            </button>
          </div>
        </div>
      )}
      
      {/* When embedded, show a simpler header with just the save buttons */}
      {(isEmbedded || hideBackButton) && (
        <div className="flex justify-end mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReset}
              disabled={isLocked || isLeagueArchived || isSaving}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaUndo className="mr-2" /> Reset
            </button>
            
            <button
              onClick={handleSave}
              disabled={isLocked || isLeagueArchived || isSaving || !hasChanges}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSave className="mr-2" /> {isSaving ? "Saving..." : `Save ${entryType}`}
            </button>
          </div>
        </div>
      )}
      
      {/* Archived League Warning */}
      {isLeagueArchived && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-2 sm:p-4">
          <div className="flex items-center">
            <FaLock className="text-red-500 mr-3 text-xl" />
            <div>
              <h3 className="font-bold text-red-700">League is Archived</h3>
              <p className="text-red-700">
                This league has been archived and {entryType.toLowerCase()}s cannot be edited. 
                You can view your {entryType.toLowerCase()} but cannot make changes.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Feedback message */}
      {feedback && (
        <div className={`mb-4 p-2 sm:p-3 rounded border ${
          feedback.includes('Error') 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback}
        </div>
      )}
      
      {/* Instructions - only show if not archived and not locked */}
      {!isLeagueArchived && !isLocked && instructions && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-2 sm:p-4 rounded-lg mb-6">
          <div className="flex items-start">
            <FaInfoCircle className="mt-1 mr-3 text-blue-500" />
            <div>
              <h3 className="font-bold mb-1">{instructions.title || `How to fill out your ${entryType.toLowerCase()}:`}</h3>
              <ul className="text-sm list-disc list-inside space-y-1">
                {instructions.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Editor Component */}
      <div className="bg-white border rounded-lg p-0 sm:p-6 round-container">
        {userEntry && EditorComponent ? (
          <EditorComponent
            data={userEntry}
            gameData={gameData}
            onUpdate={handleEntryUpdate}
            isLocked={isLocked || isLeagueArchived}
            isAdmin={false}
            {...editorProps}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Unable to load {entryType.toLowerCase()} data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseEditor;