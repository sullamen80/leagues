// src/gameTypes/nflPlayoffs/components/LeagueSetup.js
import React, { useState } from 'react';
import { FaFootballBall, FaInfoCircle } from 'react-icons/fa';
import BaseLeagueSetup from '../../common/components/BaseLeagueSetup';

/**
 * Component for setting up a new NFL Playoffs league
 * Extends BaseLeagueSetup with NFL-specific functionality
 */
const LeagueSetup = ({ onCreateLeague, currentUser }) => {
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  
  const NFLPlayoffsAdvancedOptions = () => {
    // Handle season year change
    const handleYearChange = (e) => {
      const year = parseInt(e.target.value);
      if (!isNaN(year) && year >= 1980 && year <= 2050) {
        setSeasonYear(year);
      }
    };
    
    return (
      <>
        <h3 className="text-md font-semibold mb-4">NFL Playoffs Setup</h3>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Season Year
          </label>
          <input
            type="number"
            value={seasonYear}
            onChange={handleYearChange}
            min="1980"
            max="2050"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          <p className="text-gray-600 text-xs mt-1">Set the NFL season year (e.g., 2024 for the 2024 playoffs)</p>
        </div>
        
        <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded text-sm">
          <div className="flex items-start">
            <FaInfoCircle className="text-blue-500 mt-1 mr-2" />
            <div>
              <p className="font-bold">NFL Playoffs Setup Information:</p>
              <p className="mt-1">
                After creating the league, you'll select the 14 playoff teams (7 per conference) and assign their seeds in the admin dashboard.
              </p>
              <p className="mt-1">
                All 32 NFL teams are already loaded in the system. You just need to pick the postseason qualifiers.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  };
  
  // Game-specific validation function
  const validateGameSpecificFields = () => {
    // No specific validation needed as we just have the year field
    return {};
  };
  
  // Function to get game-specific data for submission
  const getGameSpecificData = async () => {
    return {
      seasonYear: seasonYear
    };
  };
  
  return (
    <BaseLeagueSetup
      onCreateLeague={onCreateLeague}
      currentUser={currentUser}
      GameIcon={FaFootballBall}
      gameTypeId="nflPlayoffs"
      gameTypeName="NFL Playoffs League"
      AdvancedOptions={NFLPlayoffsAdvancedOptions}
      validateGameSpecificFields={validateGameSpecificFields}
      getGameSpecificData={getGameSpecificData}
    />
  );
};

export default LeagueSetup;
