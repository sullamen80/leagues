import React, { useCallback, useMemo, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../../firebase';
import BaseAdminSettings from '../../common/components/BaseAdminSettings';
import AdminTeamPoolsPanel from './AdminTeamPoolsPanel';
import AdminScoringSettings from './AdminScoringSettings';
import DraftSettingsPanel from './AdminSettings/DraftSettingsPanel';
import { DEFAULT_ROSTER_SETTINGS, DEFAULT_SCORING_SETTINGS, DRAFT_STATUS, COLLECTION_KEYS, GAME_DATA_DOCUMENTS, ASSIGNMENT_MODES, DEFAULT_AUCTION_BUDGET } from '../constants/winsPoolConstants';
import { fetchGlobalTeamPools, fetchLeagueTeamPools } from '../services/teamPoolService';
import { generateAutoDoubleSnakeConfig, normalizeDoubleSnakeConfig } from '../utils/draftConfig';

const AdminSettings = () => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [teamPoolOptions, setTeamPoolOptions] = useState({ global: [], league: [] });

  const getTeamSignature = useCallback((teams = []) => (
    teams.map((team) => team.id).sort().join(',')
  ), []);

  const fetchSettingsData = useCallback(async (leagueIdParam) => {
    const gameDataRef = doc(db, 'leagues', leagueIdParam, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT);
    const gameDataSnap = await getDoc(gameDataRef);

    let gameData = gameDataSnap.exists()
      ? gameDataSnap.data()
      : {
          rosterSettings: { ...DEFAULT_ROSTER_SETTINGS },
          scoring: { ...DEFAULT_SCORING_SETTINGS },
          draft: {
            status: DRAFT_STATUS.NOT_STARTED,
            assignmentMode: DEFAULT_ROSTER_SETTINGS.assignmentMode,
            order: [],
            useSnakeDraft: true
          }
        };

    const [globalPools, leaguePools] = await Promise.all([
      fetchGlobalTeamPools(),
      fetchLeagueTeamPools(leagueIdParam)
    ]);

    setTeamPoolOptions({ global: globalPools, league: leaguePools });

    const rosterSettings = {
      ...DEFAULT_ROSTER_SETTINGS,
      ...(gameData.rosterSettings || {})
    };
    if (rosterSettings.auctionBudget === undefined || rosterSettings.auctionBudget === null) {
      rosterSettings.auctionBudget = DEFAULT_AUCTION_BUDGET;
    }

    const normalizedDraft = {
      ...gameData.draft,
      auctionBudget: gameData.draft?.auctionBudget ?? DEFAULT_AUCTION_BUDGET,
      doubleSnakeConfig: normalizeDoubleSnakeConfig(
        gameData.draft?.doubleSnakeConfig,
        gameData.teamPool?.teams || [],
        rosterSettings.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
      )
    };

    if (normalizedDraft.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE && !gameData.draft?.doubleSnakeConfig) {
      normalizedDraft.doubleSnakeConfig = generateAutoDoubleSnakeConfig(
        gameData.teamPool?.teams || [],
        normalizedDraft.doubleSnakeConfig.groupingMode,
        rosterSettings.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
      );
    }

    return {
      gameData,
      rosterSettings,
      scoring: gameData.scoring || { ...DEFAULT_SCORING_SETTINGS },
      draft: {
        status: DRAFT_STATUS.NOT_STARTED,
        assignmentMode: DEFAULT_ROSTER_SETTINGS.assignmentMode,
        order: [],
        useSnakeDraft: true,
        ...normalizedDraft
      },
      teamPool: gameData.teamPool || null,
      originalTeamPool: gameData.teamPool || null,
      originalTeamPoolSignature: getTeamSignature(gameData.teamPool?.teams || []),
      teamPoolSelectionChanged: false
    };
  }, [getTeamSignature]);

  const handleSave = useCallback(async (data, leagueIdParam, userId, setFeedback) => {
    const gameDataRef = doc(db, 'leagues', leagueIdParam, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT);

    const normalizedDoubleSnake = normalizeDoubleSnakeConfig(
      data.draft?.doubleSnakeConfig,
      data.teamPool?.teams || [],
      data.rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
    );

    const draftPayload = {
      ...data.draft,
      doubleSnakeConfig: normalizedDoubleSnake,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(gameDataRef, {
      rosterSettings: data.rosterSettings,
      scoring: data.scoring,
      draft: draftPayload,
      teamPool: data.teamPool,
      updatedAt: new Date().toISOString()
    });

    data.draft = draftPayload;
    const newSignature = getTeamSignature(data.teamPool?.teams || []);
    data.originalTeamPool = data.teamPool;
    data.originalTeamPoolSignature = newSignature;
    data.teamPoolSignature = newSignature;
    data.teamPoolSelectionChanged = false;

    if (setFeedback) {
      setFeedback('Team settings saved.');
    }
  }, [getTeamSignature]);

  const canSave = useCallback((data) => {
    if (!data) return false;
    const { draft, teamPool } = data;

    const draftHasStarted = draft?.status && draft.status !== DRAFT_STATUS.NOT_STARTED;
    if (!teamPool) return false;

    const currentSignature = getTeamSignature(teamPool.teams || []);
    const teamPoolChanged = data.teamPoolSelectionChanged !== undefined
      ? data.teamPoolSelectionChanged
      : (data.originalTeamPool?.id !== teamPool.id) || (data.originalTeamPoolSignature !== currentSignature);

    if (draftHasStarted && teamPoolChanged) {
      return false;
    }

    return true;
  }, [getTeamSignature]);

  const handleBack = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.delete('subview');
    navigate(`/league/${leagueId}?${searchParams.toString()}`, { replace: true });
  }, [leagueId, location.search, navigate]);

  const searchParams = new URLSearchParams(location.search);
  const requestedTab = searchParams.get('settingsTab') || 'teamPools';

  const tabs = useMemo(() => ([
    {
      id: 'teamPools',
      title: 'Team Pools',
      panel: ({ data, setData }) => (
        <AdminTeamPoolsPanel
          leagueId={leagueId}
          onApplyPool={(pool) => {
            setData((prev) => {
              const nextSignature = getTeamSignature(pool.teams || []);
              const changed = (prev.originalTeamPool?.id !== pool.id) || (prev.originalTeamPoolSignature !== nextSignature);
              const nextDoubleSnakeConfig = prev.draft?.assignmentMode === ASSIGNMENT_MODES.DOUBLE_SNAKE
                ? normalizeDoubleSnakeConfig(
                    prev.draft.doubleSnakeConfig,
                    pool.teams || [],
                    prev.rosterSettings?.rosterSize || DEFAULT_ROSTER_SETTINGS.rosterSize
                  )
                : prev.draft?.doubleSnakeConfig;
              return {
                ...prev,
                teamPool: pool,
                teamPoolSignature: nextSignature,
                teamPoolSelectionChanged: changed,
                draft: {
                  ...prev.draft,
                  doubleSnakeConfig: nextDoubleSnakeConfig
                }
              };
            });
          }}
          existingTeamPool={data.teamPool}
          globalPools={teamPoolOptions.global}
          leaguePools={teamPoolOptions.league}
          setTeamPoolOptions={setTeamPoolOptions}
          draftStatus={data.draft?.status}
        />
      )
    },
    {
      id: 'draft',
      title: 'Draft Settings',
      panel: ({ data, setData }) => (
        <DraftSettingsPanel
          leagueId={leagueId}
          data={data}
          onUpdate={(updates) => setData((prev) => {
            const draftUpdates = { ...(updates.draft || {}) };
            const rosterUpdates = { ...(updates.rosterSettings || {}) };

            // Support legacy flat updates by merging remaining keys into draftUpdates
            const remainingKeys = Object.keys(updates).filter(
              (key) => key !== 'draft' && key !== 'rosterSettings'
            );
            remainingKeys.forEach((key) => {
              draftUpdates[key] = updates[key];
            });

            if (draftUpdates.assignmentMode) {
              rosterUpdates.assignmentMode = draftUpdates.assignmentMode;
            }
            if (draftUpdates.useSnakeDraft !== undefined) {
              rosterUpdates.useSnakeDraft = draftUpdates.useSnakeDraft;
            }

            const nextDraft = {
              ...prev.draft,
              ...draftUpdates
            };

            const nextRoster = {
              ...prev.rosterSettings,
              ...rosterUpdates
            };

            return {
              ...prev,
              draft: nextDraft,
              rosterSettings: nextRoster
            };
          })}
        />
      )
    },
    {
      id: 'scoring',
      title: 'Scoring',
      panel: ({ data, setData }) => (
        <AdminScoringSettings
          leagueId={leagueId}
          settings={data.scoring}
          onChange={(updatedSettings) => setData((prev) => ({
            ...prev,
            scoring: updatedSettings
          }))}
        />
      )
    }
  ]), [leagueId, teamPoolOptions, handleBack, getTeamSignature]);

  return (
    <BaseAdminSettings
      gameType="winsPool"
      pageTitle="Wins Pool Settings"
      tabs={tabs}
      defaultTab={requestedTab || 'teamPools'}
      fetchData={fetchSettingsData}
      saveChanges={handleSave}
      canSave={canSave}
      onBack={handleBack}
    />
  );
};

export default AdminSettings;
