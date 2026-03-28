import { ROUND_KEYS } from '../constants/playoffConstants';

export const formatTeamWithSeed = (teamName, seed) => {
  if (!teamName) return 'TBD';
  return seed ? `${teamName} (${seed})` : teamName;
};

export const stringsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
};

const resetMatchupProjection = (matchup = {}) => {
  if (!matchup) return;
  matchup.winner = '';
  matchup.winnerSeed = null;
  matchup.gamesPlayed = null;
  matchup.numGames = 1;
  matchup.team1Score = null;
  matchup.team2Score = null;
  matchup.spreadPick = null;
  matchup.overUnderPick = null;
  matchup.spreadLine = null;
  matchup.overUnderLine = null;
  if (Object.prototype.hasOwnProperty.call(matchup, 'predictedMVP')) {
    matchup.predictedMVP = '';
  }
};

const NFL_TEAMS = {
  afcConference: {
    east: [
      { id: 'BUF', name: 'Buffalo Bills', shortName: 'Bills', city: 'Buffalo', colors: ['#00338D', '#C60C30'] },
      { id: 'MIA', name: 'Miami Dolphins', shortName: 'Dolphins', city: 'Miami', colors: ['#008E97', '#F58220'] },
      { id: 'NE', name: 'New England Patriots', shortName: 'Patriots', city: 'New England', colors: ['#002244', '#C60C30'] },
      { id: 'NYJ', name: 'New York Jets', shortName: 'Jets', city: 'New York', colors: ['#125740', '#000000'] }
    ],
    north: [
      { id: 'BAL', name: 'Baltimore Ravens', shortName: 'Ravens', city: 'Baltimore', colors: ['#241773', '#9E7C0C'] },
      { id: 'CIN', name: 'Cincinnati Bengals', shortName: 'Bengals', city: 'Cincinnati', colors: ['#FB4F14', '#000000'] },
      { id: 'CLE', name: 'Cleveland Browns', shortName: 'Browns', city: 'Cleveland', colors: ['#311D00', '#FF3C00'] },
      { id: 'PIT', name: 'Pittsburgh Steelers', shortName: 'Steelers', city: 'Pittsburgh', colors: ['#FFB612', '#101820'] }
    ],
    south: [
      { id: 'HOU', name: 'Houston Texans', shortName: 'Texans', city: 'Houston', colors: ['#03202F', '#A71930'] },
      { id: 'IND', name: 'Indianapolis Colts', shortName: 'Colts', city: 'Indianapolis', colors: ['#003A70', '#FFFFFF'] },
      { id: 'JAX', name: 'Jacksonville Jaguars', shortName: 'Jaguars', city: 'Jacksonville', colors: ['#006778', '#D7A22A'] },
      { id: 'TEN', name: 'Tennessee Titans', shortName: 'Titans', city: 'Tennessee', colors: ['#4B92DB', '#C8102E'] }
    ],
    west: [
      { id: 'DEN', name: 'Denver Broncos', shortName: 'Broncos', city: 'Denver', colors: ['#FB4F14', '#002244'] },
      { id: 'KC', name: 'Kansas City Chiefs', shortName: 'Chiefs', city: 'Kansas City', colors: ['#E31837', '#FFB81C'] },
      { id: 'LV', name: 'Las Vegas Raiders', shortName: 'Raiders', city: 'Las Vegas', colors: ['#000000', '#A5ACAF'] },
      { id: 'LAC', name: 'Los Angeles Chargers', shortName: 'Chargers', city: 'Los Angeles', colors: ['#0073CF', '#FFC20E'] }
    ]
  },
  nfcConference: {
    east: [
      { id: 'DAL', name: 'Dallas Cowboys', shortName: 'Cowboys', city: 'Dallas', colors: ['#041E42', '#869397'] },
      { id: 'NYG', name: 'New York Giants', shortName: 'Giants', city: 'New York', colors: ['#0B2265', '#A71930'] },
      { id: 'PHI', name: 'Philadelphia Eagles', shortName: 'Eagles', city: 'Philadelphia', colors: ['#004C54', '#A5ACAF'] },
      { id: 'WAS', name: 'Washington Commanders', shortName: 'Commanders', city: 'Washington', colors: ['#5A1414', '#FFB612'] }
    ],
    north: [
      { id: 'CHI', name: 'Chicago Bears', shortName: 'Bears', city: 'Chicago', colors: ['#0B162A', '#C83803'] },
      { id: 'DET', name: 'Detroit Lions', shortName: 'Lions', city: 'Detroit', colors: ['#0076B6', '#B0B7BC'] },
      { id: 'GB', name: 'Green Bay Packers', shortName: 'Packers', city: 'Green Bay', colors: ['#203731', '#FFB612'] },
      { id: 'MIN', name: 'Minnesota Vikings', shortName: 'Vikings', city: 'Minnesota', colors: ['#4F2683', '#FFC62F'] }
    ],
    south: [
      { id: 'ATL', name: 'Atlanta Falcons', shortName: 'Falcons', city: 'Atlanta', colors: ['#A71930', '#000000'] },
      { id: 'CAR', name: 'Carolina Panthers', shortName: 'Panthers', city: 'Carolina', colors: ['#0085CA', '#101820'] },
      { id: 'NO', name: 'New Orleans Saints', shortName: 'Saints', city: 'New Orleans', colors: ['#D3BC8D', '#101820'] },
      { id: 'TB', name: 'Tampa Bay Buccaneers', shortName: 'Buccaneers', city: 'Tampa Bay', colors: ['#D50A0A', '#FF7900'] }
    ],
    west: [
      { id: 'ARI', name: 'Arizona Cardinals', shortName: 'Cardinals', city: 'Arizona', colors: ['#97233F', '#000000'] },
      { id: 'LAR', name: 'Los Angeles Rams', shortName: 'Rams', city: 'Los Angeles', colors: ['#003594', '#FFD100'] },
      { id: 'SF', name: 'San Francisco 49ers', shortName: '49ers', city: 'San Francisco', colors: ['#AA0000', '#B3995D'] },
      { id: 'SEA', name: 'Seattle Seahawks', shortName: 'Seahawks', city: 'Seattle', colors: ['#002244', '#69BE28'] }
    ]
  }
};

