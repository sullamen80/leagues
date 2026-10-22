import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTION_KEYS, DRAFT_STATUS, GAME_DATA_DOCUMENTS } from '../constants/winsPoolConstants';
import { addParticipantChanges, removeParticipantChanges } from '../utils/participantChanges';

const getRefs = (leagueId, userId = null) => ({
  league: doc(db, 'leagues', leagueId),
  game: doc(db, 'leagues', leagueId, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT),
  roster: userId ? doc(db, 'leagues', leagueId, COLLECTION_KEYS.USER_DATA, userId) : null
});

const assertWinsPool = (league) => {
  if (!league || league.gameTypeId !== 'winsPool') {
    throw new Error('Wins Pool league not found.');
  }
};

export const findRegisteredUser = async (identifier) => {
  const value = identifier.trim();
  if (!value) throw new Error('Enter an email, username, or user ID.');

  const direct = await getDoc(doc(db, 'users', value));
  if (direct.exists()) return { ...direct.data(), id: direct.id };

  for (const field of ['email', 'username']) {
    const candidates = field === 'email'
      ? [...new Set([value, value.toLowerCase()])]
      : [value];
    for (const candidate of candidates) {
      const snapshot = await getDocs(query(collection(db, 'users'), where(field, '==', candidate)));
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        return { ...userDoc.data(), id: userDoc.id };
      }
    }
  }
  throw new Error('No registered user matched that email, username, or ID.');
};

export const addWinsPoolParticipant = async ({ leagueId, identifier }) => {
  const user = await findRegisteredUser(identifier);
  const refs = getRefs(leagueId, user.id);
  await runTransaction(db, async (transaction) => {
    const [leagueSnap, gameSnap] = await Promise.all([
      transaction.get(refs.league),
      transaction.get(refs.game)
    ]);
    const league = leagueSnap.data();
    assertWinsPool(league);
    if (!gameSnap.exists()) throw new Error('Set up the Wins Pool before adding participants.');

    const { leagueUpdates, gameUpdates, participant } = addParticipantChanges(league, gameSnap.data(), user);
    transaction.update(refs.league, { ...leagueUpdates, updatedAt: serverTimestamp() });
    if (Object.keys(gameUpdates).length) {
      transaction.update(refs.game, { ...gameUpdates, 'draft.updatedAt': serverTimestamp() });
    }
    transaction.set(refs.roster, {
      teams: [],
      totalWins: 0,
      pendingPicks: [],
      displayName: participant.displayName,
      username: participant.username,
      email: participant.email,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
  return user;
};

export const removeWinsPoolParticipant = async ({ leagueId, userId }) => {
  const refs = getRefs(leagueId, userId);
  let removedPickCount = 0;
  await runTransaction(db, async (transaction) => {
    const [leagueSnap, gameSnap] = await Promise.all([
      transaction.get(refs.league),
      transaction.get(refs.game)
    ]);
    const league = leagueSnap.data();
    assertWinsPool(league);
    if (!gameSnap.exists()) throw new Error('Wins Pool game data not found.');

    const changes = removeParticipantChanges(league, gameSnap.data(), userId);
    removedPickCount = changes.removedPickCount;
    const picksByManager = new Map();
    changes.gameUpdates['draft.picks'].forEach((pick) => {
      if (!pick.managerId || !pick.teamId) return;
      if (!picksByManager.has(pick.managerId)) picksByManager.set(pick.managerId, new Map());
      picksByManager.get(pick.managerId).set(pick.teamId, pick.pickNumber);
    });
    const survivingRosterRefs = [...picksByManager.keys()].map((managerId) => getRefs(leagueId, managerId).roster);
    const survivingRosters = await Promise.all(survivingRosterRefs.map((rosterRef) => transaction.get(rosterRef)));

    transaction.update(refs.league, { ...changes.leagueUpdates, updatedAt: serverTimestamp() });
    transaction.update(refs.game, {
      ...changes.gameUpdates,
      'draft.updatedAt': serverTimestamp(),
      ...(changes.gameUpdates['draft.status'] === DRAFT_STATUS.COMPLETED
        ? { 'draft.completedAt': serverTimestamp() }
        : {}),
      updatedAt: serverTimestamp()
    });
    transaction.delete(refs.roster);
    survivingRosters.forEach((rosterSnap) => {
      if (!rosterSnap.exists()) return;
      const pickNumbers = picksByManager.get(rosterSnap.id);
      const teams = Array.isArray(rosterSnap.data().teams) ? rosterSnap.data().teams : [];
      const updatedTeams = teams.map((team) => pickNumbers.has(team.id)
        ? { ...team, draftPickNumber: pickNumbers.get(team.id) }
        : team);
      if (updatedTeams.some((team, index) => team.draftPickNumber !== teams[index].draftPickNumber)) {
        transaction.update(rosterSnap.ref, { teams: updatedTeams, updatedAt: serverTimestamp() });
      }
    });
  });
  return { removedPickCount };
};
