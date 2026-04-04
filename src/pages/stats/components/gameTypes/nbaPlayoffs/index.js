import React from 'react';
import {
  getAccuracy,
  getChampionLabel,
  getFinalsMvpLabel,
  getLeadGaps,
  getMedianScore,
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

const ROUND_ORDER = ['PlayIn', 'FirstRound', 'ConfSemis', 'ConfFinals', 'NBAFinals'];
const ROUND_LABELS = {
  PlayIn: 'Play-In',
  FirstRound: 'First Round',
  ConfSemis: 'Conference Semis',
  ConfFinals: 'Conference Finals',
  NBAFinals: 'NBA Finals'
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

const buildStory = (leagueDetail = {}) => {
  const champion = getChampionLabel(leagueDetail);
  const finalsMvp = getFinalsMvpLabel(leagueDetail);
  const leaders = safeArray(leagueDetail?.leaders);
  const topLeaders = getTopLeaders(leagueDetail, 3);
  const gaps = getLeadGaps(leaders);
  const roundStats = leagueDetail?.stats?.roundStats || {};
  const roundPresence = getRoundPresenceSummary(roundStats, ROUND_ORDER);
  const playInEnabled = !!leagueDetail?.highlights?.hasPlayInTournament;

  return {
    kicker: 'Series story',
    title: `NBA Playoffs: ${champion}`,
    subtitle: `A title race built on long-series accuracy, ${roundPresence} scoring rounds, and the closing bet on ${finalsMvp}.`,
    chips: [
      makeChip({ label: 'Champion', value: champion, tone: 'blue' }),
      makeChip({ label: 'Finals MVP', value: finalsMvp, tone: 'emerald' }),
      makeChip({ label: 'Play-In', value: playInEnabled ? 'On' : 'Off', tone: 'slate' })
    ],
    cards: [
      makeCard({ label: 'Players', value: getPlayerCount(leagueDetail), meta: 'League entries', tone: 'slate' }),
      makeCard({ label: 'Top Score', value: getTopScore(leagueDetail), meta: 'Best bracket score', tone: 'emerald' }),
      makeCard({ label: 'Median Score', value: getMedianScore(leagueDetail), meta: 'Middle score', tone: 'blue' }),
      makeCard({ label: 'Accuracy', value: getAccuracy(leagueDetail), meta: 'Across the league', tone: 'amber' })
    ],
    storySections: [
      {
        kicker: 'Series control',
        title: 'The best entries won the long series',
        copy: 'NBA Playoffs rewards consistency over a longer postseason arc. The story is which brackets stayed aligned through the Play-In, the first round, and the last two series.',
        points: [
          playInEnabled ? 'Play-In round was part of the shape of the league.' : 'The league skipped the Play-In layer.',
          gaps.firstToSecond !== null
            ? `Top-end separation from #1 to #2 was ${gaps.firstToSecond} points.`
            : 'Top-end separation was not present in the canonical payload.',
          `Finals MVP focus: ${finalsMvp}`
        ]
      },
      {
        kicker: 'Title route',
        title: 'The champion and the Finals MVP defined the last chapter',
        copy: `This league closed on ${champion}, with ${finalsMvp} as the awards-story anchor. The strongest entries were the ones that matched both the series winners and the bonus picks.`,
        points: [
          topLeaders.length ? `Top finisher: ${topLeaders[0].userName}` : 'No leaderboard rows available.',
          topLeaders[1] ? `Second place: ${topLeaders[1].userName}` : 'No runner-up row available.',
          topLeaders[2] ? `Third place: ${topLeaders[2].userName}` : 'No third-place row available.'
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
        key: 'finalsMVPPick',
        label: 'Finals MVP',
        render: (player) => renderPickCell(player.specialPicks?.finalsMVPPick, player.specialPicks?.finalsMVPCorrect)
      }
    ],
    roundTitle: 'Series-by-series pressure',
    roundFootnote: 'The postseason gets more valuable as the series shorten, so later rounds should carry the strongest signal.',
    spotlightSections: [
      {
        title: 'Who controlled the bracket',
        copy: 'The field usually splits early between safe series picks and entries that cash in on a sharper Finals path.',
        leaders: topLeaders
      }
    ]
  };
};

const buildRoundRows = (leagueDetail = {}) => {
  const roundRows = getRoundStatRows(leagueDetail?.stats?.roundStats || {}, ROUND_ORDER, ROUND_LABELS);
  return roundRows;
};

const buildExpandedPresentation = (leader = {}, leagueDetail = {}) => {
  const roundBreakdown = leader?.fullData?.roundBreakdown || leader?.roundBreakdown || {};
  const specialPicks = leader?.fullData?.specialPicks || leader?.specialPicks || {};
  const roundRows = getRoundBreakdownRows(
    roundBreakdown,
    ROUND_ORDER,
    ROUND_LABELS,
    (roundId, round, label) => {
      const correct = Number(round.correctPicks || round.correct || 0);
      const base = Number(round.basePoints || round.base || 0);
      const series = Number(round.seriesLengthPoints || round.series || 0);
      const upset = Number(round.upsetPoints || round.upset || 0);
      const total = Number(round.totalPoints || round.total || base + series + upset);
      if (!correct && !total) return null;
      return {
        id: roundId,
        label,
        correct,
        possible: Number(round.possible || round.total || 0),
        accuracy: Number(round.possible || round.total || 0) > 0 ? correct / Number(round.possible || round.total || 0) : 0,
        total
      };
    }
  );

  return {
    kicker: 'Player story',
    title: leader.userName || 'Unknown entry',
    subtitle: `Rank #${leader.rank || '—'} with ${leader.score || 0} points and ${((leader.accuracy || 0) * 100).toFixed(1)}% accuracy.`,
    chips: [
      makeChip({ label: 'Champion pick', value: specialPicks.championPick || 'None', tone: specialPicks.championCorrect ? 'emerald' : 'blue' }),
      makeChip({ label: 'Finals MVP', value: specialPicks.finalsMVPPick || 'None', tone: specialPicks.finalsMVPCorrect ? 'emerald' : 'amber' }),
      makeChip({ label: 'Total possible', value: leader.totalPossible || '—', tone: 'slate' })
    ],
    cards: [
      makeCard({ label: 'Score', value: leader.score || 0, meta: 'Total points', tone: 'slate' }),
      makeCard({ label: 'Accuracy', value: leader.accuracy || 0, meta: 'Series accuracy', tone: 'blue' }),
      makeCard({ label: 'Correct Picks', value: `${leader.correctPicks || 0} / ${leader.totalPossible || 0}`, meta: 'Series calls', tone: 'emerald' }),
      makeCard({ label: 'Rank', value: leader.rank ? `#${leader.rank}` : '—', meta: leagueDetail?.playerCount ? `of ${leagueDetail.playerCount}` : 'League finish', tone: 'amber' })
    ],
    storySections: [
      {
        kicker: 'Series profile',
        title: 'This bracket was built on series control',
        copy: 'In NBA Playoffs scoring, it is not enough to call the champion. The cleanest entries usually paired the right Finals pick with steady series wins along the way.',
        points: [
          specialPicks.championPick ? `Champion pick: ${specialPicks.championPick}${specialPicks.championCorrect ? ' (correct)' : ''}` : 'No champion pick recorded.',
          specialPicks.finalsMVPPick ? `Finals MVP pick: ${specialPicks.finalsMVPPick}${specialPicks.finalsMVPCorrect ? ' (correct)' : ''}` : 'No Finals MVP pick recorded.',
          `Series rows captured: ${roundRows.length}`
        ]
      }
    ],
    roundTitle: 'Playoff series breakdown',
    roundFootnote: 'This view uses the current canonical roundBreakdown from the leader row.',
    spotlightSections: [
      {
        title: 'Series rhythm',
        copy: 'The shape of the bracket is usually decided by the last two series, but a strong Play-In or first round can still separate the top of the table.',
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

export const getNBAPlayoffsLeaguePagePresentation = (leagueDetail = {}) => ({
  gameTypeId: 'nbaPlayoffs',
  theme: 'blue',
  ...buildStory(leagueDetail),
  roundRows: buildRoundRows(leagueDetail)
});

export const getNBAPlayoffsExpandedRenderer = () => (leader = {}, leagueDetail = {}) => {
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
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Series breakdown</div>
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

export default getNBAPlayoffsLeaguePagePresentation;
