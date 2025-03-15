import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaSave, FaLock } from 'react-icons/fa';

/**
 * BaseAdminSettings - A reusable component for admin settings across different game types
 * 
 * @param {Object} props - Component props
 * @param {string} props.gameType - The type of game (e.g., 'marchMadness')
 * @param {Array} props.tabs - Array of tab configurations {id, title, panel}
 * @param {string} props.defaultTab - Default active tab
 * @param {Function} props.fetchData - Function to fetch game-specific data
 * @param {Function} props.saveChanges - Function to save game-specific changes
 * @param {Function} props.canSave - Function to determine if changes can be saved
 * @param {string} props.backPath - Path to navigate back to (default: 'admin')
 * @param {string} props.pageTitle - Title of the settings page
 * @param {React.Component} props.ArchivedWarning - Custom archived warning component
 * @param {React.Component} props.HeaderActions - Custom header actions component
 */
function BaseAdminSettings({
  gameType = '',
  tabs = [],
  defaultTab = '',
  fetchData,
  saveChanges,
  canSave = () => true,
  backPath = 'admin',
  pageTitle = 'Settings',
  ArchivedWarning = null,
  HeaderActions = null,
}) {
  // Common state for settings pages
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [activeTab, setActiveTab] = useState(defaultTab || (tabs[0] && tabs[0].id));
  const [isArchived, setIsArchived] = useState(false);
  
  // Router hooks
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  
  // Fetch data
  useEffect(() => {
    if (!leagueId || !userId) {
      setError("League ID and user ID are required");
      setIsLoading(false);
      return;
    }
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Check if user is league owner
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        const leagueData = leagueSnap.data();
        const ownerStatus = leagueData.ownerId === userId;
        setIsOwner(ownerStatus);
        
        // Check if league is archived
        setIsArchived(leagueData.status === 'archived');
        
        if (!ownerStatus) {
          setError("You don't have permission to access this page");
          setIsLoading(false);
          return;
        }
        
        // Get game-specific data using provided function
        if (fetchData) {
          const gameData = await fetchData(leagueId, userId, leagueData);
          setData(gameData);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error(`Error loading ${gameType} settings:`, err);
        setError(`Failed to load settings. Please try again. ${err.message}`);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [leagueId, userId, gameType, fetchData]);
  
  // Handle save
  const handleSave = async () => {
    if (!isOwner || !leagueId) return;
    
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    // Check if save is allowed based on current state
    if (!canSave(data)) {
      setFeedback("Cannot save changes at this time.");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    
    try {
      setIsSaving(true);
      
      if (saveChanges) {
        await saveChanges(data, leagueId, userId, setFeedback);
      }
      
      setFeedback("Settings saved successfully!");
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      console.error(`Error saving ${gameType} settings:`, err);
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Navigate back to admin dashboard
  const handleBack = () => {
    navigate(`/league/${leagueId}/${backPath}`);
  };
  
  // Show temporary feedback message
  const showFeedback = (message, isError = false, duration = 3000) => {
    setFeedback(isError ? `Error: ${message}` : message);
    setTimeout(() => setFeedback(''), duration);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-gray-600">Loading settings...</p>
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
            <FaArrowLeft className="mr-2" /> Back to Dashboard
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
          
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
        </div>
        
        <div className="flex gap-2">
          {HeaderActions ? (
            <HeaderActions 
              data={data}
              isArchived={isArchived}
              isSaving={isSaving}
              onSave={handleSave}
            />
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving || isArchived || !canSave(data)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSave className="mr-2" /> {isSaving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
      
      {/* Archived League Warning */}
      {isArchived && (
        ArchivedWarning ? (
          <ArchivedWarning />
        ) : (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <FaLock className="text-red-500 mr-3 text-xl" />
              <div>
                <h3 className="font-bold text-red-700">League is Archived</h3>
                <p className="text-red-700">
                  This league has been archived and cannot be edited. You can view the data but cannot make changes.
                </p>
              </div>
            </div>
          </div>
        )
      )}
      
      {/* Feedback messages */}
      {feedback && (
        <div className={`mb-4 p-3 rounded border ${
          feedback.includes('Error') 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}>
          {feedback}
        </div>
      )}
      
      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="mb-6 border-b">
          <div className="flex flex-wrap -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-4 font-medium text-sm mr-2 ${
                  activeTab === tab.id
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.title}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Tab Content */}
      <div className="mb-6">
        {tabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
            {/* Render the panel component with necessary props */}
            {React.cloneElement(tab.panel, {
              data: data,
              onDataChange: setData,
              isArchived: isArchived,
              setFeedback: showFeedback,
              leagueId: leagueId,
              userId: userId
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Making sure the export is explicit and straightforward
export default BaseAdminSettings;