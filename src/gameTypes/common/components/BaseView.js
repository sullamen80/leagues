// src/gameTypes/common/components/BaseView.js
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaUser, FaShare, FaLock, FaEyeSlash, FaTrophy } from 'react-icons/fa';

/**
 * BaseView - A reusable component for viewing entries across different game types
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isEmbedded - Whether the component is embedded in another component
 * @param {string} props.leagueId - League ID from props (optional, will use URL param if not provided)
 * @param {string} props.initialEntryId - Initial entry ID to show
 * @param {Function} props.onEntrySelect - Callback when entry is selected (for embedded mode)
 * @param {boolean} props.hideBackButton - Whether to hide the back button
 * @param {boolean} props.fogOfWarEnabled - Whether fog of war is enabled
 * @param {boolean} props.gameCompleted - Whether the game is completed
 * @param {string} props.entryType - Type of entry being viewed (for display purposes)
 * @param {string} props.officialEntryId - ID for the official/reference entry
 * @param {string} props.officialEntryName - Display name for the official entry
 * @param {Function} props.fetchOfficialEntry - Function to fetch the official entry
 * @param {Function} props.fetchEntryData - Function to fetch a specific entry
 * @param {Function} props.fetchEntries - Function to fetch all available entries
 * @param {Function} props.isEntryVisible - Function to determine if an entry is visible under fog of war
 * @param {React.Component} props.EntryViewer - Component for rendering the entry
 * @param {React.Component} props.EntrySelector - Custom component for entry selection (optional)
 * @param {React.Component} props.EmptyEntryRenderer - Component for rendering empty state
 * @param {React.Component} props.LoadingRenderer - Custom loading component (optional)
 * @param {React.Component} props.ErrorRenderer - Custom error component (optional)
 * @param {React.Component} props.HiddenEntryRenderer - Component for hidden entries (optional)
 */
