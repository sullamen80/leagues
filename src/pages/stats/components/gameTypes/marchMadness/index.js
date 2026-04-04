import React from 'react';
import {
  getAccuracy,
  getChampionLabel,
  getDisplayName,
  getLeadGaps,
  getPlayerCount,
  getRoundBreakdownRows,
  getRoundPresenceSummary,
  getRoundStatRows,
  getTopLeaders,
  getTopScore,
  makeCard,
  makeChip,
  safeArray
} from '../shared';

const ROUND_ORDER = ['RoundOf64', 'RoundOf32', 'Sweet16', 'Elite8', 'FinalFour', 'Championship'];
const ROUND_LABELS = {
  RoundOf64: 'Round of 64',
  RoundOf32: 'Round of 32',
  Sweet16: 'Sweet 16',
  Elite8: 'Elite 8',
  FinalFour: 'Final Four',
  Championship: 'Championship'
};

const renderPickCell = (value, correct, emptyLabel = 'No pick') => (
  <div className="min-w-[7rem]">
    <div className={correct ? 'font-semibold text-emerald-700' : 'text-slate-700'}>
      {value || emptyLabel}
    </div>
    <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {value ? (correct ? 'Hit' : 'Miss') : 'Open'}
    </div>
  </div>
);

const renderCountCell = (value, label) => (
  <div className="min-w-[6rem]">
    <div className="font-semibold text-slate-900">{value}</div>
    <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {label}
    </div>
  </div>
);

const buildStory = (leagueDetail = {}) => {
  const champion = getChampionLabel(leagueDetail);
  const leaders = safeArray(leagueDetail?.leaders);
  const topLeaders = getTopLeaders(leagueDetail, 3);
  const gaps = getLeadGaps(leaders);
  const upsetCount = Number(leagueDetail?.highlights?.upsetCount || leagueDetail?.stats?.modePayload?.upsetStats?.totalUpsets || 0);
  const finalFourTeams = safeArray(leagueDetail?.highlights?.finalFourTeams);
  const roundStats = leagueDetail?.stats?.roundStats || {};
  const roundPresence = getRoundPresenceSummary(roundStats, ROUND_ORDER);

  return {
    kicker: 'Tournament story',
    title: `March Madness: ${champion}`,
    subtitle: `A bracket race shaped by ${upsetCount || 0} upset swings, ${getPlayerCount(leagueDetail)} entries, and ${roundPresence} rounds where the field had to survive the same chaos.`,
    chips: [
      makeChip({ label: 'Champion', value: champion, tone: 'amber' }),
      makeChip({ label: 'Upsets', value: upsetCount, tone: 'rose' }),
      makeChip({ label: 'Players', value: getPlayerCount(leagueDetail), tone: 'slate' })
    ],
    cards: [
      makeCard({ label: 'Players', value: getPlayerCount(leagueDetail), meta: 'Bracket entries', tone: 'slate' }),
      makeCard({ label: 'Top Score', value: getTopScore(leagueDetail), meta: 'Best bracket score', tone: 'emerald' }),
      makeCard({ label: 'Upsets', value: upsetCount, meta: 'Tournament swings logged', tone: 'rose' }),
      makeCard({ label: 'League Accuracy', value: getAccuracy(leagueDetail), meta: 'Across the field', tone: 'amber' })
    ],
    storySections: [
      {
        kicker: 'Upset pressure',
        title: 'The bracket changed shape early',
        copy: upsetCount
          ? `The story of this league was not just the champion. It was the ${upsetCount} upset swing(s) that forced everyone to chase the same chaos.`
          : 'This league tracked more like a chalk bracket, so the story lives in how cleanly the field survived each round.',
        points: [
          finalFourTeams.length
            ? `Final Four: ${finalFourTeams.map((team) => getDisplayName(team)).join(', ')}`
            : 'Final Four context is not present in the current canonical payload.',
          gaps.firstToSecond !== null
            ? `The leader gap from #1 to #2 was ${gaps.firstToSecond} points.`
            : 'Top-end separation was not available in the current payload.',
          gaps.fieldGap !== null
            ? `The spread from first to last was ${gaps.fieldGap} points.`
            : 'Field-wide spread was not available in the current payload.'
        ]
      },
      {
        kicker: 'Champion path',
        title: 'Winning the title meant holding the last rounds',
        copy: `The champion pick landed on ${champion}. The best brackets were the ones that stayed alive through the Final Four and closed on the Championship round.`,
        points: [
          `Round coverage: ${roundPresence} of ${ROUND_ORDER.length} rounds show measurable scoring.`,
          topLeaders.length > 0 ? `Top finisher: ${topLeaders[0].userName}` : 'No leader rows were provided.',
          topLeaders[1] ? `Runner-up: ${topLeaders[1].userName}` : 'No second-place leader available.'
        ]
      }
    ],
    extraColumns: [
      {
        key: 'championPick',
        label: 'Champion Pick',
        render: (player) => renderPickCell(player.specialPicks?.championPick, player.specialPicks?.championCorrect)
      },
      {
        key: 'upsetCount',
        label: 'Upsets Called',
        render: (player) => renderCountCell(Number(player.specialPicks?.upsetCount || 0), 'Hits')
      }
    ],
    roundTitle: 'Round-by-round bracket pressure',
    roundFootnote: 'Higher accuracy in later rounds usually mattered most once the field thinned.',
    spotlightSections: [
      {
        title: 'Who set the pace',
        copy: 'The leaderboard tells the rest of the story: one or two clean brackets usually separated themselves before the championship round.',
        leaders: topLeaders
      }
    ]
  };
};

