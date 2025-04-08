// src/gameTypes/nbaPlayoffs/components/PlayoffsAdminTeams.js
import React from 'react';
import { FaClipboardCheck, FaExclamationTriangle, FaTrophy, FaUsers } from 'react-icons/fa';
import BaseAdminParticipants from '../../common/components/BaseAdminParticipants';
import { ROUND_KEYS, ROUND_DISPLAY_NAMES } from '../constants/playoffConstants';

/**
 * Admin component for managing NBA Playoffs league participants
 * Extends BaseAdminParticipants with NBA Playoffs specific functionality
 */
const AdminTeams = () => {
  // Function to get round data using standardized keys
  const getRoundData = (participant, roundKey) => {
    if (!participant.entryData) return null;
    return participant.entryData[roundKey] || [];
  };

  // Function to determine if a participant has completed their bracket
  const getBracketStatus = (participant) => {
    // Get first round data using standardized key
    const firstRoundData = getRoundData(participant, ROUND_KEYS.FIRST_ROUND);
    
    // Check if the participant has filled out any part of their bracket
    const hasBracket = firstRoundData && 
      (Array.isArray(firstRoundData) && firstRoundData.some(m => m && m.predictedWinner));
    
    // Check if they've made a championship prediction
    const finalsData = getRoundData(participant, ROUND_KEYS.NBA_FINALS);
    const hasChampion = finalsData && finalsData.predictedWinner;
    
    // Return status object with all the necessary display properties
    return {
      hasEntry: hasBracket,
      hasBracket: hasBracket, // For compatibility with the base implementation
      hasChampion: hasChampion,
      statusText: hasBracket 
        ? (hasChampion ? 'Complete Bracket' : 'Partial Bracket') 
        : 'No Bracket',
      statusClass: hasChampion 
        ? 'bg-green-100 text-green-800' 
        : (hasBracket ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'),
      statusIcon: hasChampion 
        ? <FaTrophy className="mr-1" /> 
        : (hasBracket ? <FaClipboardCheck className="mr-1" /> : <FaExclamationTriangle className="mr-1" />)
    };
  };
  
  // Verification message when removing a participant
  const getBracketVerificationMessage = (participant) => {
    return "This participant has already filled out their playoff bracket. All their predictions will be lost.";
  };
  
  // Render custom stats cards
  const renderPlayoffsStats = (stats, participants, isArchived) => {
    // Calculate advanced stats
    const totalParticipants = participants.length;
    const withBrackets = participants.filter(p => p.hasBracket).length;
    const withComplete = participants.filter(p => p.hasChampion).length;
    const withPartial = withBrackets - withComplete;
    const withoutBrackets = totalParticipants - withBrackets;
    const fillRate = totalParticipants > 0 
      ? Math.round((withBrackets / totalParticipants) * 100)
      : 0;
    const completeRate = totalParticipants > 0 
      ? Math.round((withComplete / totalParticipants) * 100)
      : 0;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 px-2 sm:px-0">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-blue-700">Total Participants</span>
            <span className="text-lg sm:text-xl font-bold text-blue-800">{totalParticipants}</span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-green-700">Complete Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-green-800">{withComplete}</span>
            <span className="text-xs text-green-600">{completeRate}% of participants</span>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-yellow-700">Partial Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-yellow-800">{withPartial}</span>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm text-red-700">No Brackets</span>
            <span className="text-lg sm:text-xl font-bold text-red-800">{withoutBrackets}</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render additional participant details
  const renderParticipantDetails = (participant) => {
    // Get finals data using the standardized key
    const finalsData = getRoundData(participant, ROUND_KEYS.NBA_FINALS);
    
    // Display champion pick if available
    if (finalsData && finalsData.predictedWinner) {
      return (
        <div className="mt-2 text-sm">
          <span className="font-semibold">Champion Pick:</span>{' '}
          <span className="text-indigo-700">
            {finalsData.predictedWinner}
          </span>
          
          {/* Show Finals MVP pick if available */}
          {finalsData.predictedMVP && (
            <span className="ml-2">
              <span className="font-semibold">{ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]}:</span>{' '}
              <span className="text-indigo-700">
                {finalsData.predictedMVP}
              </span>
            </span>
          )}
        </div>
      );
    }
    
    return null;
  };
  
  // Generate action buttons for participants
  const renderActionButtons = (participant, leagueId) => {
    // Base URL for viewing a participant's bracket
    const viewBracketUrl = `/leagues/${leagueId}/playoffs/bracket/${participant.id}`;
    
    return (
      <div className="flex space-x-2">
        <a
          href={viewBracketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          View Bracket
        </a>
      </div>
    );
  };
  
  return (
    <BaseAdminParticipants 
      entryType="Bracket"
      getParticipantStatus={getBracketStatus}
      renderParticipantDetails={renderParticipantDetails}
      renderStatsCards={renderPlayoffsStats}
      renderActionButtons={renderActionButtons}
      getEntryVerificationMessage={getBracketVerificationMessage}
      pageTitle="Manage Participants"
      backPath="admin"
    />
  );
};

export default AdminTeams;