// src/gameTypes/marchMadness/components/AdminDashboard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBasketballBall, FaUsers, FaClipboardCheck, FaLock, FaCog, FaCalculator, FaDownload, FaTrophy } from 'react-icons/fa';
import BaseAdminDashboard from '../../common/components/BaseAdminDashboard';

/**
 * Admin dashboard for March Madness tournament
 * Extends the BaseAdminDashboard with basketball-specific functionality
 */
const AdminDashboard = () => {
  const navigate = useNavigate();

  // NCAA Tournament specific rounds
  const marchmadnessRounds = [
    'RoundOf64', 
    'RoundOf32', 
    'Sweet16', 
    'Elite8', 
    'FinalFour', 
    'Championship'
  ];
  
  // Get tournament status
  const getTournamentStatus = (tournamentData) => {
    if (!tournamentData) return 'Not Set Up';
    
    if (tournamentData.Champion) {
      return 'Completed';
    }
    
    if (tournamentData.RoundOf64 && tournamentData.RoundOf64.some(match => match && match.winner)) {
      return 'In Progress';
    }
    
    if (getTeamCount(tournamentData) > 0) {
      return 'Teams Set';
    }
    
    return 'Not Started';
  };
  
  // Count filled teams in the tournament
  const getTeamCount = (tournamentData) => {
    if (!tournamentData?.SetTeams) return 0;
    
    const regions = ['eastRegion', 'westRegion', 'midwestRegion', 'southRegion'];
    let count = 0;
    
    regions.forEach(region => {
      if (Array.isArray(tournamentData.SetTeams[region])) {
        count += tournamentData.SetTeams[region].filter(team => team && team.name).length;
      }
    });
    
    return count;
  };
  
  // Get completion status
  const getCompletionStatus = (tournamentData) => {
    const teamCount = getTeamCount(tournamentData);
    return { 
      completed: teamCount, 
      total: 64, 
      text: teamCount > 0 ? `${teamCount}/64` : 'Not Set'
    };
  };
  
  // Custom stat cards for March Madness
  const MarchMadnessStatCards = ({ 
    leagueData, 
    gameData, 
    userCount, 
    lockStatus,
    completionStatus,
    gameStatus 
  }) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <FaUsers className="text-blue-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Players</p>
              <p className="text-2xl font-bold">{userCount}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <FaClipboardCheck className="text-green-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Teams Set</p>
              <p className="text-2xl font-bold">{completionStatus.completed}/64</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-full mr-4">
              <FaLock className="text-yellow-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Bracket Status</p>
              <p className="text-2xl font-bold">{lockStatus.RoundOf64?.locked ? 'Locked' : 'Open'}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <FaBasketballBall className="text-purple-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tournament Status</p>
              <p className="text-2xl font-bold">{gameStatus}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Custom visibility settings for March Madness
  const MarchMadnessSettings = ({ 
    fogOfWarEnabled, 
    onToggleFogOfWar, 
    isArchived 
  }) => {
    return (
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Bracket Visibility Settings</h2>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Fog of War</h3>
              <p className="text-sm text-gray-600 max-w-3xl">
                When enabled, players cannot see other participants' brackets until the tournament is completed. 
                This creates more suspense and prevents players from copying each other's strategies or tracking 
                their relative standings too closely.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Current status: <span className="font-medium">{fogOfWarEnabled ? 'Enabled' : 'Disabled'}</span>
              </p>
            </div>
            <button
              onClick={onToggleFogOfWar}
              disabled={isArchived}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                fogOfWarEnabled 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              } ${isArchived ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {fogOfWarEnabled ? 'Show All Brackets' : 'Hide Other Brackets'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Custom actions for March Madness
  const MarchMadnessActions = ({
    leagueId,
    onExportData,
    onGoToSettings,
    onGoToTeams,
    onGoToScoringSettings,
    onEndLeague,
    isEndingLeague,
    isArchived
  }) => {
    return (
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Admin Actions</h2>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Tournament Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure teams, brackets, and other tournament settings.
              </p>
              <button
                onClick={onGoToSettings}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition w-full justify-center"
              >
                <FaCog className="mr-2" /> Settings
              </button>
            </div>

            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Manage Participants</h3>
              <p className="text-sm text-gray-600 mb-4">
                View, manage and remove participants from the league.
              </p>
              <button
                onClick={onGoToTeams}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition w-full justify-center"
              >
                <FaUsers className="mr-2" /> Participants
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Scoring Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure point values and bonus scoring rules for the tournament.
              </p>
              <button
                onClick={onGoToScoringSettings}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition w-full justify-center"
              >
                <FaCalculator className="mr-2" /> Scoring
              </button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">Export Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download the current tournament data as a JSON file for backup.
              </p>
              <button
                onClick={onExportData}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full justify-center"
              >
                <FaDownload className="mr-2" /> Export
              </button>
            </div>

            {/* End League button */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-bold mb-2">End League</h3>
              <p className="text-sm text-gray-600 mb-4">
                Determine winners, record results, and archive the league.
              </p>
              <button
                onClick={onEndLeague}
                disabled={isEndingLeague || isArchived}
                className={`flex items-center px-4 py-2 ${
                  isEndingLeague || isArchived
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white rounded transition w-full justify-center`}
              >
                {isEndingLeague ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FaTrophy className="mr-2" /> 
                    {isArchived ? 'Archived' : 'End League'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Return the base dashboard with March Madness customizations
  return (
    <BaseAdminDashboard
      gameType="marchMadness"
      rounds={marchmadnessRounds}
      getGameStatus={getTournamentStatus}
      getCompletionStatus={getCompletionStatus}
      settingsPath="settings"
      teamsPath="teams"
      scoringPath="scoring"
      CustomStatCards={MarchMadnessStatCards}
      CustomSettings={MarchMadnessSettings}
      CustomActions={MarchMadnessActions}
    />
  );
};

export default AdminDashboard;