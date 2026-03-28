// src/gameTypes/winsPool/components/LeagueSetup.js
import React, { useMemo, useState } from 'react';
import { FaMedal, FaList, FaPlus, FaUsers } from 'react-icons/fa';
import BaseLeagueSetup from '../../common/components/BaseLeagueSetup';
import { getPresetTeamPoolOptions, hydrateTeamPool, normalizeTeams } from '../constants/teamPools';
import { DEFAULT_SCORING_SETTINGS, DEFAULT_ROSTER_SETTINGS, DEFAULT_AUCTION_BUDGET, WINS_POOL_GAME_TYPE_ID } from '../constants/winsPoolConstants';

const parseCustomTeams = (text = '') => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [cityAndName, conference = '', division = ''] = line.split('|').map(part => part.trim());
      if (!cityAndName) return null;
      const parts = cityAndName.split(' ');
      const city = parts.slice(0, -1).join(' ') || cityAndName;
      const name = parts.slice(-1).join(' ') || cityAndName;
      return {
        id: `custom-${index}-${name.toLowerCase()}`,
        city,
        name,
        shortName: name,
        conference,
        division
      };
    })
    .filter(Boolean);
};

const LeagueSetup = ({ onCreateLeague, currentUser }) => {
  const presetOptions = useMemo(() => getPresetTeamPoolOptions(), []);
  
  const [poolSelection, setPoolSelection] = useState(presetOptions[0]?.value || 'preset-nba-2024');
  const [customPoolName, setCustomPoolName] = useState('Custom Team Pool');
  const [customTeamsText, setCustomTeamsText] = useState('');
  const [rosterSize, setRosterSize] = useState(DEFAULT_ROSTER_SETTINGS.rosterSize);
  const [pointsPerWin, setPointsPerWin] = useState(DEFAULT_SCORING_SETTINGS.pointsPerWin);
  const [overtimeBonus, setOvertimeBonus] = useState(DEFAULT_SCORING_SETTINGS.overtimeWinBonus);
  const [playoffMultiplier, setPlayoffMultiplier] = useState(DEFAULT_SCORING_SETTINGS.playoffWinMultiplier);
  const [allowDuplicateTeams, setAllowDuplicateTeams] = useState(DEFAULT_SCORING_SETTINGS.allowDuplicateTeams);
  const [assignmentMode, setAssignmentMode] = useState(DEFAULT_ROSTER_SETTINGS.assignmentMode);
  const [useSnakeDraft, setUseSnakeDraft] = useState(DEFAULT_ROSTER_SETTINGS.useSnakeDraft);
  const [auctionBudget, setAuctionBudget] = useState(DEFAULT_AUCTION_BUDGET);
  const [errors, setErrors] = useState({});
  
  const isPresetSelection = poolSelection.startsWith('preset-');
  const selectedPresetKey = poolSelection.replace(/^preset-/, '');
  
  const validateGameSpecificFields = () => {
    const newErrors = {};
    
    if (!isPresetSelection) {
      const customTeams = parseCustomTeams(customTeamsText);
      if (customTeams.length === 0) {
        newErrors.customTeamsText = 'Enter at least one team for the custom pool.';
      }
    }
    
    if (rosterSize < 1) {
      newErrors.rosterSize = 'Roster size must be at least 1.';
    }
    
    if (pointsPerWin <= 0) {
      newErrors.pointsPerWin = 'Points per win must be greater than 0.';
    }
    
    if (playoffMultiplier < 1) {
      newErrors.playoffMultiplier = 'Playoff win multiplier must be at least 1.';
    }

    if (assignmentMode === 'auction' && auctionBudget <= 0) {
      newErrors.auctionBudget = 'Auction budget must be greater than 0.';
    }
    
    setErrors(newErrors);
    return newErrors;
  };
  
  const getGameSpecificData = async () => {
    const poolData = isPresetSelection
      ? {
          type: 'preset',
          presetId: selectedPresetKey
        }
      : {
          type: 'custom',
          customPool: hydrateTeamPool({
            id: `custom-${Date.now()}`,
            name: customPoolName || 'Custom Team Pool',
            teams: parseCustomTeams(customTeamsText),
            createdBy: currentUser?.uid || null,
            scope: 'custom'
          })
        };
    
    return {
      winsPoolSetup: {
        poolSelection: poolData,
        rosterSettings: {
          rosterSize,
          assignmentMode,
          useSnakeDraft,
          allowDuplicateTeams,
          auctionBudget
        },
        scoringSettings: {
          pointsPerWin,
          overtimeWinBonus: overtimeBonus,
          playoffWinMultiplier: playoffMultiplier,
          allowDuplicateTeams
        }
      }
    };
  };
  
  const AdvancedOptions = () => (
    <div className="space-y-6">
      <section className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center mb-4">
          <FaList className="text-indigo-500 mr-2" />
          <h3 className="text-lg font-semibold">Team Pool</h3>
        </div>
        
        <label className="block text-sm font-medium text-gray-700 mb-2">Select preset or build your own</label>
        <select
          value={poolSelection}
          onChange={(event) => setPoolSelection(event.target.value)}
          className="w-full border rounded-md px-3 py-2 mb-4"
        >
          {presetOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
          <option value="custom">Custom team list</option>
        </select>
        
        {!isPresetSelection && (
          <div className="bg-white border rounded-md p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom pool name</label>
            <input
              type="text"
              value={customPoolName}
              onChange={(event) => setCustomPoolName(event.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-4"
              placeholder="e.g., European Clubs Invitational"
            />
            
            <label className="block text-sm font-medium text-gray-700 mb-2">Teams (one per line)</label>
            <textarea
              value={customTeamsText}
              onChange={(event) => setCustomTeamsText(event.target.value)}
              className={`w-full border rounded-md px-3 py-2 h-40 ${errors.customTeamsText ? 'border-red-400' : ''}`}
              placeholder="City Name | Conference | Division
Chicago Bulls | East | Central"
            />
            {errors.customTeamsText && (
              <p className="text-sm text-red-600 mt-1">{errors.customTeamsText}</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Format: <code>City Team Name | Conference | Division</code>. Conference/Division are optional.
            </p>
          </div>
        )}
      </section>
      
      <section className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center mb-4">
          <FaUsers className="text-indigo-500 mr-2" />
          <h3 className="text-lg font-semibold">Roster &amp; Draft</h3>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Roster size</label>
            <input
              type="number"
              min="1"
              max="10"
              value={rosterSize}
              onChange={(event) => setRosterSize(Number(event.target.value))}
              className={`w-full border rounded-md px-3 py-2 ${errors.rosterSize ? 'border-red-400' : ''}`}
            />
            {errors.rosterSize && (
              <p className="text-sm text-red-600 mt-1">{errors.rosterSize}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assignment mode</label>
            <select
              value={assignmentMode}
              onChange={(event) => {
                const mode = event.target.value;
                setAssignmentMode(mode);
                if (mode === 'draft' || mode === 'double_snake') {
                  setUseSnakeDraft(true);
                } else if (mode === 'auction') {
                  setUseSnakeDraft(false);
                }
              }}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="draft">Snake draft</option>
              <option value="double_snake">Double-headed snake</option>
              <option value="auction">Auction draft</option>
              <option value="auto_assign">Auto assign</option>
              <option value="manual">Manual assignment</option>
            </select>
          </div>
        </div>
        
        {assignmentMode === 'draft' && (
          <div className="mt-4">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={useSnakeDraft}
                onChange={(event) => setUseSnakeDraft(event.target.checked)}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <span>Use snake draft order</span>
            </label>
          </div>
        )}

        {assignmentMode === 'double_snake' && (
          <div className="mt-4 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md p-3">
            Double-headed snake drafts automatically wrap back twice, so every round has two reversals.
          </div>
        )}

        {assignmentMode === 'auction' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Auction budget per manager</label>
            <input
              type="number"
              min="1"
              value={auctionBudget}
              onChange={(event) => setAuctionBudget(Number(event.target.value))}
              className={`w-full border rounded-md px-3 py-2 ${errors.auctionBudget ? 'border-red-400' : ''}`}
            />
            {errors.auctionBudget && (
              <p className="text-sm text-red-600 mt-1">{errors.auctionBudget}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Each manager receives this budget to bid on teams during the auction.
            </p>
          </div>
        )}
        
        <div className="mt-4">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allowDuplicateTeams}
              onChange={(event) => setAllowDuplicateTeams(event.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
            <span>Allow duplicate teams across rosters</span>
          </label>
        </div>
      </section>
      
      <section className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center mb-4">
          <FaMedal className="text-indigo-500 mr-2" />
          <h3 className="text-lg font-semibold">Scoring</h3>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Points per win</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={pointsPerWin}
              onChange={(event) => setPointsPerWin(Number(event.target.value))}
              className={`w-full border rounded-md px-3 py-2 ${errors.pointsPerWin ? 'border-red-400' : ''}`}
            />
            {errors.pointsPerWin && (
              <p className="text-sm text-red-600 mt-1">{errors.pointsPerWin}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overtime win bonus</label>
            <input
              type="number"
              step="0.5"
              value={overtimeBonus}
              onChange={(event) => setOvertimeBonus(Number(event.target.value))}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Playoff win multiplier</label>
            <input
              type="number"
              step="0.5"
              min="1"
              value={playoffMultiplier}
              onChange={(event) => setPlayoffMultiplier(Number(event.target.value))}
              className={`w-full border rounded-md px-3 py-2 ${errors.playoffMultiplier ? 'border-red-400' : ''}`}
            />
            {errors.playoffMultiplier && (
              <p className="text-sm text-red-600 mt-1">{errors.playoffMultiplier}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
  
  return (
    <BaseLeagueSetup
      onCreateLeague={onCreateLeague}
      currentUser={currentUser}
      GameIcon={FaPlus}
      gameTypeId={WINS_POOL_GAME_TYPE_ID}
      gameTypeName="Wins Pool League"
      AdvancedOptions={AdvancedOptions}
      validateGameSpecificFields={validateGameSpecificFields}
      getGameSpecificData={getGameSpecificData}
    />
  );
};

export default LeagueSetup;
