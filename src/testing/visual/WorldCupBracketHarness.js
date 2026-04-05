import React, { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import WorldCupKnockoutBracket from '../../gameTypes/worldCup/components/WorldCupKnockoutBracket';
import { FIFA_TEAM_LOOKUP } from '../../gameTypes/worldCup/constants/fifaTeams';

const TEAM_IDS = [
  'mexico', 'south-korea', 'south-africa', 'czechia',
  'canada', 'switzerland', 'qatar', 'bosnia-herzegovina',
  'brazil', 'morocco', 'scotland', 'haiti',
  'united-states', 'australia', 'paraguay', 'turkiye',
  'germany', 'ecuador', 'ivory-coast', 'curacao',
  'netherlands', 'japan', 'tunisia', 'sweden',
  'belgium', 'iran', 'egypt', 'new-zealand',
  'spain', 'uruguay', 'saudi-arabia', 'cape-verde'
];

const buildGroups = () => (
  Array.from({ length: 8 }, (_, groupIndex) => ({
    id: String.fromCharCode(65 + groupIndex),
    name: `Group ${String.fromCharCode(65 + groupIndex)}`,
    teams: TEAM_IDS.slice(groupIndex * 4, (groupIndex + 1) * 4).map((teamId) => ({
      ...FIFA_TEAM_LOOKUP[teamId]
    }))
  }))
);

const makeMatch = (id, label, homeTeamId, awayTeamId, winnerTeamId, homeScore, awayScore) => ({
  id,
  label,
  homeTeamId,
  awayTeamId,
  winnerTeamId,
  homeScore,
  awayScore,
  homeTeamName: FIFA_TEAM_LOOKUP[homeTeamId]?.name || homeTeamId,
  awayTeamName: FIFA_TEAM_LOOKUP[awayTeamId]?.name || awayTeamId,
  winnerTeamName: FIFA_TEAM_LOOKUP[winnerTeamId]?.name || winnerTeamId
});

const buildBracket = () => ({
  roundOf32: [
    makeMatch('m73', 'M73', 'mexico', 'czechia', 'mexico', 2, 0),
    makeMatch('m74', 'M74', 'south-korea', 'south-africa', 'south-korea', 1, 0),
    makeMatch('m75', 'M75', 'canada', 'bosnia-herzegovina', 'canada', 3, 1),
    makeMatch('m76', 'M76', 'switzerland', 'qatar', 'switzerland', 2, 1),
    makeMatch('m77', 'M77', 'brazil', 'haiti', 'brazil', 4, 0),
    makeMatch('m78', 'M78', 'morocco', 'scotland', 'morocco', 2, 1),
    makeMatch('m79', 'M79', 'united-states', 'turkiye', 'united-states', 2, 1),
    makeMatch('m80', 'M80', 'australia', 'paraguay', 'paraguay', 0, 1),
    makeMatch('m81', 'M81', 'germany', 'curacao', 'germany', 3, 0),
    makeMatch('m82', 'M82', 'ecuador', 'ivory-coast', 'ecuador', 2, 1),
    makeMatch('m83', 'M83', 'netherlands', 'sweden', 'netherlands', 1, 0),
    makeMatch('m84', 'M84', 'japan', 'tunisia', 'japan', 2, 0),
    makeMatch('m85', 'M85', 'belgium', 'new-zealand', 'belgium', 3, 1),
    makeMatch('m86', 'M86', 'iran', 'egypt', 'egypt', 0, 2),
    makeMatch('m87', 'M87', 'spain', 'cape-verde', 'spain', 2, 0),
    makeMatch('m88', 'M88', 'uruguay', 'saudi-arabia', 'uruguay', 1, 0)
  ],
  roundOf16: [
    makeMatch('m89', 'M89', 'mexico', 'south-korea', 'mexico', 2, 1),
    makeMatch('m90', 'M90', 'canada', 'switzerland', 'canada', 1, 0),
    makeMatch('m91', 'M91', 'brazil', 'morocco', 'brazil', 3, 1),
    makeMatch('m92', 'M92', 'united-states', 'paraguay', 'united-states', 2, 1),
    makeMatch('m93', 'M93', 'germany', 'ecuador', 'germany', 2, 0),
    makeMatch('m94', 'M94', 'netherlands', 'japan', 'netherlands', 3, 2),
    makeMatch('m95', 'M95', 'belgium', 'egypt', 'belgium', 2, 1),
    makeMatch('m96', 'M96', 'spain', 'uruguay', 'spain', 1, 0)
  ],
  quarterfinals: [
    makeMatch('m97', 'M97', 'mexico', 'canada', 'mexico', 2, 1),
    makeMatch('m98', 'M98', 'brazil', 'united-states', 'brazil', 3, 2),
    makeMatch('m99', 'M99', 'germany', 'netherlands', 'germany', 1, 0),
    makeMatch('m100', 'M100', 'belgium', 'spain', 'spain', 1, 2)
  ],
  semifinals: [
    makeMatch('m101', 'M101', 'mexico', 'brazil', 'brazil', 1, 2),
    makeMatch('m102', 'M102', 'germany', 'spain', 'spain', 1, 3)
  ],
  thirdPlace: [
    makeMatch('m103', 'M103', 'mexico', 'germany', 'germany', 0, 1)
  ],
  final: [
    makeMatch('m104', 'M104', 'brazil', 'spain', 'spain', 1, 2)
  ]
});

const buildOfficialBracket = () => ({
  ...buildBracket(),
  roundOf32: [
    makeMatch('m73', 'M73', 'mexico', 'czechia', 'mexico', 2, 0),
    makeMatch('m74', 'M74', 'south-korea', 'south-africa', 'south-africa', 0, 1),
    makeMatch('m75', 'M75', 'canada', 'bosnia-herzegovina', 'canada', 3, 1),
    makeMatch('m76', 'M76', 'switzerland', 'qatar', 'switzerland', 2, 1),
    makeMatch('m77', 'M77', 'brazil', 'haiti', 'brazil', 4, 0),
    makeMatch('m78', 'M78', 'morocco', 'scotland', 'morocco', 2, 1),
    makeMatch('m79', 'M79', 'united-states', 'turkiye', 'turkiye', 1, 2),
    makeMatch('m80', 'M80', 'australia', 'paraguay', 'paraguay', 0, 1),
    makeMatch('m81', 'M81', 'germany', 'curacao', 'germany', 3, 0),
    makeMatch('m82', 'M82', 'ecuador', 'ivory-coast', 'ivory-coast', 1, 2),
    makeMatch('m83', 'M83', 'netherlands', 'sweden', 'netherlands', 1, 0),
    makeMatch('m84', 'M84', 'japan', 'tunisia', 'japan', 2, 0),
    makeMatch('m85', 'M85', 'belgium', 'new-zealand', 'belgium', 3, 1),
    makeMatch('m86', 'M86', 'iran', 'egypt', 'egypt', 0, 2),
    makeMatch('m87', 'M87', 'spain', 'cape-verde', 'spain', 2, 0),
    makeMatch('m88', 'M88', 'uruguay', 'saudi-arabia', 'uruguay', 1, 0)
  ],
  roundOf16: [
    makeMatch('m89', 'M89', 'mexico', 'south-africa', 'mexico', 2, 0),
    makeMatch('m90', 'M90', 'canada', 'switzerland', 'switzerland', 0, 1),
    makeMatch('m91', 'M91', 'brazil', 'morocco', 'brazil', 3, 1),
    makeMatch('m92', 'M92', 'turkiye', 'paraguay', 'paraguay', 1, 2),
    makeMatch('m93', 'M93', 'germany', 'ivory-coast', 'germany', 2, 1),
    makeMatch('m94', 'M94', 'netherlands', 'japan', 'japan', 0, 1),
    makeMatch('m95', 'M95', 'belgium', 'egypt', 'belgium', 2, 1),
    makeMatch('m96', 'M96', 'spain', 'uruguay', 'spain', 1, 0)
  ],
  quarterfinals: [
    makeMatch('m97', 'M97', 'mexico', 'switzerland', 'mexico', 1, 0),
    makeMatch('m98', 'M98', 'brazil', 'paraguay', 'brazil', 2, 0),
    makeMatch('m99', 'M99', 'germany', 'japan', 'germany', 2, 1),
    makeMatch('m100', 'M100', 'belgium', 'spain', 'spain', 1, 2)
  ],
  semifinals: [
    makeMatch('m101', 'M101', 'mexico', 'brazil', 'brazil', 1, 2),
    makeMatch('m102', 'M102', 'germany', 'spain', 'spain', 1, 3)
  ],
  thirdPlace: [
    makeMatch('m103', 'M103', 'mexico', 'germany', 'germany', 0, 1)
  ],
  final: [
    makeMatch('m104', 'M104', 'brazil', 'spain', 'spain', 1, 2)
  ]
});

const buildLongNameGroups = () => (
  buildGroups().map((group) => ({
    ...group,
    teams: group.teams.map((team) => ({
      ...team,
      name: `${team.name} Football Federation`,
      shortName: `${team.shortName || team.name} FF`
    }))
  }))
);

const scenarioMap = {
  default: {
    title: 'Default Bracket',
    description: 'Baseline 32-team mirrored bracket layout for the World Cup knockout stage.',
    groups: buildGroups(),
    rounds: buildBracket(),
    officialRounds: null
  },
  official: {
    title: 'Against Official Results',
    description: 'User bracket versus official results to validate spacing and comparison badges.',
    groups: buildGroups(),
    rounds: buildBracket(),
    officialRounds: buildOfficialBracket()
  },
  'long-names': {
    title: 'Long Team Names',
    description: 'Stress case for name truncation and dense 32-team canvas rendering.',
    groups: buildLongNameGroups(),
    rounds: buildBracket(),
    officialRounds: null
  }
};

const scenarioLinks = Object.keys(scenarioMap);

const VisualChrome = ({ currentScenario, title, description, children }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0_55%,_#cbd5e1)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Visual Regression Harness
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">World Cup Bracket Visual Harness</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {scenarioLinks.map((scenario) => (
              <Link
                key={scenario}
                to={`/__visual-tests/world-cup-bracket/${scenario}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  scenario === currentScenario
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {scenario}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-500">{title}</div>
      </div>

      <div
        data-testid="scenario-frame"
        className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-300/40 sm:p-8"
      >
        {children}
      </div>
    </div>
  </div>
);

const WorldCupBracketHarness = () => {
  const { scenario: rawScenario } = useParams();
  const location = useLocation();
  const scenario = scenarioMap[rawScenario] ? rawScenario : 'default';
  const exportMode = new URLSearchParams(location.search).get('mode') === 'export';
  const config = useMemo(() => scenarioMap[scenario], [scenario]);

  return (
    <VisualChrome
      currentScenario={scenario}
      title={config.title}
      description={config.description}
    >
      <div data-testid="visual-harness">
        <WorldCupKnockoutBracket
          groups={config.groups}
          rounds={config.rounds}
          officialRounds={config.officialRounds}
          showThirdPlace={true}
          readOnly={true}
          isOfficialBracket={false}
          isLocked={true}
          forceDesktopCanvas={exportMode}
          exportMode={exportMode}
        />
      </div>
    </VisualChrome>
  );
};

export default WorldCupBracketHarness;
