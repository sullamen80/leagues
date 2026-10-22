import {
  WIMBLEDON_DRAW_SIZE,
  WIMBLEDON_ROUNDS,
  WIMBLEDON_SCHEMA_VERSION
} from '../constants/wimbledonConstants';

export const cloneDrawValue = (value) => JSON.parse(JSON.stringify(value));

export const getSlotId = (position) => `slot-${position}`;
export const getMatchId = (roundKey, index) => `${roundKey}-${index + 1}`;

export const createEmptyEntrant = (position) => ({
  slotId: getSlotId(position),
  name: '',
  seed: null,
  countryCode: '',
  entryStatus: '',
  externalId: ''
});

export const createEmptyEntrantsBySlot = (drawSize = WIMBLEDON_DRAW_SIZE) =>
  Object.fromEntries(
    Array.from({ length: drawSize }, (_, index) => {
      const position = index + 1;
      const entrant = createEmptyEntrant(position);
      return [entrant.slotId, entrant];
    })
  );

export const createDrawMatches = (drawSize = WIMBLEDON_DRAW_SIZE) => {
  if (drawSize !== WIMBLEDON_DRAW_SIZE) {
    throw new Error('Wimbledon mode currently requires a 128-slot draw');
  }

  const matchesById = {};

  WIMBLEDON_ROUNDS.forEach((round, roundIndex) => {
    for (let matchIndex = 0; matchIndex < round.matchCount; matchIndex += 1) {
      const id = getMatchId(round.key, matchIndex);
      const isOpeningRound = roundIndex === 0;
      matchesById[id] = {
        id,
        roundKey: round.key,
        roundIndex,
        position: matchIndex,
        participantSlotIds: isOpeningRound
          ? [getSlotId(matchIndex * 2 + 1), getSlotId(matchIndex * 2 + 2)]
          : [null, null],
        feederMatchIds: isOpeningRound
          ? []
          : [
              getMatchId(WIMBLEDON_ROUNDS[roundIndex - 1].key, matchIndex * 2),
              getMatchId(WIMBLEDON_ROUNDS[roundIndex - 1].key, matchIndex * 2 + 1)
            ]
      };
    }
  });

  return matchesById;
};

