import React, { useState, useEffect, useMemo } from 'react';
import { FaTrophy, FaInfoCircle, FaMedal } from 'react-icons/fa';
import Matchup from './Matchup';
import MVPSelector from './MVPSelector';
import PropBetsSection from './PropBetsSection';
import { 
  ROUND_KEYS, 
  ROUND_DISPLAY_NAMES
} from '../constants/playoffConstants';

const parseScoreValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const deriveSpreadPickFromScores = (matchup) => {
  if (!matchup) return null;
  const team1Score = parseScoreValue(matchup.team1Score);
  const team2Score = parseScoreValue(matchup.team2Score);
  const spreadLine = parseScoreValue(matchup.spreadLine);
  if (team1Score === null || team2Score === null || spreadLine === null) return null;
  const diff = team1Score + spreadLine - team2Score;
  if (!Number.isFinite(diff)) return null;
  if (Math.abs(diff) < 1e-9) return 'push';
  return diff > 0 ? 'team1' : 'team2';
};

const deriveOverUnderPickFromScores = (matchup) => {
  if (!matchup) return null;
  const team1Score = parseScoreValue(matchup.team1Score);
  const team2Score = parseScoreValue(matchup.team2Score);
  const totalLine = parseScoreValue(matchup.overUnderLine);
  if (team1Score === null || team2Score === null || totalLine === null) return null;
  const total = team1Score + team2Score;
  if (!Number.isFinite(total)) return null;
  if (Math.abs(total - totalLine) < 1e-9) return 'push';
  return total > totalLine ? 'over' : 'under';
};

const applyScoreDerivedSelections = (matchup) => {
  if (!matchup) return;
  matchup.spreadPick = deriveSpreadPickFromScores(matchup);
  matchup.overUnderPick = deriveOverUnderPickFromScores(matchup);
};

/**
 * NFL Playoffs bracket editor component
 * Modified to work with the standardized Firebase data structure
 * Dark mode friendly version
 */
