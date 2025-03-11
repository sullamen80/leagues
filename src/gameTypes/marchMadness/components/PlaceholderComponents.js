import React from 'react';

/**
 * BracketEdit Component
 * For editing a bracket
 */
export const BracketEdit = ({ leagueId, userId }) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-white">
      <h2 className="text-xl font-semibold mb-4">Edit Bracket</h2>
      <p className="text-gray-400">
        This component will allow editing of a bracket for user ID: {userId} in league: {leagueId}
      </p>
    </div>
  );
};

/**
 * LeagueSettings Component
 * For configuring league settings
 */
export const LeagueSettings = ({ leagueId }) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-white">
      <h2 className="text-xl font-semibold mb-4">League Settings</h2>
      <p className="text-gray-400">
        This component will allow configuring settings for league ID: {leagueId}
      </p>
    </div>
  );
};

/**
 * Leaderboard Component
 * For displaying the league leaderboard
 */
export const Leaderboard = ({ leagueId }) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-white">
      <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
      <p className="text-gray-400 mb-4">
        Standings for this league.
      </p>
      
      <div className="overflow-hidden border border-gray-700 rounded-lg">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                1
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                User 1
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                120
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                2023-03-19
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                2
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                User 2
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                105
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                2023-03-19
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Rules Component
 * For displaying tournament rules
 */
export const Rules = () => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-white">
      <h2 className="text-xl font-semibold mb-4">Tournament Rules</h2>
      
      <div className="space-y-4 text-gray-300">
        <h3 className="text-lg font-medium">How to Play</h3>
        <p>
          Select the team you think will win in each matchup throughout the tournament. Points are awarded for each correct pick, with later rounds being worth more points.
        </p>
        
        <h3 className="text-lg font-medium">Scoring System</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Round of 64: 1 point per correct pick</li>
          <li>Round of 32: 2 points per correct pick</li>
          <li>Sweet 16: 4 points per correct pick</li>
          <li>Elite 8: 8 points per correct pick</li>
          <li>Final Four: 16 points per correct pick</li>
          <li>Championship: 32 points for the correct champion</li>
        </ul>
        
        <h3 className="text-lg font-medium">Tiebreakers</h3>
        <p>
          In the event of a tie, the tiebreaker will be determined by the accuracy of championship game score prediction.
        </p>
        
        <h3 className="text-lg font-medium">Deadline</h3>
        <p>
          All brackets must be completed before the tournament begins. Once the first game starts, brackets will be locked.
        </p>
      </div>
    </div>
  );
};

export default {
  BracketEdit,
  LeagueSettings,
  Leaderboard,
  Rules
};