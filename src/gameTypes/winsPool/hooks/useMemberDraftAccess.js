import { useEffect, useState } from 'react';
import { isMemberDraftAccessCurrent, syncMemberDraftAccess } from '../services/draftEngine';

// Also upgrades an already-running draft when the commissioner opens either room.
export default function useMemberDraftAccess({ leagueId, league, gameData, isCommissioner }) {
  const [error, setError] = useState(null);
  const ready = isMemberDraftAccessCurrent(league, gameData);
  const needsSync = Boolean(isCommissioner && leagueId && league && gameData?.draft?.status === 'in_progress' && !ready);
  const revision = needsSync ? JSON.stringify([league.members, league.ownerId, gameData]) : null;
  useEffect(() => {
    if (!needsSync) return undefined;
    let active = true;
    setError(null);
    syncMemberDraftAccess({ leagueId }).catch((failure) => {
      console.error('[WinsPool][DraftAccess] Failed to prepare member turns:', failure);
      if (active) setError('Could not enable member picks. Reload the draft room to retry.');
    });
    return () => { active = false; };
  }, [leagueId, needsSync, revision]);
  return { ready, error };
}
