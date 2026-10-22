import React from 'react';
import {
  getAccuracy,
  getChampionLabel,
  getPlayerCount,
  getRoundBreakdownRows,
  getRoundStatRows,
  getTopLeaders,
  getTopScore,
  makeCard,
  makeChip
} from '../shared';

const ROUND_ORDER = ['roundOf128', 'roundOf64', 'roundOf32', 'roundOf16', 'quarterfinals', 'semifinals', 'final'];
const ROUND_LABELS = {
  roundOf128: 'Round of 128',
  roundOf64: 'Round of 64',
  roundOf32: 'Round of 32',
  roundOf16: 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  final: 'Final'
};

export const getWimbledonLeaguePagePresentation = (leagueDetail = {}) => {
  const champion = getChampionLabel(leagueDetail);
  const leaders = getTopLeaders(leagueDetail, 3);
  const setPredictionsEnabled = Boolean(leagueDetail?.highlights?.setPredictionEnabled);

  return {
    gameTypeId: 'wimbledon',
    theme: 'emerald',
    kicker: 'Championship story',
    title: `${leagueDetail?.highlights?.eventLabel || 'Wimbledon'}: ${champion}`,
    subtitle: `${getPlayerCount(leagueDetail)} brackets navigated a 128-slot draw across seven rounds.`,
    chips: [
      makeChip({ label: 'Champion', value: champion, tone: 'emerald' }),
      makeChip({ label: 'Players', value: getPlayerCount(leagueDetail), tone: 'slate' }),
      makeChip({ label: 'Set tie-break', value: setPredictionsEnabled ? 'Enabled' : 'Off', tone: 'violet' })
    ],
    cards: [
      makeCard({ label: 'Players', value: getPlayerCount(leagueDetail), meta: 'Submitted brackets', tone: 'slate' }),
      makeCard({ label: 'Top Score', value: getTopScore(leagueDetail), meta: 'Winning bracket score', tone: 'emerald' }),
      makeCard({ label: 'League Accuracy', value: getAccuracy(leagueDetail), meta: 'Across completed matches', tone: 'blue' }),
      makeCard({ label: 'Corrections', value: Number(leagueDetail?.stats?.modePayload?.auditCorrectionCount || 0), meta: 'Audited admin changes', tone: 'amber' })
    ],
    storySections: [
      {
        kicker: 'Draw performance',
        title: 'Seven rounds separated the field',
        copy: 'Opening-round volume rewards consistency, while semifinal and final picks create the largest scoring swings.',
        points: [
          leaders[0] ? `Winner: ${leaders[0].userName} with ${leaders[0].score} points.` : 'No winner row is available.',
          leaders[1] ? `Runner-up: ${leaders[1].userName}.` : 'No runner-up row is available.',
          setPredictionsEnabled ? 'Correct set predictions were used only to break standings ties.' : 'Set predictions were disabled for this league.'
        ]
      }
    ],
    extraColumns: [
      {
        key: 'finalistHits',
        label: 'Finalists',
        render: (player) => `${Number(player.specialPicks?.finalistHits || 0)} / 2`
      },
      {
        key: 'setPredictionHits',
        label: 'Set Hits',
        render: (player) => `${Number(player.specialPicks?.setPredictionHits || 0)} / ${Number(player.specialPicks?.setPredictionAttempts || 0)}`
      }
    ],
    roundTitle: 'Round-by-round accuracy',
    roundFootnote: 'Each row reflects completed official matches and the league field’s matching picks.',
    roundRows: getRoundStatRows(leagueDetail?.stats?.roundStats || {}, ROUND_ORDER, ROUND_LABELS),
    spotlightSections: [{ title: 'Top brackets', copy: 'The strongest entries combined early-round consistency with correct late-round finalists.', leaders }]
  };
};

export const getWimbledonExpandedRenderer = () => (leader = {}) => {
  const rows = getRoundBreakdownRows(
    leader?.roundBreakdown || leader?.fullData?.roundBreakdown || {},
    ROUND_ORDER,
    ROUND_LABELS,
    (roundId, round, label) => ({
      id: roundId,
      label,
      correct: Number(round.correct || 0),
      possible: Number(round.possible || 0),
      accuracy: Number(round.percentage || 0),
      total: Number(round.points || 0)
    })
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">{leader.userName} bracket breakdown</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded bg-slate-50 p-3"><div className="text-xs uppercase text-slate-500">Champion</div><div className="font-semibold">{leader.specialPicks?.championCorrect ? 'Correct' : 'Missed'}</div></div>
        <div className="rounded bg-slate-50 p-3"><div className="text-xs uppercase text-slate-500">Finalists</div><div className="font-semibold">{leader.specialPicks?.finalistHits || 0}/2</div></div>
        <div className="rounded bg-slate-50 p-3"><div className="text-xs uppercase text-slate-500">Set hits</div><div className="font-semibold">{leader.specialPicks?.setPredictionHits || 0}/{leader.specialPicks?.setPredictionAttempts || 0}</div></div>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((row) => <div key={row.id} className="flex justify-between rounded border border-slate-100 px-3 py-2 text-sm"><span>{row.label}</span><span>{row.correct}/{row.possible} · {(row.accuracy * 100).toFixed(1)}%</span></div>)}
      </div>
    </div>
  );
};
