import React, { useEffect, useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { FaTrophy, FaEyeSlash, FaLock, FaFootballBall } from 'react-icons/fa';
import { db } from '../../../firebase';
import BaseView from '../../common/components/BaseView';
import BracketEditor from './BracketEditor';
import ScoreComparisonModal from './ScoreComparisonModal';

/**
 * View-only experience for NFL Playoffs brackets.
 * Mirrors the BaseView flow from other game types but strips all Play-In specific state.
 */
const BracketView = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  initialBracketId = null,
  onBracketSelect = null,
  hideBackButton = false,
  fogOfWarEnabled = false,
  tournamentCompleted = false
}) => {
  const [scoringSettings, setScoringSettings] = useState(null);
  const [activeEntryId, setActiveEntryId] = useState(initialBracketId || null);
  const [comparisonTarget, setComparisonTarget] = useState(null);
  const [scoreboardMap, setScoreboardMap] = useState(null);

  useEffect(() => {
    if (!propLeagueId) return;

    const loadScoringSettings = async () => {
      try {
        const scoringRef = doc(db, 'leagues', propLeagueId, 'settings', 'scoring');
        const scoringSnap = await getDoc(scoringRef);
        setScoringSettings(scoringSnap.exists() ? scoringSnap.data() : null);
      } catch (err) {
        console.error('[NFL BracketView] Failed to load scoring settings:', err);
        setScoringSettings(null);
      }
    };

    loadScoringSettings();
  }, [propLeagueId]);

  useEffect(() => {
    if (initialBracketId) {
      setActiveEntryId(initialBracketId);
    }
  }, [initialBracketId]);

  const fetchOfficialBracket = useCallback(async (leagueId) => {
    if (!leagueId) return null;
    try {
      const tournamentRef = doc(db, 'leagues', leagueId, 'gameData', 'current');
      const tournamentSnap = await getDoc(tournamentRef);
      if (!tournamentSnap.exists()) return null;
      const data = tournamentSnap.data();
      setScoreboardMap(data?.scoreboard?.map || null);
      return data;
    } catch (err) {
      console.error('[NFL BracketView] Error fetching official bracket:', err);
      return null;
    }
  }, [setScoreboardMap]);

  const fetchBracketData = useCallback(async (leagueId, bracketId) => {
    if (!leagueId || !bracketId) return null;
    try {
      const bracketRef =
        bracketId === 'tournament'
          ? doc(db, 'leagues', leagueId, 'gameData', 'current')
          : doc(db, 'leagues', leagueId, 'userData', bracketId);
      const bracketSnap = await getDoc(bracketRef);
      if (!bracketSnap.exists()) return null;
      const data = bracketSnap.data();
      data.__entryId = bracketId;
      if (scoreboardMap && bracketId !== 'tournament') {
        const scoreboardEntry = scoreboardMap[bracketId];
        if (scoreboardEntry) {
          data.scoreboardEntry = scoreboardEntry;
        }
      }
      return data;
    } catch (err) {
      console.error(`[NFL BracketView] Error fetching bracket ${bracketId}:`, err);
      return null;
    }
  }, [scoreboardMap]);

  const resolveUserName = useCallback(async (leagueUser, fallbackId) => {
    const userId = typeof leagueUser === 'string' ? leagueUser : leagueUser?.id || fallbackId;
    let username = 'Unknown User';

    if (!userId) return { userId: null, username };

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        username = userData.displayName || userData.username || userData.email || 'Unknown User';
      } else if (typeof leagueUser === 'object' && leagueUser !== null) {
        username =
          leagueUser.displayName || leagueUser.username || leagueUser.email || 'Unknown User';
      }
    } catch (err) {
      console.error('[NFL BracketView] Error resolving username:', err);
    }

    return { userId, username: username.trim() };
  }, []);

  const fetchBrackets = useCallback(async (leagueId, leagueData, currentUserId) => {
    const brackets = [];

    if (!leagueId || !leagueData?.users || !Array.isArray(leagueData.users)) {
      return brackets;
    }

    const resolvedUsers = await Promise.all(
      leagueData.users.map(async (leagueUser) => {
        const { userId, username } = await resolveUserName(leagueUser);
        if (!userId) return null;

        try {
          const bracketRef = doc(db, 'leagues', leagueId, 'userData', userId);
          const bracketSnap = await getDoc(bracketRef);
          return {
            id: userId,
            name: username,
            isOfficial: false,
            isCurrentUser: userId === currentUserId,
            hasData: bracketSnap.exists()
          };
        } catch (err) {
          console.error('[NFL BracketView] Error checking user bracket:', err);
          return null;
        }
      })
    );

    const filtered = resolvedUsers.filter(Boolean);
    filtered.sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [resolveUserName]);

  const isBracketVisible = useCallback(
    (entry, userId) => {
      if (!fogOfWarEnabled) return true;
      if (entry.isOfficial) return true;
      if (entry.isCurrentUser || entry.id === userId) return true;
      return false;
    },
    [fogOfWarEnabled]
  );

  const BracketSelector = ({ entries, activeEntryId, onEntrySelect }) => (
    <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
      <div className="flex whitespace-nowrap sm:flex-wrap gap-1 sm:gap-2">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onEntrySelect(entry.id)}
              className={`flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded transition text-sm ${
                activeEntryId === entry.id
                  ? 'bg-indigo-600 text-white'
                  : entry.hasData
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {entry.isOfficial ? (
                <FaTrophy className="mr-1 sm:mr-2" />
              ) : (
                <FaFootballBall className="mr-1 sm:mr-2" />
              )}
              <span className="truncate max-w-32 sm:max-w-none">
                {entry.name}
                {entry.isCurrentUser ? ' (You)' : ''}
                {!entry.isOfficial && !entry.hasData ? ' (Not Submitted)' : ''}
              </span>
            </button>
          ))
        ) : (
          <div className="text-gray-500 italic text-sm">No brackets available</div>
        )}
      </div>
    </div>
  );

  const LoadingRenderer = () => (
    <div className="max-w-full sm:max-w-7xl mx-0 sm:mx-auto p-0 sm:p-4 md:p-6 bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-md">
      <div className="flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-indigo-500 mb-3 sm:mb-4"></div>
        <p className="text-gray-600">Loading bracket data...</p>
      </div>
    </div>
  );

  const ErrorRenderer = ({ error }) => (
    <div className="bg-red-100 border-0 sm:border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-none sm:rounded mb-4">
      <p className="font-bold">Error</p>
      <p>{error || 'An unexpected error occurred.'}</p>
    </div>
  );

  const EmptyBracket = ({ activeEntryId, officialEntryId }) => (
    <div className="text-center py-6 sm:py-8 text-gray-500">
      {!activeEntryId ? (
        <p>No bracket selected. Please select a bracket to view.</p>
      ) : (
        <div className="flex flex-col items-center">
          <FaLock className="text-3xl sm:text-4xl mb-2 sm:mb-3 text-gray-400" />
          <p className="mb-1">Bracket data not available</p>
          <p className="text-xs sm:text-sm text-gray-400">
            {activeEntryId === officialEntryId
              ? 'The official bracket has not been published.'
              : 'This user has not submitted a bracket yet.'}
          </p>
        </div>
      )}
    </div>
  );

  const HiddenBracket = ({ isAdmin, userId, handleEntryChange, officialEntryId }) => (
    <div className="text-center py-6 sm:py-12">
      <FaEyeSlash className="text-4xl sm:text-6xl text-gray-300 mx-auto mb-3 sm:mb-4" />
      <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Bracket Hidden</h3>
      <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base px-2 sm:px-0">
        This bracket is hidden while Fog of War mode is active. You can view the official bracket
        and your own bracket, but other entries remain hidden until the playoffs conclude.
        {isAdmin && ' Admins are also restricted to keep the competition fair.'}
      </p>
      <div className="flex flex-col sm:flex-row justify-center mt-4 sm:mt-6 space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          onClick={() => handleEntryChange(officialEntryId)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
        >
          View Official Bracket
        </button>
        {userId && (
          <button
            onClick={() => handleEntryChange(userId)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            View Your Bracket
          </button>
        )}
      </div>
    </div>
  );

  const handleEntrySelectInternal = useCallback(
    (entryId) => {
      setActiveEntryId(entryId);
      if (onBracketSelect) {
        onBracketSelect(entryId);
      }
    },
    [onBracketSelect]
  );

  const handleCompareRequest = useCallback((round, index, matchup, official) => {
    if (!official) return;
    if (fogOfWarEnabled && !tournamentCompleted) return;
    setComparisonTarget({
      round,
      index,
      matchup,
      official
    });
  }, [fogOfWarEnabled, tournamentCompleted]);

  const closeComparisonModal = () => setComparisonTarget(null);

  const BracketViewWrapper = ({ bracketData, officialBracket, isLocked, isAdmin }) => {
    if (!bracketData) {
      return (
        <div className="text-center text-gray-500 py-8">
          Bracket data is unavailable for this entry.
        </div>
      );
    }

    const mergedScoringSettings =
      scoringSettings ||
      officialBracket?.scoringSettings ||
      bracketData?.scoringSettings ||
      null;

    const hideSuperWinnerPick = !officialBracket;

    return (
        <BracketEditor
          bracketData={bracketData}
          officialBracket={officialBracket}
          isLocked={isLocked}
          isAdmin={isAdmin}
          hasPlayInTournament={false}
          scoringSettings={mergedScoringSettings}
          mvpPredictionMode={false}
          playoffTeams={officialBracket?.playoffTeams || {}}
          readOnly
          hideSuperWinnerPick={hideSuperWinnerPick}
          onCompareMatchup={fogOfWarEnabled && !tournamentCompleted ? null : handleCompareRequest}
          entryId={bracketData.__entryId || activeEntryId || null}
          scoreboardEntry={bracketData.scoreboardEntry}
          propBets={officialBracket?.propBets || []}
        />
    );
  };

  return (
    <>
      <BaseView
        isEmbedded={isEmbedded}
        leagueId={propLeagueId}
      initialEntryId={initialBracketId}
      onEntrySelect={handleEntrySelectInternal}
      hideBackButton={hideBackButton}
      fogOfWarEnabled={fogOfWarEnabled}
      gameCompleted={tournamentCompleted}
      entryType="Bracket"
      officialEntryId="tournament"
      officialEntryName="Official Bracket"
      fetchOfficialEntry={fetchOfficialBracket}
      fetchEntryData={fetchBracketData}
      fetchEntries={fetchBrackets}
      isEntryVisible={isBracketVisible}
      EntryViewer={BracketViewWrapper}
      EntrySelector={BracketSelector}
      LoadingRenderer={LoadingRenderer}
      ErrorRenderer={ErrorRenderer}
      EmptyEntryRenderer={EmptyBracket}
        HiddenEntryRenderer={HiddenBracket}
      />
      <ScoreComparisonModal
        isOpen={Boolean(comparisonTarget)}
        onClose={closeComparisonModal}
        leagueId={propLeagueId}
        round={comparisonTarget?.round || null}
        matchupIndex={comparisonTarget?.index ?? 0}
        officialMatchup={comparisonTarget?.official || null}
        userMatchup={comparisonTarget?.matchup || null}
        scoringSettings={scoringSettings}
        activeEntryId={activeEntryId}
      />
    </>
  );
};

export default BracketView;