const buildExpandedPresentation = (leader = {}, leagueDetail = {}) => {
  const roundBreakdown = leader?.fullData?.roundBreakdown || leader?.roundBreakdown || {};
  const specialPicks = leader?.fullData?.specialPicks || leader?.specialPicks || {};
  const roundRows = getRoundBreakdownRows(
    roundBreakdown,
    ROUND_ORDER,
    ROUND_LABELS,
    (roundId, round, label) => {
      const correct = Number(round.correct || round.correctPicks || 0);
      const possible = Number(round.possible || round.possiblePicks || round.total || 0);
      const base = Number(round.base || round.basePoints || 0);
      const bonus = Number(round.bonus || round.bonusPoints || 0);
      const total = Number(round.total || round.totalPoints || base + bonus);
      if (!possible && !correct && !total) return null;
      return {
        id: roundId,
        label,
        correct,
        possible,
        accuracy: possible > 0 ? correct / possible : 0,
        total
      };
    }
  );

  return {
    kicker: 'Player story',
    title: leader.userName || 'Unknown bracket',
    subtitle: `Rank #${leader.rank || '—'} with ${leader.score || 0} points and ${((leader.accuracy || 0) * 100).toFixed(1)}% accuracy.`,
    chips: [
      makeChip({ label: 'Champion pick', value: specialPicks.championPick || 'None', tone: specialPicks.championCorrect ? 'emerald' : 'amber' }),
      makeChip({ label: 'Upset count', value: specialPicks.upsetCount || 0, tone: 'rose' }),
      makeChip({ label: 'Total possible', value: leader.totalPossible || '—', tone: 'slate' })
    ],
    cards: [
      makeCard({ label: 'Score', value: leader.score || 0, meta: 'Total points', tone: 'slate' }),
      makeCard({ label: 'Accuracy', value: leader.accuracy || 0, meta: 'Bracket accuracy', tone: 'blue' }),
      makeCard({ label: 'Correct Picks', value: `${leader.correctPicks || 0} / ${leader.totalPossible || 0}`, meta: 'Matched picks', tone: 'emerald' }),
      makeCard({ label: 'Rank', value: leader.rank ? `#${leader.rank}` : '—', meta: leagueDetail?.playerCount ? `of ${leagueDetail.playerCount}` : 'League finish', tone: 'amber' })
    ],
    storySections: [
      {
        kicker: 'Pick profile',
        title: 'How this bracket built its score',
        copy: 'The best March Madness entries are not just correct. They are correct in the right rounds, where a few late misses can erase an early lead.',
        points: [
          specialPicks.championPick ? `Champion pick: ${specialPicks.championPick}${specialPicks.championCorrect ? ' (correct)' : ''}` : 'No champion pick recorded.',
          `Upsets called: ${specialPicks.upsetCount || 0}`,
          `Rounds represented: ${roundRows.length || 0}`
        ]
      }
    ],
    roundTitle: 'Bracket breakdown',
    roundFootnote: 'This breakdown uses the canonical roundBreakdown stored on the leader record.',
    spotlightSections: [
      {
        title: 'Round shape',
        copy: 'Later rounds carry more weight, so the cleanest brackets usually show steadier accuracy after the opening chaos.',
        leaders: [
          {
            userId: leader.userId,
            userName: leader.userName,
            rank: leader.rank,
            score: leader.score,
            accuracy: leader.accuracy
          }
        ]
      }
    ],
    roundRows
  };
};

const buildRoundRows = (leagueDetail = {}) => {
  const roundRows = getRoundStatRows(leagueDetail?.stats?.roundStats || {}, ROUND_ORDER, ROUND_LABELS);
  return roundRows;
};

export const getMarchMadnessLeaguePagePresentation = (leagueDetail = {}) => ({
  gameTypeId: 'marchMadness',
  theme: 'amber',
  ...buildStory(leagueDetail),
  roundRows: buildRoundRows(leagueDetail)
});

export const getMarchMadnessExpandedRenderer = () => (leader = {}, leagueDetail = {}) => {
  const presentation = buildExpandedPresentation(leader, leagueDetail);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {presentation.cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">{card.label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</div>
          <div className="mt-1 text-sm text-slate-500">{card.meta}</div>
        </div>
      ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {presentation.storySections.map((section) => (
        <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">{section.kicker}</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{section.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{section.copy}</p>
          <ul className="mt-4 space-y-2">
            {section.points.map((point) => (
              <li key={point} className="flex gap-2 text-sm text-slate-600">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      </div>
      {presentation.roundRows.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Bracket breakdown</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Round-by-round scoring</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Round</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Correct</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Possible</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Accuracy</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {presentation.roundRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{row.label}</td>
                    <td className="px-5 py-3 text-right text-sm text-slate-600">{row.correct}</td>
                    <td className="px-5 py-3 text-right text-sm text-slate-600">{row.possible}</td>
                    <td className="px-5 py-3 text-right text-sm text-slate-600">{(row.accuracy * 100).toFixed(1)}%</td>
                    <td className="px-5 py-3 text-right text-sm text-slate-600">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default getMarchMadnessLeaguePagePresentation;