const BaseView = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  initialEntryId = null,
  onEntrySelect = null,
  hideBackButton = false,
  fogOfWarEnabled: propFogOfWarEnabled = false,
  gameCompleted: propGameCompleted = false,
  entryType = 'Entry',
  officialEntryId = 'official',
  officialEntryName = 'Official',
  fetchOfficialEntry,
  fetchEntryData,
  fetchEntries,
  isEntryVisible = () => true,
  EntryViewer,
  EntrySelector = null,
  EmptyEntryRenderer,
  LoadingRenderer = null,
  ErrorRenderer = null,
  HiddenEntryRenderer = null
}) => {
  const [entries, setEntries] = useState([]);
  const [activeEntryId, setActiveEntryId] = useState(officialEntryId);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isFogOfWarEnabled, setIsFogOfWarEnabled] = useState(propFogOfWarEnabled);
  const [isGameCompleted, setIsGameCompleted] = useState(propGameCompleted);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entryData, setEntryData] = useState(null);
  const [officialEntryData, setOfficialEntryData] = useState(null);

  // Use either the prop leagueId or the one from useParams
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const leagueId = propLeagueId || params.leagueId;
  
  // Get entry ID from URL parameters if not embedded
  const searchParams = new URLSearchParams(location.search);
  const urlEntryId = !isEmbedded ? searchParams.get('entryId') : null;
  
  // Set active entry based on URL parameter or initialEntryId
  useEffect(() => {
    if (!isEmbedded && urlEntryId) {
      setActiveEntryId(urlEntryId);
    } else if (isEmbedded && initialEntryId) {
      setActiveEntryId(initialEntryId);
    } else {
      setActiveEntryId(officialEntryId);
    }
  }, [urlEntryId, initialEntryId, isEmbedded, officialEntryId]);
  
  // Load official entry data for comparison
  useEffect(() => {
    const loadOfficialEntryData = async () => {
      if (!leagueId || !fetchOfficialEntry) return;
      
      try {
        const data = await fetchOfficialEntry(leagueId);
        setOfficialEntryData(data);
        
        // Check if game is completed
        if (data && typeof propGameCompleted === 'boolean') {
          setIsGameCompleted(propGameCompleted);
        } else if (data && typeof propGameCompleted === 'function') {
          setIsGameCompleted(propGameCompleted(data));
        }
      } catch (err) {
        console.error("Error loading official entry data:", err);
      }
    };
    
    loadOfficialEntryData();
  }, [leagueId, fetchOfficialEntry, propGameCompleted]);
  
  // Load fog of war settings if not provided as prop
  useEffect(() => {
    if (typeof propFogOfWarEnabled === 'boolean') {
      setIsFogOfWarEnabled(propFogOfWarEnabled);
      return;
    }

    const fetchVisibilitySettings = async () => {
      if (!leagueId) return;
      
      try {
        const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
        const visibilitySnap = await getDoc(visibilityRef);
        
        if (visibilitySnap.exists()) {
          setIsFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
        }
      } catch (err) {
        console.error("Error loading visibility settings:", err);
      }
    };
    
    fetchVisibilitySettings();
  }, [leagueId, propFogOfWarEnabled]);
  
  // Effect to load entry data when active entry changes
  useEffect(() => {
    const loadEntryData = async () => {
      if (!leagueId || !activeEntryId || !fetchEntryData) return;
      
      try {
        const data = await fetchEntryData(leagueId, activeEntryId);
        setEntryData(data);
      } catch (err) {
        console.error(`Error loading entry data for ${activeEntryId}:`, err);
        setEntryData(null);
      }
    };
    
    loadEntryData();
  }, [leagueId, activeEntryId, fetchEntryData]);
  
  // Load league info and available entries
  useEffect(() => {
    if (!leagueId) {
      setError("League ID is required");
      setIsLoading(false);
      return;
    }
    
    const loadLeagueAndEntries = async () => {
      try {
        setIsLoading(true);
        
        // Get league info
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);
        
        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }
        
        const leagueData = leagueSnap.data();
        setLeagueInfo(leagueData);
        
        // Check if current user is admin/owner
        setIsAdmin(leagueData.ownerId === userId);
        
        // Fetch entries using the provided function
        if (fetchEntries) {
          const entriesData = await fetchEntries(leagueId, leagueData, userId);
          setEntries(entriesData);
        } else {
          // Default implementation if fetchEntries not provided
          const officialEntry = { 
            id: officialEntryId, 
            name: officialEntryName, 
            isOfficial: true 
          };
          
          // Get user entries from userData collection
          const userEntriesRef = collection(db, "leagues", leagueId, "userData");
          const userEntriesSnap = await getDocs(userEntriesRef);
          
          if (userEntriesSnap.size === 0) {
            setEntries([officialEntry]);
            setIsLoading(false);
            return;
          }
          
          // Process user data
          const userPromises = userEntriesSnap.docs.map(async (entryDoc) => {
            const entryId = entryDoc.id;
            let username = "Unknown User";
            
            try {
              // Try getting user info directly from the users collection
              const userRef = doc(db, "users", entryId);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const userData = userSnap.data();
                username = userData.displayName || userData.username || userData.email || "Unknown User";
              } else {
                // Fallback to league data if user doc doesn't exist
                if (Array.isArray(leagueData.users)) {
                  const userEntry = leagueData.users.find(user => {
                    if (typeof user === 'string') return user === entryId;
                    return user.id === entryId;
                  });
                  
                  if (userEntry && typeof userEntry !== 'string') {
                    username = userEntry.displayName || userEntry.username || userEntry.email || "Unknown User";
                  }
                }
              }
            } catch (err) {
              console.error("Error fetching user data:", err);
            }
            
            // Make sure we're setting isCurrentUser properly
            const isCurrentUser = entryId === userId;
            
            // Add to entries list
            return {
              id: entryId,
              name: username ? username.trim() : "Unknown User", // Trim any whitespace
              isOfficial: false,
              isCurrentUser: isCurrentUser
            };
          });
          
          // Wait for all user data to be processed
          const userEntries = await Promise.all(userPromises);
          setEntries([officialEntry, ...userEntries]);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading view data:", err);
        setError(`Failed to load ${entryType.toLowerCase()} data. Please try again.`);
        setIsLoading(false);
      }
    };
    
    loadLeagueAndEntries();
  }, [leagueId, userId, fetchEntries, officialEntryId, officialEntryName, entryType]);
  
  // Filter entries based on fog of war settings
  const getVisibleEntries = () => {
    if (!isFogOfWarEnabled || isGameCompleted) {
      // Show all entries if fog of war is disabled or game is completed
      return entries;
    }
    
    // Use custom visibility function if provided
    if (typeof isEntryVisible === 'function') {
      return entries.filter(entry => 
        isEntryVisible(entry, userId, activeEntryId, isAdmin)
      );
    }
    
    // Default visibility: only show official entry and current user's entry
    return entries.filter(entry => 
      entry.isOfficial || entry.isCurrentUser || entry.id === activeEntryId
    );
  };
  
  // Handle entry selection change
  const handleEntryChange = (entryId) => {
    setActiveEntryId(entryId);
    
    if (isEmbedded && onEntrySelect) {
      // Use the callback when embedded
      onEntrySelect(entryId);
    } else {
      // Update URL with the selected entry (when not embedded)
      if (entryId === officialEntryId) {
        navigate(`/league/${leagueId}/view`);
      } else {
        navigate(`/league/${leagueId}/view?entryId=${entryId}`);
      }
    }
  };
  
  // Handle sharing functionality
  const handleShareClick = () => {
    let url;
    
    if (activeEntryId === officialEntryId) {
      url = `${window.location.origin}/league/${leagueId}/view`;
    } else {
      url = `${window.location.origin}/league/${leagueId}/view?entryId=${activeEntryId}`;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(err => {
        console.error("Failed to copy URL:", err);
      });
  };
  
  // Handle back navigation
  const handleBack = () => {
    if (isEmbedded) {
      // No navigation when embedded
      return;
    }
    navigate(`/league/${leagueId}`);
  };
  
  // Check if the entry is hidden due to fog of war
  const isEntryHidden = () => {
    if (!isFogOfWarEnabled || isGameCompleted) {
      return false;
    }
    
    if (activeEntryId === officialEntryId) {
      return false;
    }
    
    if (activeEntryId === userId) {
      return false;
    }
    
    // If we're rendering a specific entry from URL and fog of war is on
    return true;
  };
  
  // Loading state
  if (isLoading) {
    if (LoadingRenderer) {
      return <LoadingRenderer />;
    }
    
    return (
      <div className="max-w-full sm:max-w-7xl mx-0 sm:mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">    
        <div className="flex flex-col items-center justify-center p-4 sm:p-8">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-indigo-500 mb-3 sm:mb-4"></div>
          <p className="text-gray-600">Loading {entryType.toLowerCase()} data...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    if (ErrorRenderer) {
      return <ErrorRenderer error={error} />;
    }
    
    return (
      <div className="bg-red-100 border-0 sm:border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-none sm:rounded mb-4">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }
  
  const visibleEntries = getVisibleEntries();
  const entryHidden = isEntryHidden();
  
  return (
    <div className="max-w-full sm:max-w-7xl mx-0 sm:mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">
      {/* Header with navigation and sharing - only show if not embedded or hideBackButton is false */}
      {!isEmbedded && !hideBackButton && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b px-2 sm:px-0">
          <div className="flex items-center space-x-2 sm:space-x-4 mb-3 sm:mb-0">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-indigo-600 transition"
            >
              <FaArrowLeft className="mr-1 sm:mr-2" /> Back
            </button>
            
            <h1 className="text-lg sm:text-2xl font-bold truncate">
              {activeEntryId === officialEntryId 
                ? officialEntryName
                : `${entries.find(e => e.id === activeEntryId)?.name}${entries.find(e => e.id === activeEntryId)?.isCurrentUser ? ' (You)' : ''}`
              }
            </h1>
          </div>
          
          <div className="flex items-center">
            <button
              onClick={handleShareClick}
              className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition text-sm sm:text-base"
            >
              <FaShare className="mr-1" />
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Fog of War notice if enabled */}
      {isFogOfWarEnabled && !isGameCompleted && (
        <div className="mb-4 sm:mb-6 bg-yellow-50 border-0 sm:border border-yellow-200 rounded-none sm:rounded-lg p-2 sm:p-4 mx-2 sm:mx-0">
          <div className="flex items-start sm:items-center">
            <FaEyeSlash className="text-yellow-600 mr-2 sm:mr-3 text-lg sm:text-xl flex-shrink-0 mt-1 sm:mt-0" />
            <div>
              <h3 className="font-semibold text-yellow-800 text-sm sm:text-base">Fog of War Mode Active</h3>
              <p className="text-yellow-700 text-xs sm:text-sm">
                {isAdmin 
                  ? `Fog of War mode is enabled. As an admin, you are also subject to Fog of War restrictions to ensure fair play.` 
                  : `Only the ${officialEntryName.toLowerCase()} and your own ${entryType.toLowerCase()} are visible until the game is completed.`}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Entry selector */}
      <div className="mb-4 sm:mb-6 px-2 sm:px-0">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select {entryType}</label>
        
        {EntrySelector ? (
          <EntrySelector 
            entries={visibleEntries}
            activeEntryId={activeEntryId}
            onEntrySelect={handleEntryChange}
            isGameCompleted={isGameCompleted}
            isFogOfWarEnabled={isFogOfWarEnabled}
            userId={userId}
            officialEntryId={officialEntryId}
            officialEntryName={officialEntryName}
          />
        ) : (
          <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
            <div className="flex whitespace-nowrap sm:flex-wrap gap-1 sm:gap-2">
              {visibleEntries.length > 1 ? (
                <>
                  {visibleEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => handleEntryChange(entry.id)}
                      className={`flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded transition text-sm ${
                        activeEntryId === entry.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }`}
                    >
                      {entry.isOfficial ? <FaTrophy className="mr-1 sm:mr-2" /> : <FaUser className="mr-1 sm:mr-2" />}
                      <span className="truncate max-w-32 sm:max-w-none">
                        {entry.name}
                        {entry.isCurrentUser ? " (You)" : ""}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <div className="text-gray-500 italic text-sm">
                  {isFogOfWarEnabled && !isGameCompleted ?
                    `Fog of War is enabled. Only the ${officialEntryName.toLowerCase()} and your ${entryType.toLowerCase()} are visible.` :
                    `No user ${entryType.toLowerCase()}s found. Only the ${officialEntryName.toLowerCase()} is available.`
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* League info */}
      <div className="bg-gray-50 p-2 sm:p-4 rounded-none sm:rounded-lg mb-4 sm:mb-6 mx-2 sm:mx-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <p className="text-gray-600 text-xs sm:text-sm mb-1 sm:mb-0">
            View-only mode: {entryType.toLowerCase()}s shown here cannot be edited
          </p>
          {leagueInfo?.lastUpdated && (
            <p className="text-gray-500 text-xs">
              Last updated: {new Date(leagueInfo.lastUpdated.toDate()).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      
      {/* Entry display */}
      <div className="bg-white border-0 sm:border rounded-none sm:rounded-lg p-2 sm:p-2 mx-0">
        {/* If entry is hidden due to Fog of War */}
        {entryHidden ? (
          HiddenEntryRenderer ? (
            <HiddenEntryRenderer 
              isAdmin={isAdmin} 
              userId={userId} 
              handleEntryChange={handleEntryChange}
              officialEntryId={officialEntryId}
            />
          ) : (
            <div className="text-center py-6 sm:py-12">
              <FaEyeSlash className="text-4xl sm:text-6xl text-gray-300 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">{entryType} Hidden</h3>
              <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base px-2 sm:px-0">
                This {entryType.toLowerCase()} is hidden while Fog of War mode is active. You can view the {officialEntryName.toLowerCase()} 
                and your own {entryType.toLowerCase()}, but other players' {entryType.toLowerCase()}s will remain hidden until the game 
                is completed.
                {isAdmin && ` As admin, you are also subject to Fog of War to ensure fair play.`}
              </p>
              <div className="flex flex-col sm:flex-row justify-center mt-4 sm:mt-6 space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => handleEntryChange(officialEntryId)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                >
                  View {officialEntryName}
                </button>
                {userId && (
                  <button
                    onClick={() => handleEntryChange(userId)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    View Your {entryType}
                  </button>
                )}
              </div>
            </div>
          )
        ) : activeEntryId && entryData ? (
          <div className="overflow-x-auto">
            <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 text-center">
              {activeEntryId === officialEntryId 
                ? officialEntryName
                : `${entries.find(e => e.id === activeEntryId)?.name}${entries.find(e => e.id === activeEntryId)?.isCurrentUser ? ' (You)' : ''}'s ${entryType}`
              }
            </h3>
            
            {/* Render the entry using the provided component */}
            <EntryViewer 
              bracketData={entryData}
              isLocked={true}
              isAdmin={false}
              onSelectWinner={() => {}} // Empty function to disable interaction
              officialBracket={activeEntryId !== officialEntryId ? officialEntryData : null} // Pass official entry when viewing user entry
            />
            
            {/* Last updated info */}
            {entryData.updatedAt && (
              <div className="text-right text-xs text-gray-500 mt-2">
                Last updated: {new Date(entryData.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          EmptyEntryRenderer ? (
            <EmptyEntryRenderer 
              activeEntryId={activeEntryId}
              officialEntryId={officialEntryId}
              entryType={entryType}
            />
          ) : (
            <div className="text-center py-6 sm:py-8 text-gray-500">
              {!activeEntryId ? (
                <p>No {entryType.toLowerCase()} selected. Please select an {entryType.toLowerCase()} to view.</p>
              ) : (
                <div className="flex flex-col items-center">
                  <FaLock className="text-3xl sm:text-4xl mb-2 sm:mb-3 text-gray-400" />
                  <p className="mb-1">{entryType} data not available</p>
                  <p className="text-xs sm:text-sm text-gray-400">
                    {activeEntryId === officialEntryId 
                      ? `The ${officialEntryName.toLowerCase()} hasn't been created yet.` 
                      : `This user hasn't filled out their ${entryType.toLowerCase()} yet.`}
                  </p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default BaseView;