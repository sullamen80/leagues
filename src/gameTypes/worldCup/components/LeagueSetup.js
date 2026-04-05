import React, { useState } from 'react';
import { FaFutbol } from 'react-icons/fa';
import BaseLeagueSetup from '../../common/components/BaseLeagueSetup';

const LeagueSetup = ({ onCreateLeague, currentUser }) => {
  const [edition, setEdition] = useState(2026);

  const AdvancedOptions = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="world-cup-edition">
          Tournament Edition
        </label>
        <input
          id="world-cup-edition"
          type="number"
          min="1930"
          step="4"
          value={edition}
          onChange={(event) => setEdition(Number(event.target.value) || 2026)}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          The mode preloads the 2026 groups by default. You can still edit the teams and standings in admin later.
        </p>
      </div>
    </div>
  );

  return (
    <BaseLeagueSetup
      onCreateLeague={onCreateLeague}
      currentUser={currentUser}
      GameIcon={FaFutbol}
      gameTypeId="worldCup"
      gameTypeName="World Cup"
      AdvancedOptions={AdvancedOptions}
      getGameSpecificData={() => ({
        worldCupSetup: {
          edition
        }
      })}
    />
  );
};

export default LeagueSetup;