export const createDefaultWimbledonGameData = (options = {}) => ({
  schemaVersion: WIMBLEDON_SCHEMA_VERSION,
  gameTypeId: 'wimbledon',
  edition: Number(options.edition || new Date().getFullYear()),
  eventLabel: String(options.eventLabel || 'Singles Championship').trim(),
  drawSize: WIMBLEDON_DRAW_SIZE,
  startRoundKey: 'roundOf128',
  startRoundSlotIds: null,
  maximumSets: Number(options.maximumSets) === 5 ? 5 : 3,
  setsRequiredToWin: Number(options.maximumSets) === 5 ? 3 : 2,
  drawRevision: 1,
  roundOrder: WIMBLEDON_ROUNDS.map((round) => round.key),
  entrantsBySlot: createEmptyEntrantsBySlot(),
  matchesById: createDrawMatches(),
  officialResultsByMatchId: {},
  status: 'setup',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const normalizeEntrant = (slotId, entrant = {}) => ({
  slotId,
  name: String(entrant.name || '').trim(),
  seed: entrant.seed === '' || entrant.seed === null || entrant.seed === undefined
    ? null
    : Number(entrant.seed),
  countryCode: String(entrant.countryCode || entrant.country || '').trim().toUpperCase(),
  entryStatus: String(entrant.entryStatus || entrant.status || '').trim().toUpperCase(),
  externalId: String(entrant.externalId || '').trim()
});

export const normalizeEntrantsBySlot = (entrantsBySlot = {}) => {
  const defaults = createEmptyEntrantsBySlot();
  return Object.fromEntries(
    Object.keys(defaults).map((slotId) => [
      slotId,
      normalizeEntrant(slotId, entrantsBySlot[slotId] || defaults[slotId])
    ])
  );
};

export const getRoundIndex = (roundKey) =>
  WIMBLEDON_ROUNDS.findIndex((round) => round.key === roundKey);

export const getActiveStartRoundKey = (gameData = {}) =>
  getRoundIndex(gameData.startRoundKey) >= 0 ? gameData.startRoundKey : WIMBLEDON_ROUNDS[0].key;

export const getActiveStartRoundIndex = (gameData = {}) =>
  Math.max(0, getRoundIndex(getActiveStartRoundKey(gameData)));

export const getActiveRounds = (gameData = {}) =>
  WIMBLEDON_ROUNDS.slice(getActiveStartRoundIndex(gameData));

export const getRequiredPredictionCount = (gameData = {}) =>
  getActiveRounds(gameData).reduce((total, round) => total + round.matchCount, 0);

const normalizePrediction = (prediction = {}) => {
  const completionReason = prediction.completionReason || 'completed';
  return {
    winnerSlotId: completionReason === 'suspended' ? null : prediction.winnerSlotId || null,
    winnerSets: prediction.winnerSets === '' || prediction.winnerSets === undefined
      ? null
      : Number(prediction.winnerSets),
    loserSets: prediction.loserSets === '' || prediction.loserSets === undefined
      ? null
      : Number(prediction.loserSets),
    completionReason
  };
};

const getDefaultStartRoundSlotIds = (roundKey) => {
  const round = WIMBLEDON_ROUNDS.find((candidate) => candidate.key === roundKey);
  if (!round) {
    return [];
  }

  return Array.from({ length: round.matchCount * 2 }, (_, index) => getSlotId(index + 1));
};

const getStartRoundSlotIds = (gameData = {}, roundKey) => {
  const configured = Array.isArray(gameData.startRoundSlotIds) ? gameData.startRoundSlotIds : [];
  const round = WIMBLEDON_ROUNDS.find((candidate) => candidate.key === roundKey);
  const requiredCount = Number(round?.matchCount || 0) * 2;

  if (
    getActiveStartRoundKey(gameData) === roundKey &&
    configured.length >= requiredCount &&
    configured.slice(0, requiredCount).every(Boolean)
  ) {
    return configured.slice(0, requiredCount);
  }

  return getDefaultStartRoundSlotIds(roundKey);
};

export const resolveDrawMatches = (gameData = {}, predictionsByMatchId = {}) => {
  const matchesById = gameData.matchesById || createDrawMatches();
  const resolved = {};
  const sanitizedPredictions = {};
  const activeStartRoundIndex = getActiveStartRoundIndex(gameData);
  const activeStartRoundKey = WIMBLEDON_ROUNDS[activeStartRoundIndex]?.key || WIMBLEDON_ROUNDS[0].key;
  const activeStartRoundSlotIds = getStartRoundSlotIds(gameData, activeStartRoundKey);

  WIMBLEDON_ROUNDS.forEach((round, roundIndex) => {
    for (let index = 0; index < round.matchCount; index += 1) {
      const id = getMatchId(round.key, index);
      const baseMatch = matchesById[id] || {};
      const participantSlotIds = roundIndex < activeStartRoundIndex
        ? [...(baseMatch.participantSlotIds || [null, null])]
        : roundIndex === activeStartRoundIndex
          ? [
              activeStartRoundSlotIds[index * 2] || null,
              activeStartRoundSlotIds[index * 2 + 1] || null
            ]
          : baseMatch.feederMatchIds?.map((feederId) => sanitizedPredictions[feederId]?.winnerSlotId || null) || [null, null];
      const prediction = normalizePrediction(predictionsByMatchId[id] || {});
      const activeRound = roundIndex >= activeStartRoundIndex;
      const winnerIsValid = activeRound && prediction.winnerSlotId && participantSlotIds.includes(prediction.winnerSlotId);
      const nextPrediction = winnerIsValid
        ? prediction
        : prediction.completionReason === 'suspended'
          ? prediction
          : { winnerSlotId: null, winnerSets: null, loserSets: null, completionReason: 'completed' };

      sanitizedPredictions[id] = nextPrediction;
      resolved[id] = {
        ...baseMatch,
        id,
        roundKey: round.key,
        position: index,
        participantSlotIds,
        prediction: nextPrediction
      };
    }
  });

  return { matchesById: resolved, predictionsByMatchId: sanitizedPredictions };
};

export const getStarterSlotIdsForRound = (gameData = {}, roundKey = 'roundOf32') => {
  const cleanGameData = {
    ...gameData,
    startRoundKey: 'roundOf128',
    startRoundSlotIds: null
  };
  const resolved = resolveDrawMatches(cleanGameData, gameData.officialResultsByMatchId || {});
  const round = WIMBLEDON_ROUNDS.find((candidate) => candidate.key === roundKey);
  const slotIds = Array.from({ length: Number(round?.matchCount || 0) }, (_, index) => (
    resolved.matchesById[getMatchId(roundKey, index)]?.participantSlotIds || []
  )).flat();

  return slotIds.length && slotIds.every(Boolean)
    ? slotIds
    : getDefaultStartRoundSlotIds(roundKey);
};

export const updateDrawPrediction = (gameData, predictionsByMatchId, matchId, patch) => {
  const next = {
    ...(predictionsByMatchId || {}),
    [matchId]: {
      ...(predictionsByMatchId?.[matchId] || {}),
      ...patch
    }
  };
  return resolveDrawMatches(gameData, next).predictionsByMatchId;
};

export const countCompletedPredictions = (predictionsByMatchId = {}) =>
  Object.values(predictionsByMatchId).filter((prediction) => prediction?.winnerSlotId).length;

export const getChampionSlotId = (predictionsByMatchId = {}) =>
  predictionsByMatchId[getMatchId('final', 0)]?.winnerSlotId || null;

export const getFinalistSlotIds = (gameData, predictionsByMatchId = {}) => {
  const resolved = resolveDrawMatches(gameData, predictionsByMatchId);
  return resolved.matchesById[getMatchId('final', 0)]?.participantSlotIds?.filter(Boolean) || [];
};

export const getSectionMatchIds = (sectionIndex) => {
  const normalizedSection = Math.max(0, Math.min(7, Number(sectionIndex) || 0));
  return {
    roundOf128: Array.from({ length: 8 }, (_, index) => getMatchId('roundOf128', normalizedSection * 8 + index)),
    roundOf64: Array.from({ length: 4 }, (_, index) => getMatchId('roundOf64', normalizedSection * 4 + index)),
    roundOf32: Array.from({ length: 2 }, (_, index) => getMatchId('roundOf32', normalizedSection * 2 + index)),
    roundOf16: [getMatchId('roundOf16', normalizedSection)]
  };
};

export const parseEntrantsImport = (content = '') => {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    throw new Error('Import content is empty');
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed)
      ? parsed
      : Object.entries(parsed.entrantsBySlot || parsed).map(([slotId, entrant]) => ({ slotId, ...entrant }));
    return rows.map((row, index) => ({
      slotId: row.slotId || getSlotId(Number(row.slot || row.position || index + 1)),
      ...row
    }));
  }

  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const nextCharacter = line[index + 1];

      if (character === '"' && inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = !inQuotes;
      } else if (character === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += character;
      }
    }

    values.push(current.trim());
    return values;
  };

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]).map((value) => value.replace(/^\uFEFF/, '').trim().toLowerCase());
  const indexOf = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0);
  const slotIndex = indexOf('slot', 'position', 'slotid');
  const nameIndex = indexOf('name', 'player');

  if (slotIndex === undefined || nameIndex === undefined) {
    throw new Error('CSV requires slot (or position) and name columns');
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const rawSlot = values[slotIndex];
    return {
      slotId: rawSlot.startsWith('slot-') ? rawSlot : getSlotId(Number(rawSlot)),
      name: values[nameIndex],
      seed: values[indexOf('seed')] || null,
      countryCode: values[indexOf('countrycode', 'country')] || '',
      entryStatus: values[indexOf('entrystatus', 'status')] || '',
      externalId: values[indexOf('externalid', 'id')] || ''
    };
  });
};

export const applyImportedEntrants = (currentEntrants, importedRows = []) => {
  const next = normalizeEntrantsBySlot(currentEntrants);
  importedRows.forEach((row) => {
    if (!next[row.slotId]) {
      throw new Error(`Invalid draw slot: ${row.slotId}`);
    }
    next[row.slotId] = normalizeEntrant(row.slotId, row);
  });
  return next;
};
