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

const ROUND_ORDER = ['FirstRound', 'ConfSemis', 'ConfFinals', 'SuperBowl'];
const ROUND_LABELS = {
  FirstRound: 'First Round',
  ConfSemis: 'Conference Semis',
  ConfFinals: 'Conference Finals',
  SuperBowl: 'Super Bowl'
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
  const superBowlStatus = champion !== 'TBD' ? 'Closed' : 'Open';

  return {
    kicker: 'Bracket story',
    title: `NFL Playoffs: ${champion}`,
    subtitle: `A postseason built on winners, spread calls, totals, and bonus picks that make the Super Bowl feel bigger than the rest.`,
    chips: [
      makeChip({ label: 'Champion', value: champion, tone: 'blue' }),
      makeChip({ label: 'Super Bowl MVP', value: finalsMvp, tone: 'emerald' }),
      makeChip({ label: 'Super Bowl', value: superBowlStatus, tone: 'slate' })
    ],
    cards: [
      makeCard({ label: 'Players', value: getPlayerCount(leagueDetail), meta: 'League entries', tone: 'slate' }),
      makeCard({ label: 'Top Score', value: getTopScore(leagueDetail), meta: 'Best bracket score', tone: 'emerald' }),
      makeCard({ label: 'Median Score', value: getMedianScore(leagueDetail), meta: 'Middle score', tone: 'blue' }),
      makeCard({ label: 'Accuracy', value: getAccuracy(leagueDetail), meta: 'Across the league', tone: 'amber' })
    ],
    storySections: [
      {
        kicker: 'Scoring texture',
        title: 'NFL Playoffs score like a stack of bets',
        copy: 'This format is not just about winners. It mixes picks, spreads, totals, score bonuses, and the championship finish into one postseason story.',
        points: [
          `Visible scoring rounds: ${roundPresence} of ${ROUND_ORDER.length}`,
          gaps.firstToSecond !== null
            ? `The gap from the top bracket to second place was ${gaps.firstToSecond} points.`
            : 'Top-end separation was not present in the canonical payload.',
          `Finals MVP anchor: ${finalsMvp}`
        ]
      },
      {
        kicker: 'Finish line',
        title: 'The late bonuses decide who actually wins',
        copy: `The cleanest brackets are the ones that stayed true through ${champion} and then collected bonus points on the Super Bowl side of the ledger.`,
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
        label: 'Super Bowl MVP',
        render: (player) => renderPickCell(player.specialPicks?.finalsMVPPick, player.specialPicks?.finalsMVPCorrect)
      }
    ],
    roundTitle: 'Round-by-round NFL pressure',
    roundFootnote: 'Spread, totals, exact-score bonuses, and props matter more here than in a simple winner-pick format.',
    spotlightSections: [
      {
        title: 'Who controlled the board',
        copy: 'The best NFL brackets usually show the same story twice: correct winners first, then bonus points that separate the podium.',
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
      const spread = Number(round.spreadPoints || round.spread || 0);
      const totals = Number(round.overUnderPoints || round.totals || 0);
      const scoreBonus = Number(round.scoreBonusPoints || round.scoreBonus || 0);
      const perfect = Number(round.perfectScorePoints || round.perfect || 0);
      const total = Number(round.totalPoints || round.total || base + spread + totals + scoreBonus + perfect);
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
      makeChip({ label: 'Super Bowl MVP', value: specialPicks.finalsMVPPick || 'None', tone: specialPicks.finalsMVPCorrect ? 'emerald' : 'amber' }),
      makeChip({ label: 'Total possible', value: leader.totalPossible || '—', tone: 'slate' })
    ],
    cards: [
      makeCard({ label: 'Score', value: leader.score || 0, meta: 'Total points', tone: 'slate' }),
      makeCard({ label: 'Accuracy', value: leader.accuracy || 0, meta: 'Winner accuracy', tone: 'blue' }),
      makeCard({ label: 'Correct Picks', value: `${leader.correctPicks || 0} / ${leader.totalPossible || 0}`, meta: 'Correct winners', tone: 'emerald' }),
      makeCard({ label: 'Rank', value: leader.rank ? `#${leader.rank}` : '—', meta: leagueDetail?.playerCount ? `of ${leagueDetail.playerCount}` : 'League finish', tone: 'amber' })
    ],
    storySections: [
      {
        kicker: 'Pick profile',
        title: 'NFL scoring rewards the full board',
        copy: 'A strong entry in this format is not just a champion pick. It also catches the bonus layers hidden in the rounds and the late-game props.',
        points: [
          specialPicks.championPick ? `Champion pick: ${specialPicks.championPick}${specialPicks.championCorrect ? ' (correct)' : ''}` : 'No champion pick recorded.',
          specialPicks.finalsMVPPick ? `Super Bowl MVP pick: ${specialPicks.finalsMVPPick}${specialPicks.finalsMVPCorrect ? ' (correct)' : ''}` : 'No MVP pick recorded.',
          `Round rows captured: ${roundRows.length}`
        ]
      }
    ],
    roundTitle: 'NFL playoffs breakdown',
    roundFootnote: 'This view follows the current canonical roundBreakdown from the leader record.',
    spotlightSections: [
      {
        title: 'Scoring rhythm',
        copy: 'The best NFL entry often looks quiet until the bonus rows land. That is where the table separates.',
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

export const getNFLPlayoffsLeaguePagePresentation = (leagueDetail = {}) => ({
  gameTypeId: 'nflPlayoffs',
  theme: 'blue',
  ...buildStory(leagueDetail),
  roundRows: buildRoundRows(leagueDetail)
});

export const getNFLPlayoffsExpandedRenderer = () => (leader = {}, leagueDetail = {}) => {
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
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">NFL breakdown</div>
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

export default getNFLPlayoffsLeaguePagePresentation;
