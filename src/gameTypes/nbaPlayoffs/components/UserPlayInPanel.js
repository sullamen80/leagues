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
  onSaveBracket,
  isLocked = false,
  showResults = false,
  isSaving = false,
  saveFeedback = null
}) => {
  return (
    <BasePlayInPanel
      isUserMode={true}
      gameData={gameData}
      userBracket={userBracket}
      onUpdateBracket={onUpdateBracket}
      onSaveBracket={onSaveBracket}
      isLocked={isLocked}
      showResults={showResults}
      isSaving={isSaving}
      saveFeedback={saveFeedback}
    />
  );
};

export default UserPlayInPanel;