const createEmptyMatchup = (conference) => ({
  team1: '',
  team1Seed: null,
  team2: '',
  team2Seed: null,
  team1Score: null,
  team2Score: null,
  spreadLine: null,
  overUnderLine: null,
  spreadPick: null,
  overUnderPick: null,
  winner: '',
  winnerSeed: null,
  gamesPlayed: null,
  numGames: 1,
  conference
});

export const getDefaultGameData = () => {
  const data = {
    allTeams: NFL_TEAMS,
    playoffTeams: {
      afcConference: Array(7).fill().map((_, i) => ({ seed: i + 1, teamId: null, name: '', eliminated: false })),
      nfcConference: Array(7).fill().map((_, i) => ({ seed: i + 1, teamId: null, name: '', eliminated: false }))
    },
    seasonYear: new Date().getFullYear()
  };

  data[ROUND_KEYS.FIRST_ROUND] = [
    createEmptyMatchup('AFC'),
    createEmptyMatchup('AFC'),
    createEmptyMatchup('AFC'),
    createEmptyMatchup('NFC'),
    createEmptyMatchup('NFC'),
    createEmptyMatchup('NFC')
  ];

  data[ROUND_KEYS.CONF_SEMIS] = [
    { ...createEmptyMatchup('AFC'), team1Seed: 1 },
    createEmptyMatchup('AFC'),
    { ...createEmptyMatchup('NFC'), team1Seed: 1 },
    createEmptyMatchup('NFC')
  ];

  data[ROUND_KEYS.CONF_FINALS] = [
    createEmptyMatchup('AFC'),
    createEmptyMatchup('NFC')
  ];

  data[ROUND_KEYS.SUPER_BOWL] = {
    team1: '',
    team1Seed: null,
    team1Conference: 'AFC',
    team2: '',
    team2Seed: null,
    team2Conference: 'NFC',
    team1Score: null,
    team2Score: null,
    spreadLine: null,
    overUnderLine: null,
    spreadPick: null,
    overUnderPick: null,
    winner: '',
    winnerSeed: null,
    winnerConference: '',
    gamesPlayed: null,
    numGames: 1,
    predictedMVP: ''
  };

  data[ROUND_KEYS.FINALS_MVP] = '';
  data[ROUND_KEYS.CHAMPION] = '';
  data.ChampionSeed = null;
  data.propBets = [];
  data.superWinnerPick = '';

  return data;
};

const CONFERENCE_PLAYOFF_KEYS = {
  AFC: 'afcConference',
  NFC: 'nfcConference'
};

const ROUND_LENGTHS = {
  [ROUND_KEYS.FIRST_ROUND]: 6,
  [ROUND_KEYS.CONF_SEMIS]: 4,
  [ROUND_KEYS.CONF_FINALS]: 2
};

const ensureMatchup = (matchup = {}, conference) => ({
  team1: '',
  team1Seed: null,
  team2: '',
  team2Seed: null,
  team1Score: null,
  team2Score: null,
  spreadLine: null,
  overUnderLine: null,
  spreadPick: null,
  overUnderPick: null,
  winner: '',
  winnerSeed: null,
  gamesPlayed: null,
  numGames: 1,
  conference,
  ...matchup
});

