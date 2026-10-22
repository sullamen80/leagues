import React, { useState } from 'react';
import { FaTableTennis } from 'react-icons/fa';
import BaseLeagueSetup from '../../common/components/BaseLeagueSetup';

const LeagueSetup = ({ onCreateLeague, currentUser }) => {
  const [edition, setEdition] = useState(new Date().getFullYear());
  const [eventLabel, setEventLabel] = useState('Singles Championship');
  const [maximumSets, setMaximumSets] = useState(3);
  const [setPredictionEnabled, setSetPredictionEnabled] = useState(false);

  const AdvancedOptions = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-gray-700">Edition</span>
        <input type="number" value={edition} onChange={(event) => setEdition(Number(event.target.value))} className="w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-gray-700">Event label</span>
        <input value={eventLabel} onChange={(event) => setEventLabel(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-gray-700">Match format</span>
        <select value={maximumSets} onChange={(event) => setMaximumSets(Number(event.target.value))} className="w-full rounded border border-gray-300 px-3 py-2">
          <option value={3}>Best of 3 sets</option>
          <option value={5}>Best of 5 sets</option>
        </select>
      </label>
      <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-gray-700">
        <input type="checkbox" checked={setPredictionEnabled} onChange={(event) => setSetPredictionEnabled(event.target.checked)} />
        Enable optional set predictions as a standings tie-breaker
      </label>
      <p className="sm:col-span-2 text-xs text-gray-500">
        The draw is event-agnostic. Entrants are imported after setup, the full bracket locks at once, and brackets reveal after lock.
      </p>
    </div>
  );

  return (
    <BaseLeagueSetup
      onCreateLeague={onCreateLeague}
      currentUser={currentUser}
      GameIcon={FaTableTennis}
      gameTypeId="wimbledon"
      gameTypeName="Wimbledon Pool"
      AdvancedOptions={AdvancedOptions}
      validateGameSpecificFields={() => ({
        ...(!eventLabel.trim() ? { eventLabel: 'Event label is required' } : {})
      })}
      getGameSpecificData={() => ({
        wimbledonSetup: { edition, eventLabel: eventLabel.trim(), maximumSets, setPredictionEnabled }
      })}
    />
  );
};

export default LeagueSetup;
