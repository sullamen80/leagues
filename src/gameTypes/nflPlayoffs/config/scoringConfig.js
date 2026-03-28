import {
  ROUND_KEYS,
  ROUND_DISPLAY_NAMES,
  DEFAULT_POINT_VALUES
} from '../constants/playoffConstants';

const ROUND_CONFIGS = [
  { key: ROUND_KEYS.FIRST_ROUND, label: ROUND_DISPLAY_NAMES[ROUND_KEYS.FIRST_ROUND], matchups: 6 },
  { key: ROUND_KEYS.CONF_SEMIS, label: ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_SEMIS], matchups: 4 },
  { key: ROUND_KEYS.CONF_FINALS, label: ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_FINALS], matchups: 2 },
  { key: ROUND_KEYS.SUPER_BOWL, label: ROUND_DISPLAY_NAMES[ROUND_KEYS.SUPER_BOWL], matchups: 1 }
];

const MVP_ROUND = {
  key: ROUND_KEYS.FINALS_MVP,
  label: ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]
};

const DEFAULT_SCORING_SETTINGS = (() => {
  const base = {
    upsetBonusEnabled: false,
    bonusPerSeedDifference: 1,
    spreadEnabledRounds: {},
    spreadPoints: {},
    overUnderEnabledRounds: {},
    overUnderPoints: {},
    scoreBonusEnabledRounds: {},
    scoreBonusPoints: {},
    scoreBonusTotalThreshold: 10,
    scoreBonusTeamThreshold: 7,
    perfectScoreEnabledRounds: {},
    perfectScorePoints: {},
    propBetDefaults: {
      maxWager: 3
    },
    propBetOverrides: {},
    propBetSelectionLimit: 0,
    superWinnerPoints: 0,
    [ROUND_KEYS.FINALS_MVP]: DEFAULT_POINT_VALUES[ROUND_KEYS.FINALS_MVP]
  };

  ROUND_CONFIGS.forEach(({ key }) => {
    base[key] = DEFAULT_POINT_VALUES[key];
    base.spreadPoints[key] = 0;
    base.overUnderPoints[key] = 0;
    base.scoreBonusPoints[key] = 0;
    base.perfectScorePoints[key] = 0;
  });

  return base;
})();

export const getRoundConfigs = () => [...ROUND_CONFIGS];

export const getDefaultScoringSettings = () => ({
  ...DEFAULT_SCORING_SETTINGS,
  spreadEnabledRounds: { ...DEFAULT_SCORING_SETTINGS.spreadEnabledRounds },
  spreadPoints: { ...DEFAULT_SCORING_SETTINGS.spreadPoints },
  overUnderEnabledRounds: { ...DEFAULT_SCORING_SETTINGS.overUnderEnabledRounds },
  overUnderPoints: { ...DEFAULT_SCORING_SETTINGS.overUnderPoints },
  scoreBonusEnabledRounds: { ...DEFAULT_SCORING_SETTINGS.scoreBonusEnabledRounds },
  scoreBonusPoints: { ...DEFAULT_SCORING_SETTINGS.scoreBonusPoints },
  perfectScoreEnabledRounds: { ...DEFAULT_SCORING_SETTINGS.perfectScoreEnabledRounds },
  perfectScorePoints: { ...DEFAULT_SCORING_SETTINGS.perfectScorePoints },
  propBetDefaults: { ...DEFAULT_SCORING_SETTINGS.propBetDefaults },
  propBetOverrides: JSON.parse(JSON.stringify(DEFAULT_SCORING_SETTINGS.propBetOverrides)),
  superWinnerPoints: DEFAULT_SCORING_SETTINGS.superWinnerPoints,
  propBetSelectionLimit: DEFAULT_SCORING_SETTINGS.propBetSelectionLimit
});

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const normalizeScoringSettings = (rawSettings = {}) => {
  const normalized = {
    ...getDefaultScoringSettings(),
    ...(rawSettings || {})
  };

  ROUND_CONFIGS.forEach(({ key }) => {
    normalized[key] = toNumber(rawSettings?.[key], DEFAULT_SCORING_SETTINGS[key]);
  });

  normalized[ROUND_KEYS.FINALS_MVP] = toNumber(
    rawSettings?.[ROUND_KEYS.FINALS_MVP],
    DEFAULT_SCORING_SETTINGS[ROUND_KEYS.FINALS_MVP]
  );

  normalized.upsetBonusEnabled = Boolean(
    rawSettings?.upsetBonusEnabled ?? DEFAULT_SCORING_SETTINGS.upsetBonusEnabled
  );
  const bonusPerSeed = rawSettings?.bonusPerSeedDifference ?? rawSettings?.upsetBonus;
  normalized.bonusPerSeedDifference = toNumber(
    bonusPerSeed,
    DEFAULT_SCORING_SETTINGS.bonusPerSeedDifference
  );

  const normalizeRoundFlags = (source = {}) =>
    ROUND_CONFIGS.reduce(
      (acc, { key }) => ({
        ...acc,
        [key]: Boolean(source?.[key])
      }),
      {}
    );

  normalized.spreadEnabledRounds = normalizeRoundFlags(rawSettings?.spreadEnabledRounds);
  normalized.overUnderEnabledRounds = normalizeRoundFlags(rawSettings?.overUnderEnabledRounds);
  const normalizeRoundValues = (sourceValues = {}, defaultValues = {}) => {
    const numericValue = typeof sourceValues === 'number' ? sourceValues : null;
    return ROUND_CONFIGS.reduce(
      (acc, { key }) => ({
        ...acc,
        [key]: toNumber(
          numericValue ?? sourceValues?.[key],
          defaultValues[key]
        )
      }),
      {}
    );
  };

  normalized.spreadPoints = normalizeRoundValues(
    rawSettings?.spreadPoints,
    DEFAULT_SCORING_SETTINGS.spreadPoints
  );
  normalized.overUnderPoints = normalizeRoundValues(
    rawSettings?.overUnderPoints,
    DEFAULT_SCORING_SETTINGS.overUnderPoints
  );
  normalized.scoreBonusEnabledRounds = normalizeRoundFlags(rawSettings?.scoreBonusEnabledRounds);
  normalized.scoreBonusPoints = normalizeRoundValues(
    rawSettings?.scoreBonusPoints,
    DEFAULT_SCORING_SETTINGS.scoreBonusPoints
  );
  normalized.scoreBonusTotalThreshold = toNumber(
    rawSettings?.scoreBonusTotalThreshold,
    DEFAULT_SCORING_SETTINGS.scoreBonusTotalThreshold
  );
  normalized.scoreBonusTeamThreshold = toNumber(
    rawSettings?.scoreBonusTeamThreshold,
    DEFAULT_SCORING_SETTINGS.scoreBonusTeamThreshold
  );
  normalized.perfectScoreEnabledRounds = normalizeRoundFlags(rawSettings?.perfectScoreEnabledRounds);
  normalized.perfectScorePoints = normalizeRoundValues(
    rawSettings?.perfectScorePoints,
    DEFAULT_SCORING_SETTINGS.perfectScorePoints
  );
  normalized.propBetDefaults = {
    maxWager: toNumber(
      rawSettings?.propBetDefaults?.maxWager,
      DEFAULT_SCORING_SETTINGS.propBetDefaults.maxWager
    )
  };
  normalized.propBetOverrides = Object.entries(rawSettings?.propBetOverrides || {}).reduce(
    (acc, [propId, values]) => ({
      ...acc,
      [propId]: {
        maxWager: toNumber(
          values?.maxWager,
          normalized.propBetDefaults.maxWager
        )
      }
    }),
    {}
  );
  normalized.propBetSelectionLimit = toNumber(
    rawSettings?.propBetSelectionLimit,
    DEFAULT_SCORING_SETTINGS.propBetSelectionLimit
  );
  normalized.superWinnerPoints = toNumber(
    rawSettings?.superWinnerPoints,
    DEFAULT_SCORING_SETTINGS.superWinnerPoints
  );

  return normalized;
};

