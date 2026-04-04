import React, { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import BracketEditor from '../../gameTypes/nbaPlayoffs/components/BracketEditor';
import { ROUND_KEYS } from '../../gameTypes/nbaPlayoffs/constants/playoffConstants';

const buildStandardBracket = () => ({
  [ROUND_KEYS.FIRST_ROUND]: [
    { team1: 'Celtics', team1Seed: 1, team2: 'Heat', team2Seed: 8, winner: 'Celtics', winnerSeed: 1, numGames: 5, conference: 'East' },
    { team1: 'Knicks', team1Seed: 2, team2: 'Pacers', team2Seed: 7, winner: 'Knicks', winnerSeed: 2, numGames: 6, conference: 'East' },
    { team1: 'Bucks', team1Seed: 3, team2: 'Magic', team2Seed: 6, winner: 'Bucks', winnerSeed: 3, numGames: 7, conference: 'East' },
    { team1: 'Cavaliers', team1Seed: 4, team2: '76ers', team2Seed: 5, winner: '76ers', winnerSeed: 5, numGames: 6, conference: 'East' },
    { team1: 'Thunder', team1Seed: 1, team2: 'Lakers', team2Seed: 8, winner: 'Thunder', winnerSeed: 1, numGames: 5, conference: 'West' },
    { team1: 'Nuggets', team1Seed: 2, team2: 'Suns', team2Seed: 7, winner: 'Nuggets', winnerSeed: 2, numGames: 6, conference: 'West' },
    { team1: 'Timberwolves', team1Seed: 3, team2: 'Pelicans', team2Seed: 6, winner: 'Timberwolves', winnerSeed: 3, numGames: 7, conference: 'West' },
    { team1: 'Clippers', team1Seed: 4, team2: 'Mavericks', team2Seed: 5, winner: 'Mavericks', winnerSeed: 5, numGames: 7, conference: 'West' }
  ],
  [ROUND_KEYS.CONF_SEMIS]: [
    { team1: 'Celtics', team1Seed: 1, team2: 'Knicks', team2Seed: 2, winner: 'Celtics', winnerSeed: 1, numGames: 6, conference: 'East' },
    { team1: 'Bucks', team1Seed: 3, team2: '76ers', team2Seed: 5, winner: '76ers', winnerSeed: 5, numGames: 7, conference: 'East' },
    { team1: 'Thunder', team1Seed: 1, team2: 'Nuggets', team2Seed: 2, winner: 'Thunder', winnerSeed: 1, numGames: 7, conference: 'West' },
    { team1: 'Timberwolves', team1Seed: 3, team2: 'Mavericks', team2Seed: 5, winner: 'Timberwolves', winnerSeed: 3, numGames: 6, conference: 'West' }
  ],
  [ROUND_KEYS.CONF_FINALS]: [
    { team1: 'Celtics', team1Seed: 1, team2: '76ers', team2Seed: 5, winner: 'Celtics', winnerSeed: 1, numGames: 5, conference: 'East' },
    { team1: 'Thunder', team1Seed: 1, team2: 'Timberwolves', team2Seed: 3, winner: 'Thunder', winnerSeed: 1, numGames: 6, conference: 'West' }
  ],
  [ROUND_KEYS.NBA_FINALS]: {
    team1: 'Celtics',
    team1Seed: 1,
    team2: 'Thunder',
    team2Seed: 1,
    winner: 'Celtics',
    winnerSeed: 1,
    numGames: 6,
    predictedMVP: 'Jayson Tatum'
  },
  [ROUND_KEYS.CHAMPION]: 'Celtics',
  ChampionSeed: 1,
  [ROUND_KEYS.FINALS_MVP]: 'Jayson Tatum'
});

const buildOfficialBracket = () => ({
  ...buildStandardBracket(),
  [ROUND_KEYS.FIRST_ROUND]: [
    { team1: 'Celtics', team1Seed: 1, team2: 'Heat', team2Seed: 8, winner: 'Celtics', winnerSeed: 1, numGames: 5, conference: 'East' },
    { team1: 'Knicks', team1Seed: 2, team2: 'Pacers', team2Seed: 7, winner: 'Pacers', winnerSeed: 7, numGames: 7, conference: 'East' },
    { team1: 'Bucks', team1Seed: 3, team2: 'Magic', team2Seed: 6, winner: 'Bucks', winnerSeed: 3, numGames: 7, conference: 'East' },
    { team1: 'Cavaliers', team1Seed: 4, team2: '76ers', team2Seed: 5, winner: '76ers', winnerSeed: 5, numGames: 6, conference: 'East' },
    { team1: 'Thunder', team1Seed: 1, team2: 'Lakers', team2Seed: 8, winner: 'Thunder', winnerSeed: 1, numGames: 5, conference: 'West' },
    { team1: 'Nuggets', team1Seed: 2, team2: 'Suns', team2Seed: 7, winner: 'Nuggets', winnerSeed: 2, numGames: 6, conference: 'West' },
    { team1: 'Timberwolves', team1Seed: 3, team2: 'Pelicans', team2Seed: 6, winner: 'Timberwolves', winnerSeed: 3, numGames: 7, conference: 'West' },
    { team1: 'Clippers', team1Seed: 4, team2: 'Mavericks', team2Seed: 5, winner: 'Mavericks', winnerSeed: 5, numGames: 6, conference: 'West' }
  ],
  [ROUND_KEYS.CONF_SEMIS]: [
    { team1: 'Celtics', team1Seed: 1, team2: 'Pacers', team2Seed: 7, winner: 'Celtics', winnerSeed: 1, numGames: 5, conference: 'East' },
    { team1: 'Bucks', team1Seed: 3, team2: '76ers', team2Seed: 5, winner: '76ers', winnerSeed: 5, numGames: 7, conference: 'East' },
    { team1: 'Thunder', team1Seed: 1, team2: 'Nuggets', team2Seed: 2, winner: 'Nuggets', winnerSeed: 2, numGames: 7, conference: 'West' },
    { team1: 'Timberwolves', team1Seed: 3, team2: 'Mavericks', team2Seed: 5, winner: 'Timberwolves', winnerSeed: 3, numGames: 6, conference: 'West' }
  ],
  [ROUND_KEYS.CONF_FINALS]: [
    { team1: 'Celtics', team1Seed: 1, team2: '76ers', team2Seed: 5, winner: 'Celtics', winnerSeed: 1, numGames: 5, conference: 'East' },
    { team1: 'Nuggets', team1Seed: 2, team2: 'Timberwolves', team2Seed: 3, winner: 'Nuggets', winnerSeed: 2, numGames: 6, conference: 'West' }
  ],
  [ROUND_KEYS.NBA_FINALS]: {
    team1: 'Celtics',
    team1Seed: 1,
    team2: 'Nuggets',
    team2Seed: 2,
    winner: 'Celtics',
    winnerSeed: 1,
    numGames: 6,
    predictedMVP: 'Jaylen Brown'
  },
  [ROUND_KEYS.CHAMPION]: 'Celtics',
  ChampionSeed: 1,
  [ROUND_KEYS.FINALS_MVP]: 'Jaylen Brown'
});

const buildLongNamesBracket = () => ({
  [ROUND_KEYS.FIRST_ROUND]: [
    { team1: 'Massachusetts Bay Celtics Basketball Club', team1Seed: 1, team2: 'South Beach Heat Collective', team2Seed: 8, winner: 'Massachusetts Bay Celtics Basketball Club', winnerSeed: 1, numGames: 5, conference: 'East' },
    { team1: 'New York Knicks Metropolitan Division', team1Seed: 2, team2: 'Indiana Pacers Transition Offense Unit', team2Seed: 7, winner: 'New York Knicks Metropolitan Division', winnerSeed: 2, numGames: 6, conference: 'East' },
    { team1: 'Milwaukee Bucks Championship Group', team1Seed: 3, team2: 'Orlando Magic Young Core Project', team2Seed: 6, winner: 'Milwaukee Bucks Championship Group', winnerSeed: 3, numGames: 7, conference: 'East' },
    { team1: 'Cleveland Cavaliers Lake Erie Branch', team1Seed: 4, team2: 'Philadelphia 76ers Process Continuation', team2Seed: 5, winner: 'Philadelphia 76ers Process Continuation', winnerSeed: 5, numGames: 6, conference: 'East' },
    { team1: 'Oklahoma City Thunder Performance Lab', team1Seed: 1, team2: 'Los Angeles Lakers Legacy Program', team2Seed: 8, winner: 'Oklahoma City Thunder Performance Lab', winnerSeed: 1, numGames: 5, conference: 'West' },
    { team1: 'Denver Nuggets High Altitude Group', team1Seed: 2, team2: 'Phoenix Suns Shotmaking Department', team2Seed: 7, winner: 'Denver Nuggets High Altitude Group', winnerSeed: 2, numGames: 6, conference: 'West' },
    { team1: 'Minnesota Timberwolves Defensive Machine', team1Seed: 3, team2: 'New Orleans Pelicans Flight Crew', team2Seed: 6, winner: 'Minnesota Timberwolves Defensive Machine', winnerSeed: 3, numGames: 7, conference: 'West' },
    { team1: 'Los Angeles Clippers Veteran Rotation', team1Seed: 4, team2: 'Dallas Mavericks Helio Offense', team2Seed: 5, winner: 'Dallas Mavericks Helio Offense', winnerSeed: 5, numGames: 7, conference: 'West' }
  ],
  [ROUND_KEYS.CONF_SEMIS]: [
    { team1: 'Massachusetts Bay Celtics Basketball Club', team1Seed: 1, team2: 'New York Knicks Metropolitan Division', team2Seed: 2, winner: 'Massachusetts Bay Celtics Basketball Club', winnerSeed: 1, numGames: 6, conference: 'East' },
    { team1: 'Milwaukee Bucks Championship Group', team1Seed: 3, team2: 'Philadelphia 76ers Process Continuation', team2Seed: 5, winner: 'Philadelphia 76ers Process Continuation', winnerSeed: 5, numGames: 7, conference: 'East' },
    { team1: 'Oklahoma City Thunder Performance Lab', team1Seed: 1, team2: 'Denver Nuggets High Altitude Group', team2Seed: 2, winner: 'Oklahoma City Thunder Performance Lab', winnerSeed: 1, numGames: 7, conference: 'West' },
    { team1: 'Minnesota Timberwolves Defensive Machine', team1Seed: 3, team2: 'Dallas Mavericks Helio Offense', team2Seed: 5, winner: 'Minnesota Timberwolves Defensive Machine', winnerSeed: 3, numGames: 6, conference: 'West' }
  ],
  [ROUND_KEYS.CONF_FINALS]: [
    { team1: 'Massachusetts Bay Celtics Basketball Club', team1Seed: 1, team2: 'Philadelphia 76ers Process Continuation', team2Seed: 5, winner: 'Massachusetts Bay Celtics Basketball Club', winnerSeed: 1, numGames: 5, conference: 'East' },
    { team1: 'Oklahoma City Thunder Performance Lab', team1Seed: 1, team2: 'Minnesota Timberwolves Defensive Machine', team2Seed: 3, winner: 'Oklahoma City Thunder Performance Lab', winnerSeed: 1, numGames: 6, conference: 'West' }
  ],
  [ROUND_KEYS.NBA_FINALS]: {
    team1: 'Massachusetts Bay Celtics Basketball Club',
    team1Seed: 1,
    team2: 'Oklahoma City Thunder Performance Lab',
    team2Seed: 1,
    winner: 'Massachusetts Bay Celtics Basketball Club',
    winnerSeed: 1,
    numGames: 6,
    predictedMVP: 'Jayson Tatum'
  },
  [ROUND_KEYS.CHAMPION]: 'Massachusetts Bay Celtics Basketball Club',
  ChampionSeed: 1,
  [ROUND_KEYS.FINALS_MVP]: 'Jayson Tatum'
});

const standardTeamPlayers = {
  Celtics: ['Jayson Tatum', 'Jaylen Brown', 'Jrue Holiday'],
  Thunder: ['Shai Gilgeous-Alexander', 'Jalen Williams', 'Chet Holmgren'],
  Nuggets: ['Nikola Jokic', 'Jamal Murray', 'Aaron Gordon'],
  'Massachusetts Bay Celtics Basketball Club': ['Jayson Tatum', 'Jaylen Brown', 'Derrick White'],
  'Oklahoma City Thunder Performance Lab': ['Shai Gilgeous-Alexander', 'Jalen Williams', 'Chet Holmgren']
};

const scenarioMap = {
  default: {
    title: 'Default Bracket',
    description: 'Baseline desktop and mobile coverage for the new bracket canvas.',
    bracketData: buildStandardBracket(),
    isLocked: false,
    officialBracket: null
  },
  locked: {
    title: 'Locked And Scored',
    description: 'Completed bracket with official results to catch scoring badge regressions.',
    bracketData: buildStandardBracket(),
    isLocked: true,
    officialBracket: buildOfficialBracket(),
    officialMVP: 'Jaylen Brown'
  },
  'long-names': {
    title: 'Long Team Names',
    description: 'Stress case for text truncation, wrapping pressure, and matchup card density.',
    bracketData: buildLongNamesBracket(),
    isLocked: false,
    officialBracket: null
  }
};

const scenarioLinks = Object.keys(scenarioMap);

const VisualChrome = ({ currentScenario, title, description, children }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0_55%,_#cbd5e1)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Visual Regression Harness
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">NBA Playoffs Bracket Visual Harness</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {scenarioLinks.map((scenario) => (
              <Link
                key={scenario}
                to={`/__visual-tests/nba-playoffs-bracket/${scenario}`}
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

const noop = () => {};

const NBAPlayoffsBracketHarness = () => {
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
        <BracketEditor
          bracketData={config.bracketData}
          officialBracket={config.officialBracket}
          isLocked={config.isLocked}
          onSeriesPrediction={noop}
          onMVPSelect={noop}
          teamPlayers={standardTeamPlayers}
          officialMVP={config.officialMVP || null}
          forceDesktopCanvas={exportMode}
          exportMode={exportMode}
        />
      </div>
    </VisualChrome>
  );
};

export default NBAPlayoffsBracketHarness;
