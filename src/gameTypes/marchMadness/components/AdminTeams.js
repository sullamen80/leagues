// src/gameTypes/marchMadness/components/AdminTeams.js
import React from 'react';
import { FaClipboardCheck, FaExclamationTriangle } from 'react-icons/fa';
import BaseAdminParticipants from '../../common/components/BaseAdminParticipants';

/**
 * Admin component for managing March Madness league participants
 * Extends BaseAdminParticipants with March Madness specific functionality
 */
const AdminTeams = () => {
  // Function to determine if a participant has completed their bracket
  const getBracketStatus = (participant) => {
    // Check if the participant has filled out any part of their bracket
    const hasBracket = participant.entryData && 
      participant.entryData.RoundOf64 && 
      participant.entryData.RoundOf64.some(m => m && m.winner);
    
    // Return status object with all the necessary display properties
    return {
      hasEntry: hasBracket,
      hasBracket: hasBracket, // For compatibility with the original implementation
      statusText: hasBracket ? 'Bracket Saved' : 'No Bracket',
      statusClass: hasBracket ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
      statusIcon: hasBracket ? <FaClipboardCheck className="mr-1" /> : <FaExclamationTriangle className="mr-1" />
    };
  };
  
  // Verification message when removing a participant
  const getBracketVerificationMessage = (participant) => {
    return "This participant has already filled out their bracket. All their progress will be lost.";
  };
  
  // Render custom stats cards if needed
  const renderMarchMadnessStats = (stats, participants, isArchived) => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 px-2 sm:px-0">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-blue-700">Total Participants</span>
            <span className="text-lg sm:text-xl font-bold text-blue-800">{participants.length}</span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-green-700">With Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-green-800">
              {participants.filter(p => p.hasBracket).length}
            </span>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-yellow-700">Without Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-yellow-800">
              {participants.filter(p => !p.hasBracket).length}
            </span>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-purple-700">Bracket Fill Rate</span>
            <span className="text-lg sm:text-xl font-bold text-purple-800">
              {participants.length > 0 
                ? Math.round((participants.filter(p => p.hasBracket).length / participants.length) * 100)
                : 0}%
            </span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render additional participant details if needed
  const renderParticipantDetails = (participant) => {
    // For now, we won't add any additional details
    // This is a placeholder for any custom details we might want to add later
    return null;
  };
  
  return (
    <BaseAdminParticipants 
      entryType="Bracket"
      getParticipantStatus={getBracketStatus}
      renderParticipantDetails={renderParticipantDetails}
      renderStatsCards={renderMarchMadnessStats}
      getEntryVerificationMessage={getBracketVerificationMessage}
      pageTitle="Manage Participants"
      backPath="admin"
    />
  );
};

export default AdminTeams;