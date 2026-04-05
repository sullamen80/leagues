import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FIFA_TEAM_LOOKUP } from '../constants/fifaTeams';

export const WORLD_CUP_GAME_TYPE_ID = 'worldCup';

export const GROUP_STAGE_LOCK_KEY = 'groups';
export const KNOCKOUT_STAGE_LOCK_KEY = 'knockout';

export const KNOCKOUT_ROUNDS = Object.freeze([
  { key: 'roundOf32', label: 'Round of 32', matchCount: 16, pointKey: 'roundOf32Points' },
  { key: 'roundOf16', label: 'Round of 16', matchCount: 8, pointKey: 'roundOf16Points' },
  { key: 'quarterfinals', label: 'Quarterfinals', matchCount: 4, pointKey: 'quarterfinalPoints' },
  { key: 'semifinals', label: 'Semifinals', matchCount: 2, pointKey: 'semifinalPoints' },
  { key: 'thirdPlace', label: 'Third Place Match', matchCount: 1, pointKey: 'thirdPlacePoints' },
  { key: 'final', label: 'Final', matchCount: 1, pointKey: 'finalPoints' }
]);

const createTeam = (id, name, shortName = null) => ({
  id,
  name,
  shortName: shortName || name
});

export const DEFAULT_WORLD_CUP_2026_GROUPS = Object.freeze([
  {
    id: 'A',
    name: 'Group A',
    teams: [
      createTeam('mexico', 'Mexico'),
      createTeam('south-korea', 'South Korea'),
      createTeam('south-africa', 'South Africa'),
      createTeam('czechia', 'Czechia')
    ]
  },
  {
    id: 'B',
    name: 'Group B',
    teams: [
      createTeam('canada', 'Canada'),
      createTeam('switzerland', 'Switzerland'),
      createTeam('qatar', 'Qatar'),
      createTeam('bosnia-herzegovina', 'Bosnia and Herzegovina')
    ]
  },
  {
    id: 'C',
    name: 'Group C',
    teams: [
      createTeam('brazil', 'Brazil'),
      createTeam('morocco', 'Morocco'),
      createTeam('scotland', 'Scotland'),
      createTeam('haiti', 'Haiti')
    ]
  },
  {
    id: 'D',
    name: 'Group D',
    teams: [
      createTeam('united-states', 'United States', 'USA'),
      createTeam('australia', 'Australia'),
      createTeam('paraguay', 'Paraguay'),
      createTeam('turkiye', 'Turkiye')
    ]
  },
  {
    id: 'E',
    name: 'Group E',
    teams: [
      createTeam('germany', 'Germany'),
      createTeam('ecuador', 'Ecuador'),
      createTeam('ivory-coast', 'Ivory Coast'),
      createTeam('curacao', 'Curacao')
    ]
  },
  {
    id: 'F',
    name: 'Group F',
    teams: [
      createTeam('netherlands', 'Netherlands'),
      createTeam('japan', 'Japan'),
      createTeam('tunisia', 'Tunisia'),
      createTeam('sweden', 'Sweden')
    ]
  },
  {
    id: 'G',
    name: 'Group G',
    teams: [
      createTeam('belgium', 'Belgium'),
      createTeam('iran', 'Iran'),
      createTeam('egypt', 'Egypt'),
      createTeam('new-zealand', 'New Zealand')
    ]
  },
  {
    id: 'H',
    name: 'Group H',
    teams: [
      createTeam('spain', 'Spain'),
      createTeam('uruguay', 'Uruguay'),
      createTeam('saudi-arabia', 'Saudi Arabia'),
      createTeam('cape-verde', 'Cape Verde')
    ]
  },
  {
    id: 'I',
    name: 'Group I',
    teams: [
      createTeam('france', 'France'),
      createTeam('senegal', 'Senegal'),
      createTeam('norway', 'Norway'),
      createTeam('iraq', 'Iraq')
    ]
  },
  {
    id: 'J',
    name: 'Group J',
    teams: [
      createTeam('argentina', 'Argentina'),
      createTeam('austria', 'Austria'),
      createTeam('algeria', 'Algeria'),
      createTeam('jordan', 'Jordan')
    ]
  },
  {
    id: 'K',
    name: 'Group K',
    teams: [
      createTeam('portugal', 'Portugal'),
      createTeam('colombia', 'Colombia'),
      createTeam('uzbekistan', 'Uzbekistan'),
      createTeam('congo-dr', 'Congo DR')
    ]
  },
  {
    id: 'L',
    name: 'Group L',
    teams: [
      createTeam('england', 'England'),
      createTeam('croatia', 'Croatia'),
      createTeam('panama', 'Panama'),
      createTeam('ghana', 'Ghana')
    ]
  }
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

const createEmptyMatch = (id, label) => ({
  id,
  label,
  homeTeamId: null,
  awayTeamId: null,
  winnerTeamId: null,
  homeScore: '',
  awayScore: ''
});

const createRound = (prefix, count, startNumber = 1) =>
  Array.from({ length: count }, (_, index) => createEmptyMatch(`${prefix}-${index + 1}`, `Match ${startNumber + index}`));

export const createEmptyKnockoutRounds = () => ({
  roundOf32: createRound('r32', 16, 73),
  roundOf16: createRound('r16', 8, 89),
  quarterfinals: createRound('qf', 4, 97),
  semifinals: createRound('sf', 2, 101),
  thirdPlace: [createEmptyMatch('third-place-1', 'Third Place Match')],
  final: [createEmptyMatch('final-1', 'Final')]
});

export const createDefaultScoringSettings = () => ({
  groupFirstPlacePoints: 2,
  groupSecondPlacePoints: 1,
  groupPerfectOrderBonus: 1,
  roundOf32Points: 1,
  roundOf16Points: 2,
  quarterfinalPoints: 4,
  semifinalPoints: 6,
  thirdPlacePoints: 2,
  finalPoints: 8,
  exactScoreBonus: 1,
  enableExactScoreBonus: true,
  scoreThirdPlaceMatch: false
});

export const createDefaultLocks = () => ({
  [GROUP_STAGE_LOCK_KEY]: { locked: false, lockedAt: null },
  [KNOCKOUT_STAGE_LOCK_KEY]: { locked: true, lockedAt: null }
});

export const getPreferredStageTab = (gameData, locks = {}) => {
  const groupsLocked = Boolean(locks?.[GROUP_STAGE_LOCK_KEY]?.locked);
  const knockoutLocked = Boolean(locks?.[KNOCKOUT_STAGE_LOCK_KEY]?.locked);

  if (!groupsLocked) {
    return 'groups';
  }

  if (!knockoutLocked) {
    return 'knockout';
  }

  return 'groups';
};

const normalizeStoredMatch = (match = {}, fallback = {}) => ({
  id: match.id || fallback.id,
  label: match.label || fallback.label || '',
  homeTeamId: match.homeTeamId ?? fallback.homeTeamId ?? null,
  awayTeamId: match.awayTeamId ?? fallback.awayTeamId ?? null,
  winnerTeamId: match.winnerTeamId ?? fallback.winnerTeamId ?? null,
  homeScore: match.homeScore ?? fallback.homeScore ?? '',
  awayScore: match.awayScore ?? fallback.awayScore ?? ''
});

export const normalizeGroups = (groups = DEFAULT_WORLD_CUP_2026_GROUPS) =>
  clone(groups).map((group) => ({
    id: group.id,
    name: group.name || `Group ${group.id}`,
    teams: Array.isArray(group.teams)
      ? group.teams.map((team) => {
        const catalogTeam = FIFA_TEAM_LOOKUP[team?.id] || null;
        return {
          ...team,
          shortName: team?.shortName || catalogTeam?.shortName || team?.name || '',
          iconCode: team?.iconCode || catalogTeam?.iconCode || ''
        };
      })
      : [],
    officialOrder: Array.isArray(group.officialOrder) ? [...group.officialOrder] : []
  }));

export const normalizeKnockoutRounds = (rounds = {}) => {
  const defaults = createEmptyKnockoutRounds();

  return {
    roundOf32: defaults.roundOf32.map((match, index) => normalizeStoredMatch(rounds?.roundOf32?.[index], match)),
    roundOf16: defaults.roundOf16.map((match, index) => normalizeStoredMatch(rounds?.roundOf16?.[index], match)),
    quarterfinals: defaults.quarterfinals.map((match, index) => normalizeStoredMatch(rounds?.quarterfinals?.[index], match)),
    semifinals: defaults.semifinals.map((match, index) => normalizeStoredMatch(rounds?.semifinals?.[index], match)),
    thirdPlace: defaults.thirdPlace.map((match, index) => normalizeStoredMatch(rounds?.thirdPlace?.[index], match)),
    final: defaults.final.map((match, index) => normalizeStoredMatch(rounds?.final?.[index], match))
  };
};

export const createDefaultGameData = (options = {}) => {
  const groups = normalizeGroups(options.groups || DEFAULT_WORLD_CUP_2026_GROUPS);

  return {
    gameTypeId: WORLD_CUP_GAME_TYPE_ID,
    edition: Number(options.edition || 2026),
    hostCountries: ['Canada', 'Mexico', 'United States'],
    status: 'groups',
    groups,
    qualifiedThirdPlaceTeamIds: [],
    knockoutEnabled: false,
    knockoutRounds: normalizeKnockoutRounds(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const buildTeamLookup = (groups = []) =>
  normalizeGroups(groups).reduce((acc, group) => {
    group.teams.forEach((team) => {
      acc[team.id] = {
        ...team,
        groupId: group.id
      };
    });
    return acc;
  }, {});

export const getTeamName = (teamId, groups = []) => {
  if (!teamId) {
    return 'TBD';
  }

  const teamLookup = buildTeamLookup(groups);
  return teamLookup[teamId]?.name || teamId;
};

export const normalizeOrderForGroup = (order = [], group = {}, options = {}) => {
  const { fillRemaining = false } = options;
  const validIds = new Set((group.teams || []).map((team) => team.id));
  const nextOrder = Array.from({ length: group.teams?.length || 4 }, () => '');
  const selectedIds = new Set();

  order.forEach((teamId, index) => {
    if (index >= nextOrder.length) {
      return;
    }

    if (validIds.has(teamId) && !selectedIds.has(teamId)) {
      nextOrder[index] = teamId;
      selectedIds.add(teamId);
    }
  });

  if (fillRemaining) {
    const remainingTeams = (group.teams || [])
      .map((team) => team.id)
      .filter((teamId) => !selectedIds.has(teamId));

    nextOrder.forEach((teamId, index) => {
      if (!teamId && remainingTeams.length) {
        nextOrder[index] = remainingTeams.shift();
      }
    });
  }

  return nextOrder;
};

export const autoFillFinalGroupSlot = (order = [], group = {}) => {
  const normalizedOrder = normalizeOrderForGroup(order, group);
  const totalSlots = normalizedOrder.length;

  if (totalSlots < 2) {
    return normalizedOrder;
  }

  const finalSlotIndex = totalSlots - 1;
  const leadingSlotsFilled = normalizedOrder.slice(0, finalSlotIndex).every(Boolean);
  const finalSlotEmpty = !normalizedOrder[finalSlotIndex];

  if (!leadingSlotsFilled || !finalSlotEmpty) {
    return normalizedOrder;
  }

  return normalizeOrderForGroup(normalizedOrder, group, { fillRemaining: true });
};

export const getOfficialGroupOrder = (group = {}) => normalizeOrderForGroup(group.officialOrder || [], group);

export const getQualifiedTeamIds = (gameData = {}) => {
  const groups = normalizeGroups(gameData.groups || []);
  const topTwo = groups.flatMap((group) => getOfficialGroupOrder(group).slice(0, 2)).filter(Boolean);
  const qualifiedThirds = Array.isArray(gameData.qualifiedThirdPlaceTeamIds)
    ? gameData.qualifiedThirdPlaceTeamIds.filter(Boolean)
    : [];

  return [...new Set([...topTwo, ...qualifiedThirds])];
};

export const getQualifiedTeams = (gameData = {}) => {
  const groups = normalizeGroups(gameData.groups || []);
  const teamLookup = buildTeamLookup(groups);

  return getQualifiedTeamIds(gameData)
    .map((teamId) => teamLookup[teamId])
    .filter(Boolean);
};

const getMatchWinner = (match = {}) => match.winnerTeamId || null;

const getMatchLoser = (match = {}) => {
  if (!match.winnerTeamId || !match.homeTeamId || !match.awayTeamId) {
    return null;
  }

  if (match.winnerTeamId === match.homeTeamId) {
    return match.awayTeamId;
  }

  if (match.winnerTeamId === match.awayTeamId) {
    return match.homeTeamId;
  }

  return null;
};

const attachTeamNames = (match = {}, groups = []) => ({
  ...match,
  homeTeamName: getTeamName(match.homeTeamId, groups),
  awayTeamName: getTeamName(match.awayTeamId, groups),
  winnerTeamName: getTeamName(match.winnerTeamId, groups)
});

export const deriveKnockoutBracket = (rounds = {}, groups = []) => {
  const normalizedRounds = normalizeKnockoutRounds(rounds);
  const nextRounds = {
    roundOf32: normalizedRounds.roundOf32.map((match) => attachTeamNames(match, groups)),
    roundOf16: [],
    quarterfinals: [],
    semifinals: [],
    thirdPlace: [],
    final: []
  };

  nextRounds.roundOf16 = normalizedRounds.roundOf16.map((storedMatch, index) => {
    const sourceA = nextRounds.roundOf32[index * 2];
    const sourceB = nextRounds.roundOf32[index * 2 + 1];

    return attachTeamNames(
      normalizeStoredMatch(
        {
          ...storedMatch,
          homeTeamId: getMatchWinner(sourceA),
          awayTeamId: getMatchWinner(sourceB)
        },
        storedMatch
      ),
      groups
    );
  });

  nextRounds.quarterfinals = normalizedRounds.quarterfinals.map((storedMatch, index) => {
    const sourceA = nextRounds.roundOf16[index * 2];
    const sourceB = nextRounds.roundOf16[index * 2 + 1];

    return attachTeamNames(
      normalizeStoredMatch(
        {
          ...storedMatch,
          homeTeamId: getMatchWinner(sourceA),
          awayTeamId: getMatchWinner(sourceB)
        },
        storedMatch
      ),
      groups
    );
  });

  nextRounds.semifinals = normalizedRounds.semifinals.map((storedMatch, index) => {
    const sourceA = nextRounds.quarterfinals[index * 2];
    const sourceB = nextRounds.quarterfinals[index * 2 + 1];

    return attachTeamNames(
      normalizeStoredMatch(
        {
          ...storedMatch,
          homeTeamId: getMatchWinner(sourceA),
          awayTeamId: getMatchWinner(sourceB)
        },
        storedMatch
      ),
      groups
    );
  });

  nextRounds.thirdPlace = normalizedRounds.thirdPlace.map((storedMatch) => {
    const sourceA = nextRounds.semifinals[0];
    const sourceB = nextRounds.semifinals[1];

    return attachTeamNames(
      normalizeStoredMatch(
        {
          ...storedMatch,
          homeTeamId: getMatchLoser(sourceA),
          awayTeamId: getMatchLoser(sourceB)
        },
        storedMatch
      ),
      groups
    );
  });

  nextRounds.final = normalizedRounds.final.map((storedMatch) => {
    const sourceA = nextRounds.semifinals[0];
    const sourceB = nextRounds.semifinals[1];

    return attachTeamNames(
      normalizeStoredMatch(
        {
          ...storedMatch,
          homeTeamId: getMatchWinner(sourceA),
          awayTeamId: getMatchWinner(sourceB)
        },
        storedMatch
      ),
      groups
    );
  });

  return nextRounds;
};

export const buildUserKnockoutBracket = (gameData = {}, picks = {}) => {
  const officialRounds = normalizeKnockoutRounds(gameData.knockoutRounds || {});
  const normalizedPicks = normalizeKnockoutRounds(picks || {});

  const mergedRounds = {
    ...normalizedPicks,
    roundOf32: officialRounds.roundOf32.map((match, index) =>
      normalizeStoredMatch({ ...match, ...(normalizedPicks.roundOf32[index] || {}) }, match)
    )
  };

  return deriveKnockoutBracket(mergedRounds, gameData.groups || []);
};

export const sanitizeBracketForStorage = (rounds = {}) => {
  const normalized = normalizeKnockoutRounds(rounds);

  return Object.fromEntries(
    Object.entries(normalized).map(([roundKey, matches]) => [
      roundKey,
      matches.map((match) => ({
        id: match.id,
        label: match.label,
        homeTeamId: match.homeTeamId ?? null,
        awayTeamId: match.awayTeamId ?? null,
        winnerTeamId: match.winnerTeamId ?? null,
        homeScore: match.homeScore ?? '',
        awayScore: match.awayScore ?? ''
      }))
    ])
  );
};

export const createEmptyUserEntry = (gameData = {}, userInfo = {}) => ({
  userId: userInfo.uid || userInfo.id || '',
  userName: userInfo.displayName || userInfo.username || userInfo.email?.split('@')[0] || 'Unknown User',
  groupPicks: Object.fromEntries(
    normalizeGroups(gameData.groups || []).map((group) => [group.id, []])
  ),
  knockoutPicks: sanitizeBracketForStorage(createEmptyKnockoutRounds()),
  updatedAt: new Date().toISOString()
});

export const calculateGroupScore = (groupPicks = {}, gameData = {}, settings = {}) => {
  const groups = normalizeGroups(gameData.groups || []);
  const scoringSettings = {
    ...createDefaultScoringSettings(),
    ...(settings || {})
  };

  let points = 0;
  let possiblePoints = 0;
  let correctPicks = 0;
  let possiblePicks = 0;
  const breakdown = {};

  groups.forEach((group) => {
    const officialOrder = getOfficialGroupOrder(group);
    const predictedOrder = normalizeOrderForGroup(groupPicks[group.id] || [], group);
    const officialComplete = officialOrder.every(Boolean);
    const predictedComplete = predictedOrder.every(Boolean);

    const firstCorrect = predictedOrder[0] && predictedOrder[0] === officialOrder[0];
    const secondCorrect = predictedOrder[1] && predictedOrder[1] === officialOrder[1];
    const perfect = officialComplete && predictedComplete && predictedOrder.join('|') === officialOrder.join('|');

    const groupPoints =
      (firstCorrect ? Number(scoringSettings.groupFirstPlacePoints || 0) : 0) +
      (secondCorrect ? Number(scoringSettings.groupSecondPlacePoints || 0) : 0) +
      (perfect ? Number(scoringSettings.groupPerfectOrderBonus || 0) : 0);

    const groupPossible = officialComplete
      ? (
      Number(scoringSettings.groupFirstPlacePoints || 0) +
      Number(scoringSettings.groupSecondPlacePoints || 0) +
      Number(scoringSettings.groupPerfectOrderBonus || 0)
      )
      : 0;

    points += groupPoints;
    possiblePoints += groupPossible;
    correctPicks += (firstCorrect ? 1 : 0) + (secondCorrect ? 1 : 0);
    possiblePicks += officialComplete ? 2 : 0;

    breakdown[group.id] = {
      predictedOrder,
      officialOrder,
      firstCorrect,
      secondCorrect,
      perfect,
      points: groupPoints,
      possible: groupPossible
    };
  });

  return {
    points,
    possiblePoints,
    correctPicks,
    possiblePicks,
    breakdown
  };
};

export const calculateKnockoutScore = (knockoutPicks = {}, gameData = {}, settings = {}) => {
  const scoringSettings = {
    ...createDefaultScoringSettings(),
    ...(settings || {})
  };

  const officialBracket = deriveKnockoutBracket(gameData.knockoutRounds || {}, gameData.groups || []);
  const userBracket = buildUserKnockoutBracket(gameData, knockoutPicks);

  let points = 0;
  let bonusPoints = 0;
  let possiblePoints = 0;
  let correctPicks = 0;
  let possiblePicks = 0;
  const roundBreakdown = {};

  KNOCKOUT_ROUNDS.forEach((roundConfig) => {
    const officialMatches = officialBracket[roundConfig.key] || [];
    const userMatches = userBracket[roundConfig.key] || [];
    const pointValue = Number(scoringSettings[roundConfig.pointKey] || 0);
    const roundState = {
      correct: 0,
      basePoints: 0,
      exactScorePoints: 0,
      totalPoints: 0,
      possible: 0
    };

    if (roundConfig.key === 'thirdPlace' && !scoringSettings.scoreThirdPlaceMatch) {
      roundBreakdown[roundConfig.key] = roundState;
      return;
    }

    officialMatches.forEach((officialMatch, index) => {
      const userMatch = userMatches[index] || {};
      const hasUserScore =
        String(userMatch.homeScore ?? '') !== '' &&
        String(userMatch.awayScore ?? '') !== '';
      if (!officialMatch.winnerTeamId) {
        return;
      }

      roundState.possible += pointValue;
      possiblePoints += pointValue;
      possiblePicks += 1;

      if (hasUserScore && userMatch.winnerTeamId && userMatch.winnerTeamId === officialMatch.winnerTeamId) {
        roundState.correct += 1;
        roundState.basePoints += pointValue;
        correctPicks += 1;
        points += pointValue;
      }

      const exactScoreEnabled = Boolean(scoringSettings.enableExactScoreBonus);
      const exactScoreValue = Number(scoringSettings.exactScoreBonus || 0);
      const sameMatchup =
        userMatch.homeTeamId &&
        userMatch.awayTeamId &&
        userMatch.homeTeamId === officialMatch.homeTeamId &&
        userMatch.awayTeamId === officialMatch.awayTeamId;
      const exactScoreHit =
        exactScoreEnabled &&
        sameMatchup &&
        hasUserScore &&
        Number(userMatch.homeScore) === Number(officialMatch.homeScore) &&
        Number(userMatch.awayScore) === Number(officialMatch.awayScore);

      if (exactScoreHit) {
        roundState.exactScorePoints += exactScoreValue;
        bonusPoints += exactScoreValue;
      }
    });

    roundState.totalPoints = roundState.basePoints + roundState.exactScorePoints;
    roundBreakdown[roundConfig.key] = roundState;
  });

  return {
    points,
    bonusPoints,
    totalPoints: points + bonusPoints,
    possiblePoints,
    correctPicks,
    possiblePicks,
    roundBreakdown,
    officialBracket,
    userBracket
  };
};

export const calculateUserTotals = (userData = {}, gameData = {}, settings = {}) => {
  const groupResult = calculateGroupScore(userData.groupPicks || {}, gameData, settings);
  const knockoutResult = calculateKnockoutScore(userData.knockoutPicks || {}, gameData, settings);
  const totalPoints = groupResult.points + knockoutResult.totalPoints;
  const totalPossiblePoints = groupResult.possiblePoints + knockoutResult.possiblePoints;

  return {
    groupPoints: groupResult.points,
    knockoutPoints: knockoutResult.points,
    bonusPoints: knockoutResult.bonusPoints,
    totalPoints,
    totalPossiblePoints,
    correctPicks: groupResult.correctPicks + knockoutResult.correctPicks,
    possiblePicks: groupResult.possiblePicks + knockoutResult.possiblePicks,
    percentRight:
      groupResult.possiblePicks + knockoutResult.possiblePicks > 0
        ? ((groupResult.correctPicks + knockoutResult.correctPicks) / (groupResult.possiblePicks + knockoutResult.possiblePicks))
        : null,
    groupBreakdown: groupResult.breakdown,
    knockoutBreakdown: knockoutResult.roundBreakdown,
    correctKnockoutPicks: knockoutResult.correctPicks
  };
};

export const upsertUserEntry = async (leagueId, userId, gameData = {}, userInfo = {}, patch = {}) => {
  const userRef = doc(db, 'leagues', leagueId, 'userData', userId);
  const existingSnap = await getDoc(userRef);
  const baseData = existingSnap.exists()
    ? existingSnap.data()
    : createEmptyUserEntry(gameData, { ...userInfo, uid: userId });

  await setDoc(
    userRef,
    {
      ...baseData,
      ...patch,
      userId,
      userName:
        patch.userName ||
        baseData.userName ||
        userInfo.displayName ||
        userInfo.username ||
        userInfo.email?.split('@')[0] ||
        'Unknown User',
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
};

export const initializeWorldCupLeague = async (leagueId, setupData = {}) => {
  const worldCupSetup = setupData.worldCupSetup || {};
  const gameData = createDefaultGameData({
    edition: worldCupSetup.edition || 2026,
    groups: worldCupSetup.groups || DEFAULT_WORLD_CUP_2026_GROUPS
  });

  await setDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), gameData);
  await setDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring'), createDefaultScoringSettings());
  await setDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus'), createDefaultLocks());

  if (setupData.ownerId) {
    await upsertUserEntry(
      leagueId,
      setupData.ownerId,
      gameData,
      {
        displayName: setupData.ownerName,
        username: setupData.ownerName,
        email: setupData.ownerEmail
      }
    );
  }

  await updateDoc(doc(db, 'leagues', leagueId), {
    gameTypeId: WORLD_CUP_GAME_TYPE_ID,
    updatedAt: new Date().toISOString()
  });

  return { success: true };
};

export const fetchLeaderboardEntries = async (leagueId) => {
  const [gameDataSnap, scoringSnap, userSnap] = await Promise.all([
    getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current')),
    getDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring')),
    getDocs(collection(db, 'leagues', leagueId, 'userData'))
  ]);

  if (!gameDataSnap.exists()) {
    return {
      gameData: null,
      settings: createDefaultScoringSettings(),
      entries: []
    };
  }

  const gameData = gameDataSnap.data();
  const settings = scoringSnap.exists() ? scoringSnap.data() : createDefaultScoringSettings();
  const entries = userSnap.docs.map((entryDoc) => {
    const data = entryDoc.data();
    const totals = calculateUserTotals(data, gameData, settings);

    return {
      id: entryDoc.id,
      userId: entryDoc.id,
      userName: data.userName || 'Unknown User',
      ...totals
    };
  });

  entries.sort((left, right) => {
    if (right.totalPoints !== left.totalPoints) {
      return right.totalPoints - left.totalPoints;
    }

    if (right.knockoutPoints !== left.knockoutPoints) {
      return right.knockoutPoints - left.knockoutPoints;
    }

    return right.groupPoints - left.groupPoints;
  });

  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return {
    gameData,
    settings,
    entries
  };
};

export const determineWorldCupLeagueWinners = async (leagueId) => {
  const { entries } = await fetchLeaderboardEntries(leagueId);
  if (!entries.length) {
    return [];
  }

  const topScore = entries[0].totalPoints;
  return entries
    .filter((entry) => entry.totalPoints === topScore)
    .map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      score: entry.totalPoints
    }));
};
