import { PRESET_TEAM_POOLS } from '../../winsPool/constants/teamPools';

const normalizeTeamKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeTeamText = (value = '') => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

const TEAM_TOKEN_ALIASES = {
  la: 'losangeles',
  okc: 'oklahomacity',
  phx: 'phoenix',
  gsw: 'goldenstate',
  ny: 'newyork'
};

const GENERIC_TOKENS = new Set([
  'basketball',
  'club',
  'collective',
  'group',
  'project',
  'continuation',
  'performance',
  'lab',
  'department',
  'crew',
  'rotation',
  'offense',
  'machine',
  'branch',
  'program',
  'metropolitan',
  'division',
  'young',
  'core',
  'flight',
  'high',
  'altitude',
  'bay',
  'south',
  'beach',
  'helio',
  'veteran',
  'legacy',
  'championship',
  'transition'
]);

const NBA_TEAMS = PRESET_TEAM_POOLS?.nba?.teams || [];

const tokenizeTeamName = (value = '') =>
  normalizeTeamText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => TEAM_TOKEN_ALIASES[token] || token)
    .filter((token) => !GENERIC_TOKENS.has(token));

export const getNBATeamProfile = (teamName = '') => {
  if (!teamName) return null;

  const normalized = normalizeTeamKey(teamName);
  const tokens = tokenizeTeamName(teamName);
  let bestMatch = null;
  let bestScore = 0;

  NBA_TEAMS.forEach((team) => {
    const candidates = [
      team.id,
      team.city,
      team.name,
      team.shortName,
      `${team.city} ${team.name}`.trim(),
      `${team.city} ${team.shortName}`.trim()
    ];

    const normalizedCandidates = candidates.map(normalizeTeamKey);
    const exactMatch = normalizedCandidates.some((candidate) => candidate === normalized);
    const containsMatch = normalizedCandidates.some(
      (candidate) => candidate && (normalized.includes(candidate) || candidate.includes(normalized))
    );

    const tokenScore = candidates.reduce((score, candidate) => {
      const candidateTokens = tokenizeTeamName(candidate);
      if (!candidateTokens.length) return score;

      const matchedTokens = candidateTokens.filter((token) => tokens.includes(token)).length;
      const ratio = matchedTokens / candidateTokens.length;
      return Math.max(score, ratio >= 1 ? 40 : ratio >= 0.5 ? 24 : matchedTokens > 0 ? 12 : 0);
    }, 0);

    const score = exactMatch ? 100 : containsMatch ? 70 : tokenScore;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = team;
    }
  });

  if (!bestMatch || bestScore < 12) return null;

  return {
    ...bestMatch,
    displayName: bestMatch.shortName || bestMatch.name || teamName,
    fullName: `${bestMatch.city} ${bestMatch.name}`.trim()
  };
};
