import React from 'react';
import BasePlayInPanel from './BasePlayInPanel';

/**
 * User panel for managing NBA Play-In tournament predictions
 * This is a thin wrapper around BasePlayInPanel that passes user-specific props
 */
const UserPlayInPanel = ({
  gameData,
  userBracket,
  onUpdateBracket,
  isLocked = false,
  showResults = false,
  hideAboutSection = false,
  hidePredictionsLockedMessage = false,
  // Add scoringSettings prop
  scoringSettings = null,
  // Add leagueId which is required for direct saving
  leagueId
}) => {

  
  return (
    <BasePlayInPanel
      isUserMode={true}
      gameData={gameData}
      userBracket={userBracket}
      onUpdateBracket={onUpdateBracket}
      isLocked={isLocked}
      showResults={showResults}
      // Pass through the props for hiding UI elements
      hideAboutSection={hideAboutSection}
      hidePredictionsLockedMessage={hidePredictionsLockedMessage}
      // Pass scoringSettings if it exists, otherwise we'll rely on the BasePlayInPanel to extract it
      scoringSettings={scoringSettings}
      // Pass the leagueId required for saving
      leagueId={leagueId}
    />
  );
};

export default UserPlayInPanel;