export const getUIPointValues = (settings = null) => {
  const normalized = normalizeScoringSettings(settings);
  return ROUND_CONFIGS.reduce(
    (acc, { key }) => ({
      ...acc,
      [key]: normalized[key]
    }),
    {
      [ROUND_KEYS.FINALS_MVP]: normalized[ROUND_KEYS.FINALS_MVP]
    }
  );
};

export const describeScoringRules = (settings = null) => {
  const normalized = normalizeScoringSettings(settings);
  const lines = ROUND_CONFIGS.map(
    ({ key, label }) => `${label}: ${normalized[key]} pts`
  );
  lines.push(`${MVP_ROUND.label}: ${normalized[ROUND_KEYS.FINALS_MVP]} pts`);

  if (normalized.upsetBonusEnabled) {
    lines.push(
      `Upset bonus: +${normalized.bonusPerSeedDifference} per seed difference`
    );
  }

  const buildRoundBonusText = (enabledMap, valuesMap, descriptor) => {
    const items = ROUND_CONFIGS.filter(
      ({ key }) => enabledMap[key] && valuesMap[key] > 0
    ).map(({ key, label }) => `${label} (+${valuesMap[key]} pts)`);
    if (items.length) {
      lines.push(`${descriptor}: ${items.join(', ')}`);
    }
  };

  buildRoundBonusText(normalized.spreadEnabledRounds, normalized.spreadPoints, 'Spread picks');
  buildRoundBonusText(
    normalized.overUnderEnabledRounds,
    normalized.overUnderPoints,
    'Over/Under picks'
  );

  const scorePropsText = ROUND_CONFIGS.filter(
    ({ key }) => normalized.scoreBonusEnabledRounds[key] && normalized.scoreBonusPoints[key] > 0
  ).map(({ key, label }) => `${label} (+${normalized.scoreBonusPoints[key]} pts)`);
  if (scorePropsText.length) {
    lines.push(
      `Score accuracy (${scorePropsText.join(', ')}): within ${normalized.scoreBonusTotalThreshold} total / ${normalized.scoreBonusTeamThreshold} per team, closest split`
    );
  }

  const perfectPropsText = ROUND_CONFIGS.filter(
    ({ key }) => normalized.perfectScoreEnabledRounds[key] && normalized.perfectScorePoints[key] > 0
  ).map(({ key, label }) => `${label} (+${normalized.perfectScorePoints[key]} pts)`);
  if (perfectPropsText.length) {
    lines.push(
      `Perfect score (${perfectPropsText.join(', ')}): exact predictions only`
    );
  }

  const { maxWager = 3 } = normalized.propBetDefaults || {};
  lines.push(`Prop bets: max wager ${maxWager} pts (correct answers pay the wager amount; overrides per prop available)`);
  if (normalized.superWinnerPoints > 0) {
    lines.push(`Super Bowl winner pick: +${normalized.superWinnerPoints} pts for picking the champion at season start`);
  }

  return lines;
};
