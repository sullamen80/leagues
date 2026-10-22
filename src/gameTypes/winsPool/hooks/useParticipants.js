import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { buildParticipantRosters } from '../utils/participants';

export default function useParticipants(leagueId) {
  const [state, setState] = useState({});

  useEffect(() => {
    if (!leagueId) return undefined;
    setState({ leagueId, league: null, rosters: [], leagueReady: false, rostersReady: false });
    const fail = (error) => {
      console.error('[WinsPool][Participants] Failed to load membership:', error);
      setState((current) => ({ ...current, error }));
    };
    const unsubscribeLeague = onSnapshot(doc(db, 'leagues', leagueId), (snapshot) => {
      setState((current) => ({ ...current, league: snapshot.exists() ? snapshot.data() : null, leagueReady: true }));
    }, fail);
    const unsubscribeRosters = onSnapshot(collection(db, 'leagues', leagueId, 'userData'), (snapshot) => {
      const rosters = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
      setState((current) => ({ ...current, rosters, rostersReady: true }));
    }, fail);
    return () => { unsubscribeLeague(); unsubscribeRosters(); };
  }, [leagueId]);

  const current = state.leagueId === leagueId ? state : {};
  const participants = useMemo(() => buildParticipantRosters(current.league || {}, current.rosters), [current.league, current.rosters]);
  return {
    league: current.league,
    participants,
    loading: !current.error && !(current.leagueReady && current.rostersReady),
    error: current.error
  };
}