const BracketEditor = ({
  bracketData,
  onSeriesPrediction,
  onMVPSelect,
  onBracketUpdate = () => {},
  isAdmin = false,
  isLocked = false,
  readOnly = false,
  officialBracket = null,
  hasPlayInTournament = false,
  mvpPredictionMode = false,
  scoringSettings = null,
  teamPlayers = {},
  officialMVP = null,
  propBets = [],
  playoffTeams = {},
  hideSuperWinnerPick = false,
  onCompareMatchup = null,
  entryId = null,
  scoreboardEntry = null,
  lockStatus = {}
}) => {
  // Initialize state for the bracket using the standardized format
  const [processedData, setProcessedData] = useState({
    [ROUND_KEYS.FIRST_ROUND]: [],
    [ROUND_KEYS.CONF_SEMIS]: [],
    [ROUND_KEYS.CONF_FINALS]: [],
    [ROUND_KEYS.SUPER_BOWL]: null,
    [ROUND_KEYS.CHAMPION]: '',
    ChampionSeed: null,
    [ROUND_KEYS.FINALS_MVP]: '',
    superWinnerPick: '',
    propBetSelections: {}
  });
  const [propSelections, setPropSelections] = useState({});
  const firstRoundMatchups = processedData[ROUND_KEYS.FIRST_ROUND];
  const scoreboardGamesLookup = useMemo(() => {
    const lookup = {};
    if (!scoreboardEntry?.gameScores) return lookup;
    scoreboardEntry.gameScores.forEach((game) => {
      if (game && game.round && typeof game.matchupIndex === 'number') {
        lookup[`${game.round}-${game.matchupIndex}`] = game;
      }
    });
    return lookup;
  }, [scoreboardEntry]);

  const isRoundLocked = (roundKey) => Boolean(lockStatus?.[roundKey]?.locked);

  const availableChampionTeams = useMemo(() => {
    const names = new Set();
    const addName = (value) => {
      if (!value || typeof value !== 'string') return;
      const trimmed = value.trim();
      if (trimmed) names.add(trimmed);
    };

    const addFromPlayoffTeams = (teams) => {
      if (!teams || typeof teams !== 'object') return;
      Object.values(teams).forEach((group) => {
        if (Array.isArray(group)) {
          group.forEach((entry) => addName(entry?.name || entry?.teamName || entry?.fullName));
        } else if (group && typeof group === 'object') {
          Object.values(group).forEach((division) => {
            if (Array.isArray(division)) {
              division.forEach((team) => addName(team?.name || team?.teamName || team?.fullName));
            }
          });
        }
      });
    };

    addFromPlayoffTeams(playoffTeams);

    const addFromRound = (roundData) => {
      if (!Array.isArray(roundData)) return;
      roundData.forEach((matchup) => {
        addName(matchup?.team1);
        addName(matchup?.team2);
      });
    };

    addFromRound(firstRoundMatchups);

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [playoffTeams, firstRoundMatchups]);

  // Process the incoming bracket data on changes
  useEffect(() => {
    if (!bracketData) return;
    const structure = officialBracket || {};
    const processed = {
      [ROUND_KEYS.FIRST_ROUND]: [],
      [ROUND_KEYS.CONF_SEMIS]: [],
      [ROUND_KEYS.CONF_FINALS]: [],
      [ROUND_KEYS.SUPER_BOWL]: null,
      [ROUND_KEYS.CHAMPION]: bracketData[ROUND_KEYS.CHAMPION] || '',
      ChampionSeed: bracketData.ChampionSeed || null,
      [ROUND_KEYS.FINALS_MVP]: bracketData[ROUND_KEYS.FINALS_MVP] || '',
      superWinnerPick: bracketData.superWinnerPick || '',
      propBetSelections: bracketData.propBetSelections || {}
    };

    const mergeMatchup = (base = {}, pick = {}) => ({
      ...base,
      team1: base.team1 ?? pick.team1 ?? '',
      team1Seed: base.team1Seed ?? pick.team1Seed ?? null,
      team2: base.team2 ?? pick.team2 ?? '',
      team2Seed: base.team2Seed ?? pick.team2Seed ?? null,
      team1Score: pick.team1Score ?? base.team1Score ?? null,
      team2Score: pick.team2Score ?? base.team2Score ?? null,
      spreadLine: base.spreadLine ?? pick.spreadLine ?? null,
      overUnderLine: base.overUnderLine ?? pick.overUnderLine ?? null,
      spreadPick: pick.spreadPick ?? null,
      overUnderPick: pick.overUnderPick ?? null,
      winner: pick.winner || '',
      winnerSeed: pick.winnerSeed ?? null,
      conference: base.conference ?? pick.conference ?? ''
    });

    const buildRound = (roundKey) => {
      const baseRound = Array.isArray(structure[roundKey]) ? structure[roundKey] : [];
      const picksRound = Array.isArray(bracketData[roundKey]) ? bracketData[roundKey] : [];
      const length = Math.max(baseRound.length, picksRound.length);
      return Array.from({ length }).map((_, idx) => {
        const base = baseRound[idx] || {};
        const pick = picksRound[idx] || {};
        const merged = mergeMatchup(base, pick);
        applyScoreDerivedSelections(merged);
        return merged;
      });
    };

    processed[ROUND_KEYS.FIRST_ROUND] = buildRound(ROUND_KEYS.FIRST_ROUND);
    processed[ROUND_KEYS.CONF_SEMIS] = buildRound(ROUND_KEYS.CONF_SEMIS);
    processed[ROUND_KEYS.CONF_FINALS] = buildRound(ROUND_KEYS.CONF_FINALS);

    const baseSuper = structure[ROUND_KEYS.SUPER_BOWL] || bracketData[ROUND_KEYS.SUPER_BOWL] || null;
    const pickSuper = bracketData[ROUND_KEYS.SUPER_BOWL] || {};
    processed[ROUND_KEYS.SUPER_BOWL] = baseSuper
      ? (() => {
          const merged = {
            ...mergeMatchup(baseSuper, pickSuper),
            predictedMVP: pickSuper.predictedMVP || baseSuper.predictedMVP || ''
          };
          applyScoreDerivedSelections(merged);
          return merged;
        })()
      : null;

    setProcessedData(processed);
    setPropSelections(bracketData.propBetSelections || {});
  }, [bracketData, officialBracket]);

  const getMatchupRef = (data, round, index) => {
    if (!data) return null;
    if (round === ROUND_KEYS.SUPER_BOWL) {
      return data[ROUND_KEYS.SUPER_BOWL] || null;
    }
    const roundData = data[round];
    if (!Array.isArray(roundData)) return null;
    return roundData[index] || null;
  };


  const inferWinnerFromScores = (matchup) => {
    if (!matchup) return null;
    const { team1Score, team2Score, team1, team2, team1Seed, team2Seed } = matchup;
    if (
      team1Score === null ||
      team1Score === undefined ||
      team2Score === null ||
      team2Score === undefined
    ) {
      return null;
    }
    if (!Number.isFinite(team1Score) || !Number.isFinite(team2Score)) return null;
    if (team1Score === team2Score) return null;
    if (!team1 || !team2) return null;
    if (team1Score > team2Score) {
      return { winner: team1, winnerSeed: team1Seed ?? null };
    }
    return { winner: team2, winnerSeed: team2Seed ?? null };
  };

  const notifyMatchupChange = (round, index, matchup, extraFields = {}, mvp = null) => {
    if (!onSeriesPrediction || !matchup) return;
    const payload = {
      ...extraFields
    };

    ['team1Score', 'team2Score', 'spreadPick', 'overUnderPick', 'spreadLine', 'overUnderLine'].forEach(
      (field) => {
        if (field in matchup) {
          payload[field] = matchup[field] ?? null;
        }
      }
    );

    onSeriesPrediction(
      round,
      index,
      matchup.winner || '',
      matchup.winnerSeed ?? null,
      matchup.numGames || 1,
      mvp,
      payload
    );
  };

  const updateMatchupFields = (round, index, fields = {}, { inferWinner = false } = {}) => {
    if (isLocked || readOnly || isRoundLocked(round)) return;
    setProcessedData((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      const matchup = getMatchupRef(updated, round, index);
      if (!matchup) return prev;

      Object.assign(matchup, fields);

      if (inferWinner) {
        const inferred = inferWinnerFromScores(matchup);
        if (inferred) {
          matchup.winner = inferred.winner;
          matchup.winnerSeed = inferred.winnerSeed;
        } else {
          matchup.winner = '';
          matchup.winnerSeed = null;
        }
      }

      if (round === ROUND_KEYS.SUPER_BOWL) {
        if (matchup.winner) {
          updated[ROUND_KEYS.CHAMPION] = matchup.winner;
          updated.ChampionSeed = matchup.winnerSeed ?? null;
        } else {
          updated[ROUND_KEYS.CHAMPION] = '';
          updated.ChampionSeed = null;
        }
      }

      applyScoreDerivedSelections(matchup);
      notifyMatchupChange(round, index, matchup, fields);
      return updated;
    });
  };
  
  // Get the champion name
  const getChampionName = () => {
    if (processedData[ROUND_KEYS.CHAMPION]) {
      return processedData[ROUND_KEYS.CHAMPION];
    } else if (processedData[ROUND_KEYS.SUPER_BOWL] && processedData[ROUND_KEYS.SUPER_BOWL].winner) {
      return processedData[ROUND_KEYS.SUPER_BOWL].winner;
    }
    return "";
  };
  
  // Get the Finals MVP
  const getFinalsMVP = () => {
    if (processedData[ROUND_KEYS.FINALS_MVP]) {
      return processedData[ROUND_KEYS.FINALS_MVP];
    } else if (processedData[ROUND_KEYS.SUPER_BOWL] && processedData[ROUND_KEYS.SUPER_BOWL].mvp) {
      return processedData[ROUND_KEYS.SUPER_BOWL].mvp;
    }
    return "";
  };
  
  // Check if a team has valid data (from the original data in Firebase)
  const hasValidTeam = (matchup) => {
    // More thorough validation for teams
    if (!matchup) return false;
    
    // Check for team names
    if (matchup.team1 || matchup.team2) {
      return true;
    }
    
    // Check for team seeds
    if ((matchup.team1Seed !== null && matchup.team1Seed !== undefined) || 
        (matchup.team2Seed !== null && matchup.team2Seed !== undefined)) {
      return true;
    }
    
    // No valid team data found
    return false;
  };
  
  // Attempt to get team data from various sources
  const getTeamName = (matchup, teamKey) => {
    if (!matchup) return "";
    
    // Check if team name exists directly
    if (matchup[teamKey] && matchup[teamKey].trim() !== "") {
      return matchup[teamKey];
    }
    
    // If we only have seed info, create a placeholder name
    const seedKey = `${teamKey}Seed`;
    if (matchup[seedKey] !== null && matchup[seedKey] !== undefined) {
      // Use conference if available
      if (matchup.conference) {
        return `${matchup.conference} #${matchup[seedKey]} Seed`;
      }
      return `#${matchup[seedKey]} Seed`;
    }
    
    return "";
  };
  
  const handleScoreUpdate = (round, index, field, value) => {
    if (isLocked || readOnly) return;
    const normalized =
      value === null || value === undefined ? null : Number(value);
    if (value !== null && value !== undefined && !Number.isFinite(normalized)) {
      return;
    }
    updateMatchupFields(
      round,
      index,
      { [field]: normalized },
      { inferWinner: true }
    );
  };

  const handleLineChange = (round, index, field, value) => {
    if (isLocked || readOnly) return;
    const normalized =
      value === null || value === undefined ? null : Number(value);
    if (value !== null && value !== undefined && !Number.isFinite(normalized)) {
      return;
    }
    updateMatchupFields(round, index, { [field]: normalized });
  };

  const handlePropSelectionChange = (propId, changes) => {
    if (isLocked || readOnly || isRoundLocked(ROUND_KEYS.SUPER_BOWL)) return;
    setPropSelections((prev) => {
      const updatedSelections = {
        ...prev,
        [propId]: {
          ...(prev?.[propId] || {}),
          ...changes
        }
      };
      const updatedBracket = JSON.parse(JSON.stringify(processedData));
      updatedBracket.propBetSelections = updatedSelections;
      setProcessedData(updatedBracket);
      onBracketUpdate(updatedBracket);
      return updatedSelections;
    });
  };

  const handleSuperWinnerPick = (teamName) => {
    if (isLocked || readOnly || isRoundLocked(ROUND_KEYS.FIRST_ROUND)) return;
    setProcessedData((prev) => {
      const updated = {
        ...prev,
        superWinnerPick: teamName
      };
      onBracketUpdate(updated);
      return updated;
    });
  };
  
  // Handle MVP selection
  const handleMVPSelect = (mvp) => {
    if (
      isLocked ||
      readOnly ||
      isRoundLocked(ROUND_KEYS.FINALS_MVP) ||
      isRoundLocked(ROUND_KEYS.SUPER_BOWL)
    ) {
      return;
    }
    if (onMVPSelect) {
      onMVPSelect(mvp);
    }
    
    setProcessedData((prev) => ({
      ...prev,
      [ROUND_KEYS.FINALS_MVP]: mvp,
      [ROUND_KEYS.SUPER_BOWL]: prev[ROUND_KEYS.SUPER_BOWL]
        ? {
            ...prev[ROUND_KEYS.SUPER_BOWL],
            mvp
          }
        : null
    }));
  };
  
  // Render a matchup for a specific round
  const renderMatchup = (round, index, matchup) => {
    if (!matchup) return null;

    // Get proper team names (or placeholders)
    const enhancedMatchup = {
      ...matchup,
      team1: getTeamName(matchup, 'team1'),
      team2: getTeamName(matchup, 'team2')
    };
    
    // Don't render empty matchups where neither team is set
    if (!hasValidTeam(matchup)) {
      return (
        <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          Awaiting teams...
        </div>
      );
    }
    
    // Get the official result for comparison if available
    let officialResult = null;
    if (officialBracket && officialBracket[round] && officialBracket[round][index]) {
      officialResult = officialBracket[round][index];
    } else if (round === ROUND_KEYS.SUPER_BOWL && officialBracket && officialBracket[ROUND_KEYS.SUPER_BOWL]) {
      officialResult = officialBracket[ROUND_KEYS.SUPER_BOWL];
    }

    const compareAvailable =
      typeof onCompareMatchup === 'function' && officialResult;

    const scoreboardGame = scoreboardGamesLookup?.[`${round}-${index}`] || null;

    return (
      <div className="mb-4">
        <Matchup
          matchup={enhancedMatchup}
          scoringSettings={scoringSettings}
          onScoreChange={(field, value) =>
            handleScoreUpdate(round, index, field, value)
          }
          onLineChange={(field, value) =>
            handleLineChange(round, index, field, value)
          }
          isLocked={isLocked || readOnly || isRoundLocked(round)}
          isAdmin={isAdmin}
          showSeed={true}
          className=""
          roundKey={round}
          officialResult={officialResult}
          readOnly={readOnly}
          onCompareScore={
            compareAvailable
              ? () => onCompareMatchup(round, index, enhancedMatchup, officialResult)
              : null
          }
          entryId={entryId}
          scoreboardGame={scoreboardGame}
        />
      </div>
    );
  };
  
  // Get style information for a conference
  const getConferenceStyle = (conference) => {
    if (conference === 'AFC') {
      return {
        title: 'AFC',
        textColor: 'text-blue-800 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900',
        borderColor: 'border-blue-200 dark:border-blue-700'
      };
    }
    return {
      title: 'NFC',
      textColor: 'text-red-800 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900',
      borderColor: 'border-red-200 dark:border-red-700'
    };
  };
  
  // Render the first round section
  const renderFirstRound = () => {
    const firstRoundAFC = processedData[ROUND_KEYS.FIRST_ROUND].filter((m) => m.conference === 'AFC');
    const firstRoundNFC = processedData[ROUND_KEYS.FIRST_ROUND].filter((m) => m.conference === 'NFC');

    const afcStyle = getConferenceStyle('AFC');
    const nfcStyle = getConferenceStyle('NFC');

    const hasAFCMatchups = firstRoundAFC.length > 0 && firstRoundAFC.some(hasValidTeam);
    const hasNFCMatchups = firstRoundNFC.length > 0 && firstRoundNFC.some(hasValidTeam);

    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.FIRST_ROUND]}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AFC */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${afcStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${afcStyle.textColor}`}>
              {afcStyle.title}
            </h4>

            <div className="space-y-3">
              {hasAFCMatchups ? (
                firstRoundAFC.map((matchup, i) => {
                  const originalIndex = processedData[ROUND_KEYS.FIRST_ROUND].findIndex(
                    (m) =>
                      m.conference === 'AFC' &&
                      m.team1Seed === matchup.team1Seed &&
                      m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`afc-first-${i}`}>
                      {renderMatchup(ROUND_KEYS.FIRST_ROUND, originalIndex, matchup)}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  No matchups set for the AFC
                </div>
              )}
            </div>
          </div>

          {/* NFC */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${nfcStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${nfcStyle.textColor}`}>
              {nfcStyle.title}
            </h4>

            <div className="space-y-3">
              {hasNFCMatchups ? (
                firstRoundNFC.map((matchup, i) => {
                  const originalIndex = processedData[ROUND_KEYS.FIRST_ROUND].findIndex(
                    (m) =>
                      m.conference === 'NFC' &&
                      m.team1Seed === matchup.team1Seed &&
                      m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`nfc-first-${i}`}>
                      {renderMatchup(ROUND_KEYS.FIRST_ROUND, originalIndex, matchup)}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  No matchups set for the NFC
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the conference semifinals (second round)
  const renderConferenceSemis = () => {
    const secondRoundAFC = processedData[ROUND_KEYS.CONF_SEMIS].filter((m) => m.conference === 'AFC');
    const secondRoundNFC = processedData[ROUND_KEYS.CONF_SEMIS].filter((m) => m.conference === 'NFC');

    const afcStyle = getConferenceStyle('AFC');
    const nfcStyle = getConferenceStyle('NFC');

    const hasAFCMatchups = secondRoundAFC.length > 0 && secondRoundAFC.some(hasValidTeam);
    const hasNFCMatchups = secondRoundNFC.length > 0 && secondRoundNFC.some(hasValidTeam);

    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_SEMIS]}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AFC */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${afcStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${afcStyle.textColor}`}>
              {afcStyle.title}
            </h4>

            <div className="space-y-3">
              {hasAFCMatchups ? (
                secondRoundAFC.map((matchup, i) => {
                  const originalIndex = processedData[ROUND_KEYS.CONF_SEMIS].findIndex(
                    (m) =>
                      m.conference === 'AFC' &&
                      m.team1Seed === matchup.team1Seed &&
                      m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`afc-second-${i}`}>
                      {renderMatchup(ROUND_KEYS.CONF_SEMIS, originalIndex, matchup)}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete the Wild Card round to reveal these matchups
                </div>
              )}
            </div>
          </div>

          {/* NFC */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${nfcStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${nfcStyle.textColor}`}>
              {nfcStyle.title}
            </h4>

            <div className="space-y-3">
              {hasNFCMatchups ? (
                secondRoundNFC.map((matchup, i) => {
                  const originalIndex = processedData[ROUND_KEYS.CONF_SEMIS].findIndex(
                    (m) =>
                      m.conference === 'NFC' &&
                      m.team1Seed === matchup.team1Seed &&
                      m.team2Seed === matchup.team2Seed
                  );
                  return (
                    <div key={`nfc-second-${i}`}>
                      {renderMatchup(ROUND_KEYS.CONF_SEMIS, originalIndex, matchup)}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete the Wild Card round to reveal these matchups
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the conference finals
  const renderConferenceFinals = () => {
    const afcFinal = processedData[ROUND_KEYS.CONF_FINALS].find((m) => m.conference === 'AFC');
    const nfcFinal = processedData[ROUND_KEYS.CONF_FINALS].find((m) => m.conference === 'NFC');

    const afcStyle = getConferenceStyle('AFC');
    const nfcStyle = getConferenceStyle('NFC');

    const hasAFCFinal = afcFinal && hasValidTeam(afcFinal);
    const hasNFCFinal = nfcFinal && hasValidTeam(nfcFinal);

    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.CONF_FINALS]}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AFC */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${afcStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${afcStyle.textColor}`}>
              {afcStyle.title}
            </h4>

            <div className="space-y-3">
              {hasAFCFinal ? (
                renderMatchup(
                  ROUND_KEYS.CONF_FINALS,
                  processedData[ROUND_KEYS.CONF_FINALS].findIndex((m) => m.conference === 'AFC'),
                  afcFinal
                )
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete the Divisional Round to reveal the AFC Championship
                </div>
              )}
            </div>
          </div>

          {/* NFC */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border ${nfcStyle.borderColor}`}>
            <h4 className={`text-lg font-bold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 ${nfcStyle.textColor}`}>
              {nfcStyle.title}
            </h4>

            <div className="space-y-3">
              {hasNFCFinal ? (
                renderMatchup(
                  ROUND_KEYS.CONF_FINALS,
                  processedData[ROUND_KEYS.CONF_FINALS].findIndex((m) => m.conference === 'NFC'),
                  nfcFinal
                )
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  Complete the Divisional Round to reveal the NFC Championship
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the Super Bowl
  const renderSuperBowl = () => {
    const finals = processedData[ROUND_KEYS.SUPER_BOWL];
    const hasFinals = finals && hasValidTeam(finals);
    
    if (!hasFinals) {
      return (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
            {ROUND_DISPLAY_NAMES[ROUND_KEYS.SUPER_BOWL]}
          </h3>
          <div className="max-w-lg mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-red-50 dark:from-blue-900 dark:to-red-900 p-6 rounded-lg shadow-md border border-amber-200 dark:border-amber-700">
              <h4 className="text-xl font-bold mb-4 text-center text-amber-900 dark:text-amber-200 py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <FaTrophy className="inline-block mr-2 text-amber-500 dark:text-grey-300 " />
                Super Bowl Championship
              </h4>
              <div className="text-center text-gray-500 dark:text-gray-300 p-4">
                Awaiting Conference Finals winners...
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Get proper team names for finals
    const enhancedFinals = {
      ...finals,
      team1: getTeamName(finals, 'team1'),
      team2: getTeamName(finals, 'team2')
    };
    
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 p-2 text-gray-900 dark:text-gray-100">
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.SUPER_BOWL]}
        </h3>
        <div className="max-w-lg mx-auto">
          <div className="bg-gradient-to-r from-blue-50 to-red-50 dark:from-blue-900 dark:to-red-900 p-6 rounded-lg shadow-md border border-amber-200 dark:border-amber-700">
            <h4 className="text-xl font-bold mb-4 text-center text-gray-700 dark:text-amber-300 pb-2 border-b border-amber-200 dark:border-amber-700">
              <FaTrophy className="inline-block mr-2 text-gray-500  " />
              Super Bowl Championship
            </h4>
            
            {renderMatchup(ROUND_KEYS.SUPER_BOWL, 0, enhancedFinals)}
          </div>
        </div>
      </div>
    );
  };
  
  // Render the champion display
  const renderChampion = () => {
    const champion = getChampionName();
    if (!champion) return null;
    
    return (
      <div className="mt-8 bg-amber-50 dark:bg-amber-900 p-4 rounded-lg border border-amber-200 dark:border-amber-700 text-center">
        <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-amber-300">
          <FaTrophy className="inline-block mr-2 text-gray-500" />
          {ROUND_DISPLAY_NAMES[ROUND_KEYS.CHAMPION]}
        </h3>
        <div className="text-2xl font-bold text-gray-700 dark:text-amber-200">{champion}</div>
      </div>
    );
  };

  const renderSuperWinnerPick = () => {
    if (hideSuperWinnerPick || !availableChampionTeams.length) return null;
    return (
      <div className="mt-8 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
        <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-100">
          Early Super Bowl Winner Pick
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Make your season-long champion prediction before the Wild Card round locks.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {availableChampionTeams.map((team) => {
            const isSelected = processedData.superWinnerPick === team;
            const championLocked = isLocked || readOnly || isRoundLocked(ROUND_KEYS.FIRST_ROUND);
            return (
              <button
                key={team}
                type="button"
                onClick={() => handleSuperWinnerPick(team)}
                disabled={championLocked}
                className={`px-3 py-2 border rounded text-sm ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-indigo-50'
                } ${championLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {team}
              </button>
            );
          })}
        </div>
        {processedData.superWinnerPick && (
          <p className="text-xs text-gray-500 mt-2">
            Selected: <span className="font-semibold">{processedData.superWinnerPick}</span>
          </p>
        )}
      </div>
    );
  };

  const renderPropBets = () => {
    if (!propBets || propBets.length === 0) return null;
    return (
        <PropBetsSection
          propBets={propBets}
          selections={propSelections}
          isLocked={isLocked || readOnly || isRoundLocked(ROUND_KEYS.SUPER_BOWL)}
          scoringSettings={scoringSettings}
          onSelectionChange={handlePropSelectionChange}
          showOnlySelectedProps={readOnly}
        />
    );
  };
  
  // Render the MVP prediction section
  const renderMVPPrediction = () => {
    const mvp = getFinalsMVP();
    const hasFinals = processedData[ROUND_KEYS.SUPER_BOWL] && hasValidTeam(processedData[ROUND_KEYS.SUPER_BOWL]);
    
    if (!hasFinals && !mvpPredictionMode) {
      return null;
    }
    
    // Get the finalist teams for the MVP selector
    const finalistTeams = [];
    if (hasFinals) {
      if (processedData[ROUND_KEYS.SUPER_BOWL].team1) {
        finalistTeams.push(getTeamName(processedData[ROUND_KEYS.SUPER_BOWL], 'team1'));
      }
      if (processedData[ROUND_KEYS.SUPER_BOWL].team2) {
        finalistTeams.push(getTeamName(processedData[ROUND_KEYS.SUPER_BOWL], 'team2'));
      }
    }
    
    const finalsLocked =
      isLocked ||
      isRoundLocked(ROUND_KEYS.FINALS_MVP) ||
      isRoundLocked(ROUND_KEYS.SUPER_BOWL);
    return (
      <div className="mt-8 bg-amber-50 dark:bg-amber-900 p-6 rounded-lg border border-amber-200 dark:border-amber-700">
      <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-amber-300 text-center">
        <FaMedal className="inline-block mr-2" />
        {ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} Prediction
      </h3>
        
        <MVPSelector
          selectedMVP={mvp}
          onSelect={handleMVPSelect}
          finalistsTeams={finalistTeams}
          disabled={finalsLocked}
          officialMVP={officialMVP} 
          teamPlayers={teamPlayers} 
        />
      </div>
    );
  };

  // Simplified view for MVP prediction mode
  if (mvpPredictionMode) {
    const finalsLocked =
      isLocked ||
      isRoundLocked(ROUND_KEYS.FINALS_MVP) ||
      isRoundLocked(ROUND_KEYS.SUPER_BOWL);
    return (
      <div className="bracket-editor overflow-x-auto">
        <div className="max-w-2xl mx-auto">
          {renderMVPPrediction()}
          
          {finalsLocked && (
            <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 p-3 rounded mt-4">
              <div className="flex items-center">
                <FaInfoCircle className="mr-2" />
                <span>{ROUND_DISPLAY_NAMES[ROUND_KEYS.FINALS_MVP]} predictions are now locked</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Full bracket editor view
  return (
    <div className="playoffs-bracket-editor overflow-x-auto">
      {!bracketData ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No bracket data available</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Super Bowl preseason pick */}
          {renderSuperWinnerPick()}

          {/* Regular playoffs rounds */}
          {renderFirstRound()}
          {renderConferenceSemis()}
          {renderConferenceFinals()}
          {renderSuperBowl()}

          {/* Champion display */}
          {renderChampion()}
          
          {/* Prop Bets */}
          {renderPropBets()}

          {/* MVP Prediction */}
          {renderMVPPrediction()}
        </div>
      )}
      
      {isLocked && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 p-3 rounded mt-4">
          <div className="flex items-center">
            <FaInfoCircle className="mr-2" />
            <span>This bracket is locked and cannot be edited</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BracketEditor;