export const getTeamBySeed = (gameData, conference, seed) => {
  if (!gameData?.playoffTeams || !conference || !seed) return null;
  const key = CONFERENCE_PLAYOFF_KEYS[conference];
  if (!key) return null;
  return gameData.playoffTeams[key]?.find((team) => team.seed === seed) || null;
};

export const getConferenceForRoundIndex = (round, index) => {
  if (round === ROUND_KEYS.FIRST_ROUND) {
    return index < 3 ? 'AFC' : 'NFC';
  }
  if (round === ROUND_KEYS.CONF_SEMIS) {
    return index < 2 ? 'AFC' : 'NFC';
  }
  if (round === ROUND_KEYS.CONF_FINALS) {
    return index === 0 ? 'AFC' : 'NFC';
  }
  return 'AFC';
};

export const reseedDivisionalMatchups = (bracket, gameData) => {
  if (!bracket || !Array.isArray(bracket[ROUND_KEYS.FIRST_ROUND])) return;

  const wildCardRound = bracket[ROUND_KEYS.FIRST_ROUND];
  const divisionalRound = Array.isArray(bracket[ROUND_KEYS.CONF_SEMIS])
    ? [...bracket[ROUND_KEYS.CONF_SEMIS]]
    : [
        ensureMatchup(null, 'AFC'),
        ensureMatchup(null, 'AFC'),
        ensureMatchup(null, 'NFC'),
        ensureMatchup(null, 'NFC')
      ];

  ['AFC', 'NFC'].forEach((conference) => {
    const startIndex = conference === 'AFC' ? 0 : 2;
    const primary = ensureMatchup(divisionalRound[startIndex], conference);
    const secondary = ensureMatchup(divisionalRound[startIndex + 1], conference);

    const winners = wildCardRound
      .filter((matchup) => matchup?.conference === conference && matchup.winner)
      .map((matchup) => ({ name: matchup.winner, seed: matchup.winnerSeed }))
      .sort((a, b) => a.seed - b.seed);

    const lowestRemaining = winners.length ? winners[winners.length - 1] : null;
    const remaining = lowestRemaining ? winners.slice(0, winners.length - 1) : winners;

    const topSeedData = getTeamBySeed(gameData, conference, 1);
    if (topSeedData?.name) {
      primary.team1 = topSeedData.name;
      primary.team1Seed = 1;
    } else {
      primary.team1 = primary.team1 || '';
      primary.team1Seed = primary.team1Seed ?? 1;
    }

    const previousPrimaryOpponent = `${primary.team2}-${primary.team2Seed}`;
    if (lowestRemaining) {
      primary.team2 = lowestRemaining.name;
      primary.team2Seed = lowestRemaining.seed;
    } else {
      primary.team2 = '';
      primary.team2Seed = null;
    }

    if (previousPrimaryOpponent !== `${primary.team2}-${primary.team2Seed}`) {
      resetMatchupProjection(primary);
    }

    const previousSecondaryTeams = `${secondary.team1}-${secondary.team2}`;
    if (remaining.length >= 2) {
      secondary.team1 = remaining[0].name;
      secondary.team1Seed = remaining[0].seed;
      secondary.team2 = remaining[1].name;
      secondary.team2Seed = remaining[1].seed;
    } else if (remaining.length === 1) {
      secondary.team1 = remaining[0].name;
      secondary.team1Seed = remaining[0].seed;
      secondary.team2 = '';
      secondary.team2Seed = null;
    } else {
      secondary.team1 = '';
      secondary.team1Seed = null;
      secondary.team2 = '';
      secondary.team2Seed = null;
    }

    if (previousSecondaryTeams !== `${secondary.team1}-${secondary.team2}`) {
      resetMatchupProjection(secondary);
    }

    divisionalRound[startIndex] = primary;
    divisionalRound[startIndex + 1] = secondary;
  });

  bracket[ROUND_KEYS.CONF_SEMIS] = divisionalRound;
};

export const updateConferenceFinals = (bracket) => {
  if (!bracket || !Array.isArray(bracket[ROUND_KEYS.CONF_SEMIS])) return;

  const divisionalRound = bracket[ROUND_KEYS.CONF_SEMIS];
  const conferenceFinals = Array.isArray(bracket[ROUND_KEYS.CONF_FINALS])
    ? [...bracket[ROUND_KEYS.CONF_FINALS]]
    : [ensureMatchup(null, 'AFC'), ensureMatchup(null, 'NFC')];

  ['AFC', 'NFC'].forEach((conference, idx) => {
    const startIndex = conference === 'AFC' ? 0 : 2;
    const firstSemi = divisionalRound[startIndex];
    const secondSemi = divisionalRound[startIndex + 1];
    const currentFinal = ensureMatchup(conferenceFinals[idx], conference);
    const previousTeams = `${currentFinal.team1}-${currentFinal.team2}`;

    currentFinal.team1 = firstSemi?.winner || '';
    currentFinal.team1Seed = firstSemi?.winnerSeed ?? null;
    currentFinal.team2 = secondSemi?.winner || '';
    currentFinal.team2Seed = secondSemi?.winnerSeed ?? null;

    if (previousTeams !== `${currentFinal.team1}-${currentFinal.team2}`) {
      resetMatchupProjection(currentFinal);
    }

    conferenceFinals[idx] = currentFinal;
  });

  bracket[ROUND_KEYS.CONF_FINALS] = conferenceFinals;
};

