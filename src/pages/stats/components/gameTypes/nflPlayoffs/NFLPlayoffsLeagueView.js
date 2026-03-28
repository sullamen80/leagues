// src/pages/stats/gametypes/nflPlayoffs/NFLPlayoffsLeagueView.js
import React from 'react';
import { classNames, formatNumber } from '../../../../../utils/formatters';

const ROUND_ORDER = [
  'Wild Card Round',
  'Divisional Round',
  'Conference Championships',
  'Super Bowl'
];

const SUPER_BOWL_MVP_KEY = 'Super Bowl MVP';
const SUPER_WINNER_KEY = 'Super Winner Pick';
const PROP_BETS_KEY = 'Prop Bets';

const sumField = (roundBreakdown, field) =>
  Object.values(roundBreakdown).reduce((sum, round) => sum + (round?.[field] || 0), 0);

/**
 * NFL Playoffs specific implementation for league expanded view
 */
const NFLPlayoffsLeagueView = {
  /**
   * Render expanded content for a player in the league view
   * @param {Object} player - Player data
   * @param {Object} leagueData - Full league data
   * @returns {JSX.Element} React component for expanded content
   */
  renderLeagueExpandedContent: (player, leagueData) => {
    const { nflPlayoffsStats = {} } = leagueData;
    const roundBreakdown = player.fullData?.roundBreakdown || player.roundBreakdown || {};
    const superWinner = roundBreakdown[SUPER_WINNER_KEY] || null;
    const propBets = roundBreakdown[PROP_BETS_KEY] || null;

    const totals = {
      basePoints: sumField(roundBreakdown, 'basePoints'),
      spreadPoints: sumField(roundBreakdown, 'spreadPoints'),
      overUnderPoints: sumField(roundBreakdown, 'overUnderPoints'),
      scoreBonusPoints: sumField(roundBreakdown, 'scoreBonusPoints'),
      perfectScorePoints: sumField(roundBreakdown, 'perfectScorePoints'),
      superWinnerPoints: superWinner?.totalPoints || 0,
      propBetPoints: propBets?.totalPoints || 0
    };

    const mvpPick =
      player.fullData?.finalsMVPPick || player.finalsMVPPick || 'None';
    const mvpCorrect =
      player.fullData?.finalsMVPCorrect || player.finalsMVPCorrect || false;

    return (
      <div className="p-4 border rounded-md">
        <h4 className="text-lg font-medium mb-3">NFL Playoffs Performance</h4>

        {/* General Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Correct Picks</h5>
            <p className="text-lg font-semibold">
              {player.correctPicks} / {player.totalPossible}
            </p>
          </div>

          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Accuracy</h5>
            <p className="text-lg font-semibold">
              {(player.percentage * 100).toFixed(1)}%
            </p>
          </div>

          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Total Score</h5>
            <p className="text-lg font-semibold">
              {formatNumber(player.score)}
              <span className="text-sm font-normal text-gray-500 ml-1">
                (Base: {totals.basePoints || 0}, Spread: {totals.spreadPoints || 0}, O/U:{' '}
                {totals.overUnderPoints || 0})
              </span>
            </p>
          </div>
        </div>

        {/* Special Picks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Champion Pick</h5>
            <p
              className={classNames(
                'text-lg font-semibold',
                player.championCorrect ? 'text-green-600' : 'text-gray-700'
              )}
            >
              {player.championPick || 'None'}
              {player.championCorrect && ' ✓'}
            </p>
            {!player.championCorrect && nflPlayoffsStats.champion && (
              <p className="text-sm text-gray-500">
                Actual Champion: <span className="font-medium">{nflPlayoffsStats.champion}</span>
              </p>
            )}
          </div>

          <div className="bg-white p-3 rounded shadow-sm">
            <h5 className="text-sm font-medium text-gray-500">Super Bowl MVP Pick</h5>
            <p
              className={classNames(
                'text-lg font-semibold',
                mvpCorrect ? 'text-green-600' : 'text-gray-700'
              )}
            >
              {mvpPick}
              {mvpCorrect && ' ✓'}
            </p>
            {!mvpCorrect && nflPlayoffsStats.finalsMVP && (
              <p className="text-sm text-gray-500">
                Actual MVP: <span className="font-medium">{nflPlayoffsStats.finalsMVP}</span>
              </p>
            )}
          </div>
        </div>

        {(superWinner || propBets) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {superWinner && (
              <div className="bg-white p-3 rounded shadow-sm">
                <h5 className="text-sm font-medium text-gray-500">Super Winner Pick</h5>
                <p
                  className={classNames(
                    'text-lg font-semibold',
                    superWinner.correctPrediction ? 'text-green-600' : 'text-gray-700'
                  )}
                >
                  {superWinner.pick || 'None'}
                  {superWinner.correctPrediction && ' ✓'}
                </p>
              </div>
            )}

            {propBets && (
              <div className="bg-white p-3 rounded shadow-sm">
                <h5 className="text-sm font-medium text-gray-500">Prop Bets</h5>
                <p className="text-lg font-semibold">{formatNumber(propBets.totalPoints || 0)}</p>
                <p className="text-sm text-gray-500">
                  {Array.isArray(propBets.wagers) ? propBets.wagers.length : 0} wagers
                </p>
              </div>
            )}
          </div>
        )}

        {/* Round-by-Round Breakdown */}
        <h5 className="font-medium text-gray-700 mb-2 mt-4">Round-by-Round Performance</h5>
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
                  Correct Picks
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
                  data.correctPicks ||
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
                      {data.correctPicks || 0}
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
    );
  },

  /**
   * Render additional content for NFL Playoffs league view
   * @param {Object} leagueData - League data
   * @returns {JSX.Element} React component for additional content
   */
  renderAdditionalContent: (leagueData) => {
    const { nflPlayoffsStats = {}, roundStats = {} } = leagueData;

    if (!nflPlayoffsStats) return null;

    return (
      <div className="mb-8">
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-5 sm:px-6 bg-blue-50">
            <h3 className="text-lg leading-6 font-medium text-blue-900">
              NFL Playoffs Overview
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-blue-700">
              NFL Playoffs {leagueData.seasonId} Results
            </p>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-800 mb-4">Playoff Results</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {nflPlayoffsStats.champion && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-sm font-medium text-gray-500">
                          Super Bowl Champion
                        </span>
                        <span className="text-xl font-bold text-gray-900">
                          {nflPlayoffsStats.champion}
                        </span>
                      </div>
                      <div className="h-16 w-16 flex items-center justify-center bg-blue-100 rounded-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-blue-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 4v4m0 8v4m-4-8h8M4 12h4m8 0h4"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {nflPlayoffsStats.finalsMVP && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-sm font-medium text-gray-500">
                          Super Bowl MVP
                        </span>
                        <span className="text-xl font-bold text-gray-900">
                          {nflPlayoffsStats.finalsMVP}
                        </span>
                      </div>
                      <div className="h-16 w-16 flex items-center justify-center bg-green-100 rounded-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-green-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {roundStats && Object.keys(roundStats).length > 0 && (
              <div className="mt-6">
                <h4 className="text-base font-semibold text-gray-800 mb-4">Round Statistics</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
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
                          Correct Picks
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Total Picks
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
                      {Object.entries(roundStats)
                        .filter(([_, data]) => data)
                        .map(([round, data]) => (
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
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },

  /**
   * Extra columns for NFL Playoffs league view
   */
  leagueExtraColumns: [
    {
      key: 'championPick',
      label: 'Champion Pick',
      render: (player) => (
        <span
          className={classNames(
            player.championCorrect ? 'text-green-600 font-medium' : 'text-gray-600'
          )}
        >
          {player.championPick || 'None'}
          {player.championCorrect && ' ✓'}
        </span>
      )
    },
    {
      key: 'finalsMVPPick',
      label: 'Super Bowl MVP',
      render: (player) => (
        <span
          className={classNames(
            (player.fullData?.finalsMVPCorrect || player.finalsMVPCorrect)
              ? 'text-green-600 font-medium'
              : 'text-gray-600'
          )}
        >
          {player.fullData?.finalsMVPPick || player.finalsMVPPick || 'None'}
          {(player.fullData?.finalsMVPCorrect || player.finalsMVPCorrect) && ' ✓'}
        </span>
      )
    }
  ]
};

export default NFLPlayoffsLeagueView;
