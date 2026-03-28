// src/pages/stats/gametypes/nflPlayoffs/NFLPlayoffsUserView.js
import React from 'react';
import { classNames, formatNumber } from '../../../../../utils/formatters';

const ROUND_ORDER = [
  'Wild Card Round',
  'Divisional Round',
  'Conference Championships',
  'Super Bowl'
];

/**
 * NFL Playoffs specific implementation for user expanded view
 */
const NFLPlayoffsUserView = {
  /**
   * Render expanded content for an NFL Playoffs league in user view
   * @param {Object} league - League data from user stats
   * @returns {JSX.Element} React component for expanded content
   */
  renderUserExpandedContent: (league) => {
    const roundAccuracy = league.fullData.roundAccuracy || {};
    const roundBreakdown = league.fullData.roundBreakdown || {};

    return (
      <div className="p-4 border rounded-md">
        <h4 className="text-lg font-medium mb-3">NFL Playoffs Performance</h4>

        {/* General Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Correct Picks</h5>
            <p className="text-lg font-semibold">
              {league.correctPicks} / {league.totalPossible}
            </p>
          </div>

          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Accuracy</h5>
            <p className="text-lg font-semibold">
              {(league.accuracy * 100).toFixed(1)}%
            </p>
          </div>

          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Score</h5>
            <p className="text-lg font-semibold">{formatNumber(league.score)}</p>
          </div>
        </div>

        {/* Champion and Super Bowl MVP Picks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500 mb-2">Champion Pick</h5>
            <div className="flex items-center">
              <div
                className={classNames(
                  'px-3 py-1.5 rounded-md text-white font-medium inline-flex items-center text-sm',
                  league.fullData.championCorrect ? 'bg-green-600' : 'bg-gray-600'
                )}
              >
                {league.fullData.championPick || 'None Selected'}
                {league.fullData.championCorrect && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 ml-1.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500 mb-2">Super Bowl MVP Pick</h5>
            <div className="flex items-center">
              <div
                className={classNames(
                  'px-3 py-1.5 rounded-md text-white font-medium inline-flex items-center text-sm',
                  league.fullData.finalsMVPCorrect ? 'bg-green-600' : 'bg-gray-600'
                )}
              >
                {league.fullData.finalsMVPPick && league.fullData.finalsMVPPick !== 'None Selected'
                  ? league.fullData.finalsMVPPick
                  : 'None'}
                {league.fullData.finalsMVPCorrect && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 ml-1.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Round Performance Breakdown */}
        {Object.keys(roundAccuracy).length > 0 && (
          <div className="mt-6">
            <h5 className="font-medium text-gray-700 mb-2">Round-by-Round Performance</h5>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Round
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Correct
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Accuracy
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ROUND_ORDER.filter((round) => roundAccuracy[round]).map((round) => {
                    const data = roundAccuracy[round];
                    return (
                      <tr key={round}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          {round}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {data.correctPicks}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {data.possiblePicks}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <span className="mr-2">{(data.percentage * 100).toFixed(1)}%</span>
                            <div className="w-24 bg-gray-200 rounded-full h-2.5">
                              <div
                                className={classNames(
                                  'h-2.5 rounded-full',
                                  data.percentage >= 0.7
                                    ? 'bg-green-600'
                                    : data.percentage >= 0.5
                                      ? 'bg-blue-600'
                                      : data.percentage >= 0.3
                                        ? 'bg-yellow-500'
                                        : 'bg-red-600'
                                )}
                                style={{ width: `${data.percentage * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Round Breakdown from League Data */}
        {roundBreakdown && Object.keys(roundBreakdown).length > 0 && (
          <div className="mt-6">
            <h5 className="font-medium text-gray-700 mb-2">Detailed Points Breakdown</h5>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Round
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Base
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Spread
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      O/U
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Score Bonus
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Perfect
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ROUND_ORDER.map((round) => {
                    const data = roundBreakdown[round] || {};
                    const hasData =
                      data.basePoints ||
                      data.upsetPoints ||
                      data.spreadPoints ||
                      data.overUnderPoints ||
                      data.scoreBonusPoints ||
                      data.perfectScorePoints ||
                      data.totalPoints;
                    if (!hasData) return null;

                    return (
                      <tr key={round}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          {round}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {data.basePoints || 0}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {data.spreadPoints || 0}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {data.overUnderPoints || 0}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {data.scoreBonusPoints || 0}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {data.perfectScorePoints || 0}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          {data.totalPoints || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Performance Summary */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h5 className="text-sm font-medium text-blue-800 mb-2">Playoff Performance</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded shadow">
              <div className="text-xs text-gray-500">Rank</div>
              <div
                className={classNames(
                  'text-lg font-bold',
                  league.rankValue === 1
                    ? 'text-green-600'
                    : league.rankValue === 2
                      ? 'text-blue-600'
                      : league.rankValue === 3
                        ? 'text-yellow-600'
                        : 'text-gray-900'
                )}
              >
                {league.rank}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow">
              <div className="text-xs text-gray-500">Pick Accuracy</div>
              <div className="text-lg font-bold text-blue-600">
                {(league.accuracy * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow">
              <div className="text-xs text-gray-500">Champion Pick</div>
              <div className="text-lg font-bold">
                {league.fullData.championCorrect ? (
                  <span className="text-green-600">Correct</span>
                ) : (
                  <span className="text-red-600">Incorrect</span>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow">
              <div className="text-xs text-gray-500">Super Bowl MVP</div>
              <div className="text-lg font-bold">
                {league.fullData.finalsMVPCorrect ? (
                  <span className="text-green-600">Correct</span>
                ) : (
                  <span className="text-red-600">Incorrect</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },

  /**
   * Extra columns for NFL Playoffs user view
   */
  userExtraColumns: [
    {
      key: 'specialPicks',
      label: 'Champion/MVP',
      render: (league) => (
        <div className="space-y-1">
          <div
            className={classNames(
              'whitespace-nowrap text-xs',
              league.fullData.championCorrect ? 'text-green-600 font-medium' : 'text-gray-600'
            )}
          >
            {league.fullData.championPick || 'None'}
            {league.fullData.championCorrect && ' ✓'}
          </div>
          <div
            className={classNames(
              'whitespace-nowrap text-xs',
              league.fullData.finalsMVPCorrect ? 'text-green-600 font-medium' : 'text-gray-600'
            )}
          >
            MVP:{' '}
            {league.fullData.finalsMVPPick && league.fullData.finalsMVPPick !== 'None Selected'
              ? league.fullData.finalsMVPPick
              : 'None'}
            {league.fullData.finalsMVPCorrect && ' ✓'}
          </div>
        </div>
      )
    }
  ],

  /**
   * Format league data for user view
   * @param {Object} standardLeague - Standard league data
   * @param {Object} originalLeague - Original league data
   * @returns {Object} Formatted league data
   */
  formatLeagueData: (standardLeague, originalLeague) => {
    return {
      ...standardLeague,
      formattedChampionPick: (
        <span
          className={classNames(
            originalLeague.championCorrect ? 'text-green-600 font-medium' : 'text-gray-600'
          )}
        >
          {originalLeague.championPick || 'None'}
          {originalLeague.championCorrect && ' ✓'}
        </span>
      ),
      formattedFinalsMVPPick: (
        <span
          className={classNames(
            originalLeague.finalsMVPCorrect ? 'text-green-600 font-medium' : 'text-gray-600'
          )}
        >
          {originalLeague.finalsMVPPick && originalLeague.finalsMVPPick !== 'None Selected'
            ? originalLeague.finalsMVPPick
            : 'None'}
          {originalLeague.finalsMVPCorrect && ' ✓'}
        </span>
      )
    };
  }
};

export default NFLPlayoffsUserView;
