import React from 'react';
import { getColorClass } from '../../../../styles/tokens/colors';
import { classNames } from '../../../../utils/formatters';
import { DRAFT_STATUS } from '../../constants/winsPoolConstants';

const OverviewTab = ({ gameData, roster, teamPool }) => {
  const draftStatus = gameData?.draft?.status || DRAFT_STATUS.NOT_STARTED;
  const rosterSize = gameData?.rosterSettings?.rosterSize || 0;
  const assignmentMode = gameData?.rosterSettings?.assignmentMode || 'draft';
  const totalWins = roster?.totalWins || 0;
  const rosterCount = roster?.teams?.length || 0;
  const totalTeams = teamPool?.length || 0;

  const statusColor = draftStatus === DRAFT_STATUS.COMPLETED
    ? 'green'
    : draftStatus === DRAFT_STATUS.IN_PROGRESS
    ? 'orange'
    : draftStatus === DRAFT_STATUS.PAUSED
    ? 'amber'
    : 'blue';

  const draftStatusLabel = (() => {
    switch (draftStatus) {
      case DRAFT_STATUS.IN_PROGRESS:
        return 'In Progress';
      case DRAFT_STATUS.COMPLETED:
        return 'Completed';
      case DRAFT_STATUS.PAUSED:
        return 'Paused';
      default:
        return 'Not Started';
    }
  })();

  const assignmentModeLabel = (() => {
    switch (assignmentMode) {
      case 'auto_assign':
        return 'Auto Assign';
      case 'manual':
        return 'Manual';
      case 'auction':
        return 'Auction Draft';
      case 'double_snake':
        return 'Double-Headed Snake';
      default:
        return 'Snake Draft';
    }
  })();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={classNames(
          'rounded-lg shadow-md p-5 border-l-4',
          getColorClass(statusColor, '500', 'border'),
          'bg-white'
        )}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Draft Status
          </h3>
          <p className={classNames(
            'mt-2 text-2xl font-bold',
            getColorClass(statusColor, '600', 'text')
          )}>
            {draftStatusLabel}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Mode: {assignmentModeLabel}
          </p>
        </div>

        <div className="rounded-lg shadow-md p-5 border-l-4 border-indigo-500 bg-white">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Roster Requirements
          </h3>
          <p className="mt-2 text-2xl font-bold text-indigo-600">
            {rosterSize} Teams / User
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Duplicate Teams {gameData?.scoring?.allowDuplicateTeams ? 'Allowed' : 'Not Allowed'}
          </p>
        </div>

        <div className="rounded-lg shadow-md p-5 border-l-4 border-emerald-500 bg-white">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            My Wins
          </h3>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {totalWins}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Rostered Teams: {rosterCount || 'Waiting on draft'}
          </p>
        </div>

        <div className="rounded-lg shadow-md p-5 border-l-4 border-purple-500 bg-white">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Team Pool
          </h3>
          <p className="mt-2 text-2xl font-bold text-purple-600">
            {totalTeams}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {gameData?.teamPool?.name || 'Not configured'}
          </p>
        </div>
      </section>

      <section className="rounded-lg shadow-md p-6 bg-white border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Scoring Summary</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500 uppercase">Points Per Win</p>
            <p className="text-xl font-semibold text-gray-800 mt-1">
              {gameData?.scoring?.pointsPerWin ?? 1}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase">Overtime Bonus</p>
            <p className="text-xl font-semibold text-gray-800 mt-1">
              {gameData?.scoring?.overtimeWinBonus ?? 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase">Playoff Multiplier</p>
            <p className="text-xl font-semibold text-gray-800 mt-1">
              {gameData?.scoring?.playoffWinMultiplier ?? 1}x
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg shadow-md p-6 bg-white border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Season Timeline
        </h3>
        <ol className="list-decimal list-inside text-gray-600 space-y-2">
          <li>League owner configures team pool, scoring, and draft settings from the Admin dashboard.</li>
          <li>Teams are drafted or assigned based on the chosen assignment mode.</li>
          <li>Commissioners can update wins manually or via imports; standings update automatically.</li>
          <li>Leaderboards and rosters update in real time to reflect the race for total wins.</li>
        </ol>
      </section>
    </div>
  );
};

export default OverviewTab;