export const updateSuperBowl = (bracket) => {
  if (!bracket || !Array.isArray(bracket[ROUND_KEYS.CONF_FINALS])) return;

  const conferenceFinals = bracket[ROUND_KEYS.CONF_FINALS];
  const currentSuperBowl = {
    team1: '',
    team1Seed: null,
    team1Conference: 'AFC',
    team2: '',
    team2Seed: null,
    team2Conference: 'NFC',
    winner: '',
    winnerSeed: null,
    winnerConference: '',
    gamesPlayed: null,
    numGames: 1,
    predictedMVP: '',
    ...(bracket[ROUND_KEYS.SUPER_BOWL] || {})
  };
  const previousTeams = `${currentSuperBowl.team1}-${currentSuperBowl.team2}`;

  const afcWinner = conferenceFinals[0];
  const nfcWinner = conferenceFinals[1];

  currentSuperBowl.team1 = afcWinner?.winner || '';
  currentSuperBowl.team1Seed = afcWinner?.winnerSeed ?? null;
  currentSuperBowl.team1Conference = 'AFC';

  currentSuperBowl.team2 = nfcWinner?.winner || '';
  currentSuperBowl.team2Seed = nfcWinner?.winnerSeed ?? null;
  currentSuperBowl.team2Conference = 'NFC';

  if (previousTeams !== `${currentSuperBowl.team1}-${currentSuperBowl.team2}`) {
    resetMatchupProjection(currentSuperBowl);
    currentSuperBowl.winnerConference = '';
    bracket[ROUND_KEYS.CHAMPION] = '';
    bracket.ChampionSeed = null;
  }

  bracket[ROUND_KEYS.SUPER_BOWL] = currentSuperBowl;
};

export const applyBracketAdvancement = (bracket, round, referenceData) => {
  if (!bracket) return;

  if (round === ROUND_KEYS.FIRST_ROUND) {
    reseedDivisionalMatchups(bracket, referenceData);
    updateConferenceFinals(bracket);
    updateSuperBowl(bracket);
  } else if (round === ROUND_KEYS.CONF_SEMIS) {
    updateConferenceFinals(bracket);
    updateSuperBowl(bracket);
  } else if (round === ROUND_KEYS.CONF_FINALS) {
    updateSuperBowl(bracket);
  } else if (round === ROUND_KEYS.SUPER_BOWL) {
    if (bracket[ROUND_KEYS.SUPER_BOWL]?.winner) {
      bracket[ROUND_KEYS.CHAMPION] = bracket[ROUND_KEYS.SUPER_BOWL].winner;
      bracket.ChampionSeed = bracket[ROUND_KEYS.SUPER_BOWL].winnerSeed ?? null;
    } else {
      bracket[ROUND_KEYS.CHAMPION] = '';
      bracket.ChampionSeed = null;
    }
  }
};

export const ensureRoundStructure = (data, roundKey) => {
  const expected = ROUND_LENGTHS[roundKey];
  if (!expected) return Array.isArray(data?.[roundKey]) ? data[roundKey] : [];

  const existing = Array.isArray(data?.[roundKey]) ? data[roundKey] : [];
  const padded = [...existing];

  while (padded.length < expected) {
    padded.push(ensureMatchup({}, getConferenceForRoundIndex(roundKey, padded.length)));
  }

  return padded.map((matchup, index) =>
    ensureMatchup(
      {
        ...matchup,
        conference: matchup.conference || getConferenceForRoundIndex(roundKey, index)
      },
      matchup.conference || getConferenceForRoundIndex(roundKey, index)
    )
  );
};

export const ensureSuperBowlStructure = (data) => ({
  team1: '',
  team1Seed: null,
  team1Conference: 'AFC',
  team2: '',
  team2Seed: null,
  team2Conference: 'NFC',
  team1Score: null,
  team2Score: null,
  spreadLine: null,
  overUnderLine: null,
  spreadPick: null,
  overUnderPick: null,
  winner: '',
  winnerSeed: null,
  winnerConference: '',
  gamesPlayed: null,
  numGames: 1,
  predictedMVP: '',
  ...(data?.[ROUND_KEYS.SUPER_BOWL] || {})
});

export default NFL_TEAMS;
