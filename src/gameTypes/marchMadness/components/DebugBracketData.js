import React, { useState } from 'react';
import { FaBug } from 'react-icons/fa';

/**
 * Helper component to debug bracket data structure
 */
const DebugBracketData = ({ player, allPlayers, referenceData }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!player) return null;
  
  // Get a sample of other players
  const otherPlayers = allPlayers.filter(p => p.id !== player.id).slice(0, 1);
  
  // Check for key rounds
  const rounds = ['Championship', 'FinalFour', 'Elite8', 'RoundOf32', 'RoundOf64'];
  const playerRounds = {};
  const refDataRounds = {};
  
  rounds.forEach(round => {
    playerRounds[round] = {
      exists: !!player[round],
      type: player[round] ? typeof player[round] : 'undefined',
      isArray: Array.isArray(player[round]),
      sample: player[round] ? 
        (Array.isArray(player[round]) ? 
          (player[round].length > 0 ? player[round][0] : 'empty array') : 
          player[round]) : 
        'undefined'
    };
    
    refDataRounds[round] = {
      exists: !!referenceData[round],
      type: referenceData[round] ? typeof referenceData[round] : 'undefined',
      isArray: Array.isArray(referenceData[round]),
      sample: referenceData[round] ? 
        (Array.isArray(referenceData[round]) ? 
          (referenceData[round].length > 0 ? referenceData[round][0] : 'empty array') : 
          referenceData[round]) : 
        'undefined'
    };
  });
  
  return (
    <div className="relative mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-full"
        title="Debug bracket data"
      >
        <FaBug size={16} />
      </button>
      
      {isOpen && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-300 dark:border-red-700 p-3 rounded-lg text-xs overflow-auto max-h-80">
          <h3 className="font-bold text-red-700 dark:text-red-300 mb-2">Bracket Data Debugger</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold">Current Player Structure</h4>
              <div className="bg-white dark:bg-gray-800 p-2 rounded">
                <pre className="text-xs overflow-auto max-h-32">
                  {JSON.stringify(playerRounds, null, 2)}
                </pre>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold">Reference Data Structure</h4>
              <div className="bg-white dark:bg-gray-800 p-2 rounded">
                <pre className="text-xs overflow-auto max-h-32">
                  {JSON.stringify(refDataRounds, null, 2)}
                </pre>
              </div>
            </div>
          </div>
          
          {otherPlayers.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold">Sample Other Player Structure</h4>
              <div className="bg-white dark:bg-gray-800 p-2 rounded">
                <pre className="text-xs overflow-auto max-h-32">
                  {JSON.stringify(
                    rounds.reduce((acc, round) => {
                      acc[round] = {
                        exists: !!otherPlayers[0][round],
                        type: otherPlayers[0][round] ? typeof otherPlayers[0][round] : 'undefined',
                        isArray: Array.isArray(otherPlayers[0][round])
                      };
                      return acc;
                    }, {}),
                    null, 2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugBracketData;