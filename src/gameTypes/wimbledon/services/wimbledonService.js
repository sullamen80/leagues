import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  WIMBLEDON_LOCK_KEY,
  WIMBLEDON_SCHEMA_VERSION,
  createDefaultWimbledonScoring
} from '../constants/wimbledonConstants';
import {
  applyImportedEntrants,
  countCompletedPredictions,
  createDefaultWimbledonGameData,
  getRequiredPredictionCount,
  getChampionSlotId,
  getStarterSlotIdsForRound,
  resolveDrawMatches
} from '../utils/drawUtils';
import { calculateWimbledonScore, sortWimbledonScores } from './scoringService';

export const createDefaultWimbledonLocks = () => ({
  [WIMBLEDON_LOCK_KEY]: { locked: false, lockedAt: null, lockedBy: null }
});

const comparablePrediction = (prediction = {}) => ({
  winnerSlotId: prediction.winnerSlotId || null,
  winnerSets: prediction.winnerSets ?? null,
  loserSets: prediction.loserSets ?? null,
  completionReason: prediction.completionReason || 'completed'
});

const predictionsDiffer = (left, right) =>
  JSON.stringify(comparablePrediction(left)) !== JSON.stringify(comparablePrediction(right));

const getAuditReason = (actor = {}, fallback) =>
  String(actor.reason || '').trim() || fallback;

export const initializeWimbledonLeague = async (leagueId, setupData = {}) => {
  const options = setupData.wimbledonSetup || setupData;
  const gameData = createDefaultWimbledonGameData(options);
  const scoring = {
    ...createDefaultWimbledonScoring(),
    setPredictionEnabled: Boolean(options.setPredictionEnabled)
  };

  await Promise.all([
    setDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), gameData),
    setDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring'), scoring),
    setDoc(doc(db, 'leagues', leagueId, 'settings', 'visibility'), {
      fogOfWarEnabled: true,
      revealPolicy: 'afterLock',
      updatedAt: new Date().toISOString()
    }),
    setDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus'), createDefaultWimbledonLocks())
  ]);

  return { success: true };
};

export const createEmptyWimbledonEntry = (gameData = {}, user = {}) => ({
  schemaVersion: WIMBLEDON_SCHEMA_VERSION,
  drawRevision: Number(gameData.drawRevision || 1),
  picksByMatchId: {},
  championSlotId: null,
  submittedAt: null,
  updatedAt: new Date().toISOString(),
  userId: user.uid || user.id || '',
  userName: user.displayName || user.username || user.email || 'Unknown User'
});

export const upsertWimbledonEntry = async (leagueId, userId, gameData = null, user = {}) => {
  const gameDataSnap = gameData
    ? null
    : await getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'));
  const resolvedGameData = gameData || (gameDataSnap?.exists() ? gameDataSnap.data() : {});
  const entryRef = doc(db, 'leagues', leagueId, 'userData', userId);
  const entrySnap = await getDoc(entryRef);

  if (!entrySnap.exists()) {
    await setDoc(entryRef, createEmptyWimbledonEntry(resolvedGameData, user));
  }

  return entrySnap.exists() ? entrySnap.data() : createEmptyWimbledonEntry(resolvedGameData, user);
};

export const fetchWimbledonBundle = async (leagueId, userId = null) => {
  const refs = [
    getDoc(doc(db, 'leagues', leagueId)),
    getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current')),
    getDoc(doc(db, 'leagues', leagueId, 'locks', 'lockStatus')),
    getDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring')),
    getDoc(doc(db, 'leagues', leagueId, 'settings', 'visibility'))
  ];
  if (userId) {
    refs.push(getDoc(doc(db, 'leagues', leagueId, 'userData', userId)));
  }

  const [leagueSnap, gameSnap, lockSnap, scoringSnap, visibilitySnap, entrySnap] = await Promise.all(refs);
  return {
    league: leagueSnap.exists() ? { id: leagueSnap.id, ...leagueSnap.data() } : null,
    gameData: gameSnap.exists() ? gameSnap.data() : null,
    locks: lockSnap.exists() ? lockSnap.data() : createDefaultWimbledonLocks(),
    scoring: scoringSnap.exists() ? scoringSnap.data() : createDefaultWimbledonScoring(),
    visibility: visibilitySnap.exists() ? visibilitySnap.data() : { fogOfWarEnabled: true, revealPolicy: 'afterLock' },
    entry: entrySnap?.exists() ? entrySnap.data() : null
  };
};

export const fetchWimbledonBracketEntries = async (leagueId, currentUserId = null) => {
  const entriesSnap = await getDocs(collection(db, 'leagues', leagueId, 'userData'));
  const entries = entriesSnap.docs.map((entryDoc) => {
    const entry = entryDoc.data();
    return {
      id: entryDoc.id,
      name: entry.userName || 'Unknown User',
      isOfficial: false,
      isCurrentUser: entryDoc.id === currentUserId
    };
  });

  entries.sort((left, right) => {
    if (left.isCurrentUser) return -1;
    if (right.isCurrentUser) return 1;
    return left.name.localeCompare(right.name);
  });

  return [
    { id: 'official', name: 'Official Results', isOfficial: true, isCurrentUser: false },
    ...entries
  ];
};

export const saveWimbledonEntry = async (leagueId, userId, picksByMatchId, options = {}) => {
  const bundle = await fetchWimbledonBundle(leagueId, userId);
  if (bundle.locks?.[WIMBLEDON_LOCK_KEY]?.locked && !options.adminOverride) {
    throw new Error('This bracket is locked');
  }

  const sanitized = resolveDrawMatches(bundle.gameData, picksByMatchId).predictionsByMatchId;
  const payload = {
    ...(bundle.entry || createEmptyWimbledonEntry(bundle.gameData, options.user || {})),
    schemaVersion: WIMBLEDON_SCHEMA_VERSION,
    drawRevision: Number(bundle.gameData?.drawRevision || 1),
    picksByMatchId: sanitized,
    championSlotId: getChampionSlotId(sanitized),
    submittedAt: countCompletedPredictions(sanitized) === getRequiredPredictionCount(bundle.gameData)
      ? bundle.entry?.submittedAt || new Date().toISOString()
      : null,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'leagues', leagueId, 'userData', userId), payload, { merge: true });
  return payload;
};

export const importWimbledonEntrants = async (leagueId, importedRows, actor = {}) => {
  const bundle = await fetchWimbledonBundle(leagueId);
  const previousEntrants = bundle.gameData?.entrantsBySlot || {};
  const entrantsBySlot = applyImportedEntrants(previousEntrants, importedRows);
  const drawRevision = Number(bundle.gameData?.drawRevision || 1) + 1;
  await updateDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), {
    entrantsBySlot,
    drawRevision,
    status: 'ready',
    updatedAt: new Date().toISOString()
  });

  if (bundle.locks?.[WIMBLEDON_LOCK_KEY]?.locked) {
    await addDoc(collection(db, 'leagues', leagueId, 'auditLog'), {
      action: 'draw-import',
      adminUserId: actor.uid || '',
      reason: getAuditReason(actor, 'Post-lock draw correction'),
      drawRevision,
      changedSlots: importedRows.map((row) => row.slotId),
      createdAt: new Date().toISOString()
    });
  }

  return { entrantsBySlot, drawRevision };
};

const resetLeagueToRoundOf32State = async (leagueId, bundle, actor = {}, options = {}) => {
  const {
    action,
    reason,
    startRoundSlotIds,
    entrantsBySlot = null
  } = options;
  const now = new Date().toISOString();
  const drawRevision = Number(bundle.gameData?.drawRevision || 1) + 1;
  const userEntriesSnap = await getDocs(collection(db, 'leagues', leagueId, 'userData'));
  const lockEntry = { locked: false, lockedAt: null, lockedBy: null };
  const gameDataUpdate = {
    startRoundKey: 'roundOf32',
    startRoundSlotIds,
    officialResultsByMatchId: {},
    drawRevision,
    status: 'ready',
    completedAt: null,
    updatedAt: now
  };

  if (entrantsBySlot) {
    gameDataUpdate.entrantsBySlot = entrantsBySlot;
  }

  const baseUpdates = [
    {
      ref: doc(db, 'leagues', leagueId, 'gameData', 'current'),
      data: gameDataUpdate
    },
    {
      ref: doc(db, 'leagues', leagueId, 'locks', 'lockStatus'),
      data: {
        [WIMBLEDON_LOCK_KEY]: lockEntry
      }
    },
    {
      ref: doc(db, 'leagues', leagueId, 'settings', 'visibility'),
      data: {
        fogOfWarEnabled: true,
        revealPolicy: 'afterLock',
        updatedAt: now,
        updatedBy: actor.uid || null
      }
    }
  ];

  const entryUpdates = userEntriesSnap.docs.map((entryDoc) => ({
    ref: entryDoc.ref,
    data: {
      drawRevision,
      picksByMatchId: {},
      championSlotId: null,
      submittedAt: null,
      updatedAt: now
    }
  }));

  const allUpdates = [...baseUpdates, ...entryUpdates];
  for (let index = 0; index < allUpdates.length; index += 450) {
    const batch = writeBatch(db);
    allUpdates.slice(index, index + 450).forEach(({ ref, data }) => {
      batch.set(ref, data, { merge: true });
    });
    await batch.commit();
  }

  await addDoc(collection(db, 'leagues', leagueId, 'auditLog'), {
    action,
    adminUserId: actor.uid || '',
    reason,
    drawRevision,
    resetEntryCount: userEntriesSnap.size,
    startRoundSlotIds,
    createdAt: now
  });

  return {
    drawRevision,
    resetEntryCount: userEntriesSnap.size,
    startRoundSlotIds
  };
};

export const resetWimbledonLeagueToRoundOf32 = async (leagueId, actor = {}) => {
  const bundle = await fetchWimbledonBundle(leagueId);
  return resetLeagueToRoundOf32State(leagueId, bundle, actor, {
    action: 'trim-to-round-of32-reset',
    reason: String(actor.reason || '').trim() || 'Reset league to blank Round of 32 bracket',
    startRoundSlotIds: getStarterSlotIdsForRound(bundle.gameData || {}, 'roundOf32')
  });
};

export const importWimbledonRoundOf32Entrants = async (leagueId, importedRows, actor = {}) => {
  if (!Array.isArray(importedRows) || importedRows.length !== 32) {
    throw new Error('Round of 32 import requires exactly 32 rows');
  }

  const startRoundSlotIds = importedRows.map((row) => row.slotId).filter(Boolean);
  if (startRoundSlotIds.length !== 32 || new Set(startRoundSlotIds).size !== 32) {
    throw new Error('Round of 32 import requires 32 unique slot values');
  }

  const bundle = await fetchWimbledonBundle(leagueId);
  const entrantsBySlot = applyImportedEntrants(bundle.gameData?.entrantsBySlot || {}, importedRows);

  return resetLeagueToRoundOf32State(leagueId, bundle, actor, {
    action: 'round-of32-import-reset',
    reason: String(actor.reason || '').trim() || 'Imported Round of 32 field and reset league picks',
    startRoundSlotIds,
    entrantsBySlot
  });
};

export const saveOfficialWimbledonResults = async (leagueId, resultsByMatchId, actor = {}) => {
  const bundle = await fetchWimbledonBundle(leagueId);
  const previous = bundle.gameData?.officialResultsByMatchId || {};
  const sanitized = resolveDrawMatches(bundle.gameData, resultsByMatchId).predictionsByMatchId;
  const changedMatchIds = Object.keys(sanitized).filter(
    (matchId) => predictionsDiffer(previous[matchId], sanitized[matchId])
  );

  await updateDoc(doc(db, 'leagues', leagueId, 'gameData', 'current'), {
    officialResultsByMatchId: sanitized,
    status: getChampionSlotId(sanitized) ? 'completed' : 'inProgress',
    completedAt: getChampionSlotId(sanitized) ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString()
  });

  if (bundle.locks?.[WIMBLEDON_LOCK_KEY]?.locked && changedMatchIds.length) {
    await addDoc(collection(db, 'leagues', leagueId, 'auditLog'), {
      action: 'official-results-correction',
      adminUserId: actor.uid || '',
      reason: getAuditReason(actor, 'Official result update'),
      changedMatchIds,
      previousValues: Object.fromEntries(changedMatchIds.map((id) => [id, previous[id] || null])),
      newValues: Object.fromEntries(changedMatchIds.map((id) => [id, sanitized[id] || null])),
      drawRevision: Number(bundle.gameData?.drawRevision || 1),
      createdAt: new Date().toISOString()
    });
  }

  return sanitized;
};

export const saveAdminWimbledonCorrection = async (
  leagueId,
  targetUserId,
  picksByMatchId,
  actor = {}
) => {
  const bundle = await fetchWimbledonBundle(leagueId, targetUserId);
  const previous = bundle.entry?.picksByMatchId || {};
  const saved = await saveWimbledonEntry(leagueId, targetUserId, picksByMatchId, {
    adminOverride: true,
    user: { id: targetUserId }
  });
  const changedMatchIds = Object.keys(saved.picksByMatchId).filter(
    (matchId) => predictionsDiffer(previous[matchId], saved.picksByMatchId[matchId])
  );

  await addDoc(collection(db, 'leagues', leagueId, 'auditLog'), {
    action: 'user-bracket-correction',
    adminUserId: actor.uid || '',
    targetUserId,
    reason: getAuditReason(actor, 'Admin bracket correction'),
    changedMatchIds,
    previousValues: Object.fromEntries(changedMatchIds.map((id) => [id, previous[id] || null])),
    newValues: Object.fromEntries(changedMatchIds.map((id) => [id, saved.picksByMatchId[id] || null])),
    drawRevision: Number(bundle.gameData?.drawRevision || 1),
    createdAt: new Date().toISOString()
  });

  return saved;
};

export const removeWimbledonParticipant = async (leagueId, targetUserId, actor = {}) => {
  if (!targetUserId) {
    throw new Error('A participant is required');
  }

  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);

  if (!leagueSnap.exists()) {
    throw new Error('League not found');
  }

  const league = leagueSnap.data();
  const actorUserId = actor.uid || '';
  if (league.ownerId !== actorUserId && actor.isAdmin !== true) {
    throw new Error('You do not have permission to remove participants from this league');
  }

  if (league.ownerId === targetUserId) {
    throw new Error('Cannot remove the league owner');
  }

  if (actorUserId === targetUserId) {
    throw new Error('You cannot remove yourself from the league');
  }

  if (league.status === 'archived') {
    throw new Error('Cannot remove participants from an archived league');
  }

  const updates = {
    members: arrayRemove(targetUserId),
    userIds: arrayRemove(targetUserId),
    updatedAt: new Date().toISOString()
  };

  if (Array.isArray(league.users)) {
    updates.users = league.users.filter((user) => (
      typeof user === 'string' ? user !== targetUserId : user?.id !== targetUserId && user?.uid !== targetUserId
    ));
  }

  await Promise.all([
    deleteDoc(doc(db, 'leagues', leagueId, 'userData', targetUserId)),
    updateDoc(leagueRef, updates),
    addDoc(collection(db, 'leagues', leagueId, 'auditLog'), {
      action: 'participant-removed',
      adminUserId: actorUserId,
      targetUserId,
      targetUserName: actor.targetUserName || '',
      reason: actor.reason || 'Removed from Wimbledon participants admin',
      createdAt: new Date().toISOString()
    })
  ]);

  try {
    await updateDoc(doc(db, 'users', targetUserId), {
      leagueIds: arrayRemove(leagueId)
    });
  } catch (error) {
    console.warn('Unable to remove league from user profile after participant removal:', error);
  }

  return { success: true };
};

export const calculateWimbledonLeaderboard = async (leagueId) => {
  const bundle = await fetchWimbledonBundle(leagueId);
  const entriesSnap = await getDocs(collection(db, 'leagues', leagueId, 'userData'));
  const scores = entriesSnap.docs.map((entryDoc) => {
    const entry = entryDoc.data();
    return {
      userId: entryDoc.id,
      userName: entry.userName || 'Unknown User',
      completedPicks: countCompletedPredictions(entry.picksByMatchId || {}),
      ...calculateWimbledonScore(entry, bundle.gameData, bundle.scoring)
    };
  });
  const rankings = sortWimbledonScores(scores).map((entry, index) => ({ ...entry, rank: index + 1 }));

  await setDoc(doc(db, 'leagues', leagueId, 'leaderboard', 'current'), {
    rankings,
    updatedAt: new Date().toISOString()
  });
  return { rankings, ...bundle };
};

export const determineWimbledonLeagueWinners = async (leagueId) => {
  const { rankings, gameData } = await calculateWimbledonLeaderboard(leagueId);
  const finalResult = gameData?.officialResultsByMatchId?.['final-1'];
  if (!finalResult?.winnerSlotId || finalResult.completionReason === 'suspended') {
    throw new Error('The official final must be completed before ending the league');
  }
  if (!rankings.length) {
    return [];
  }
  const leader = rankings[0];
  return rankings
    .filter((entry) =>
      entry.score === leader.score &&
      entry.championCorrect === leader.championCorrect &&
      entry.finalistHits === leader.finalistHits &&
      entry.setPredictionHits === leader.setPredictionHits &&
      entry.correctPicks === leader.correctPicks
    )
    .map(({ userId, userName, score }) => ({ userId, userName, score }));
};
