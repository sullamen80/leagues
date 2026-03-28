import React, { useState, useEffect } from 'react';
import UserPlayInPanel from './UserPlayInPanel';
import AdminPlayInPanel from '../components/AdminSettings/AdminPlayInPanel'; 
import { FaBasketballBall, FaTrophy, FaUserCog } from 'react-icons/fa';
import { ROUND_KEYS } from '../constants/playoffConstants';

/**
 * Tabbed interface for the Play-In Tournament panel
 * Allows switching between predictions and results views for users
 * Or provides admin controls for league managers
 */
const PlayInTabs = ({
  // Common props
  gameData,
  userBracket,
  onUpdateBracket,
  onSaveBracket,
  isLocked = false,
  isSaving = false,
  saveFeedback = null,
  tournamentCompleted = false,
  // Admin-specific props
  isAdmin = false,
  adminData = null,
  onAdminDataChange = null,
  isAdminLoading = false,
  isLeagueArchived = false,
  onBack = null,
  // New props for hiding UI elements
  hideAboutSection = false,
  hidePredictionsLockedMessage = false,
  // Add scoringSettings prop
  scoringSettings = null
}) => {
  // State to track active tab
  const [activeTab, setActiveTab] = useState(isAdmin ? 'admin' : 'predictions');

  // Debug the scoring settings to verify they're being passed correctly
  useEffect(() => {
    console.log('[PlayInTabs] Received props:', {
      'gameData.scoringSettings': gameData?.scoringSettings,
      'separate scoringSettings prop': scoringSettings,
      'gameData.settings': gameData?.settings
    });
  }, [gameData, scoringSettings]);

  // Set initial tab once when component mounts or when tournament status changes
  // This prevents continuous re-rendering
  useEffect(() => {
    // Only for user mode, not admin mode
    if (!isAdmin) {
      // Only change the tab if we're sure about the conditions
      if (tournamentCompleted && userBracket) {
        const hasPlayInPredictions = userBracket && 
                                   userBracket[ROUND_KEYS.PLAY_IN] && 
                                   Object.keys(userBracket[ROUND_KEYS.PLAY_IN]).length > 0;
        
        if (!hasPlayInPredictions) {
          setActiveTab('results');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentCompleted, isAdmin]);

  // Render the appropriate content based on user type and active tab
  const renderContent = () => {
    if (isAdmin) {
      return (
        <AdminPlayInPanel
          data={adminData || { tournamentData: gameData }}
          onDataChange={onAdminDataChange}
          isLoading={isAdminLoading}
          isLeagueArchived={isLeagueArchived}
          onBack={onBack}
          // Pass scoring settings to admin panel if needed
          scoringSettings={scoringSettings}
        />
      );
    } else {
      return (
        <UserPlayInPanel
          gameData={gameData}
          userBracket={userBracket}
          onUpdateBracket={onUpdateBracket}
          onSaveBracket={onSaveBracket}
          isLocked={isLocked || activeTab === 'results'} // Lock editing when viewing results
          showResults={activeTab === 'results'}
          isSaving={isSaving}
          saveFeedback={saveFeedback}
          // Pass through the props for hiding UI elements
          hideAboutSection={hideAboutSection}
          hidePredictionsLockedMessage={hidePredictionsLockedMessage}
          // Pass scoringSettings to UserPlayInPanel
          scoringSettings={scoringSettings}
        />
      );
    }
  };

  return (
    <div className="play-in-tabs">
      {/* Tab Navigation - different tabs for admin vs user */}
      {isAdmin ? (
        // Admin view - single tab for management
        <div className="flex border-b mb-4 bg-gray-50 rounded-t-lg">
          <div className="px-4 py-2 font-medium text-sm flex items-center border-b-2 border-indigo-500 text-indigo-600 bg-white">
            <FaUserCog className="mr-2" />
            Play-In Tournament Management
          </div>
        </div>
      ) : (
        // User view - prediction vs results tabs
        <div className="flex border-b mb-4 bg-gray-50 rounded-t-lg">
          {/* Tab content rendered elsewhere */}
        </div>
      )}

      {/* Content based on user type and active tab */}
      {renderContent()}
    </div>
  );
};

export default PlayInTabs;