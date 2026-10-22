import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { FaArrowLeft } from 'react-icons/fa';
import { db, auth } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useUrlParams } from '../../common/BaseGameModule';
import BracketEdit from './BracketEdit';
import UserPlayInPanel from './UserPlayInPanel';
import { ROUND_KEYS } from '../constants/playoffConstants';

const AdminUserBracketEditor = ({ leagueId }) => {
  const params = useUrlParams();
  const targetUserId = params.targetUser || '';
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin: hasGlobalAdminAccess } = useAuth();

  const [activeEditorTab, setActiveEditorTab] = useState('bracket');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [userBracket, setUserBracket] = useState(null);

  const goBack = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', 'admin');
    searchParams.set('subview', 'teams');
    searchParams.delete('targetUser');
    navigate(`${location.pathname}?${searchParams.toString()}`);
  }, [location, navigate]);

  useEffect(() => {
    const loadEditorContext = async () => {
      if (!leagueId || !targetUserId) {
        setError('Missing league or target user.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
        if (!leagueSnap.exists()) {
          setError('League not found.');
          setLoading(false);
          return;
        }

        const leagueData = leagueSnap.data();
        const currentUserId = auth.currentUser?.uid;
        const canManageLeague =
          leagueData.ownerId === currentUserId || hasGlobalAdminAccess;

        if (!canManageLeague) {
          setError("You don't have permission to edit other users' brackets.");
          setLoading(false);
          return;
        }

        const [userSnap, gameDataSnap, userBracketSnap] = await Promise.all([
          getDoc(doc(db, 'users', targetUserId)),
          getDoc(doc(db, 'leagues', leagueId, 'gameData', 'current')),
          getDoc(doc(db, 'leagues', leagueId, 'userData', targetUserId))
        ]);

        setUserInfo(userSnap.exists() ? userSnap.data() : null);
        setGameData(gameDataSnap.exists() ? gameDataSnap.data() : null);
        setUserBracket(userBracketSnap.exists() ? userBracketSnap.data() : null);
        setLoading(false);
      } catch (err) {
        console.error('Error loading admin bracket editor:', err);
        setError(err.message || 'Failed to load bracket editor.');
        setLoading(false);
      }
    };

    loadEditorContext();
  }, [leagueId, targetUserId, hasGlobalAdminAccess]);

  const handleUpdatePlayInBracket = useCallback((updatedBracket) => {
    setUserBracket((prev) => ({
      ...(prev || {}),
      ...updatedBracket
    }));
  }, []);

  const playInEnabled = Boolean(
    gameData?.playInTournamentEnabled || gameData?.[ROUND_KEYS.PLAY_IN]
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-center text-gray-600">Loading bracket editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow">
        <button
          onClick={goBack}
          className="flex items-center text-gray-600 hover:text-indigo-600 mb-4"
        >
          <FaArrowLeft className="mr-2" /> Back to Participants
        </button>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={goBack}
            className="flex items-center text-gray-600 hover:text-indigo-600"
          >
            <FaArrowLeft className="mr-2" /> Back to Participants
          </button>
          <div>
            <div className="text-sm text-gray-500">Editing bracket for</div>
            <div className="text-lg font-semibold text-gray-800">
              {userInfo?.displayName || userInfo?.username || userInfo?.email || targetUserId}
            </div>
            <div className="text-sm text-gray-500">
              Admin edits bypass bracket locks for this user.
            </div>
          </div>
        </div>
      </div>

      {playInEnabled && (
        <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setActiveEditorTab('bracket')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeEditorTab === 'bracket'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 hover:bg-white'
              }`}
            >
              Bracket
            </button>
            <button
              type="button"
              onClick={() => setActiveEditorTab('play-in')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeEditorTab === 'play-in'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 hover:bg-white'
              }`}
            >
              Play-In
            </button>
          </div>
        </div>
      )}

      {activeEditorTab === 'play-in' && playInEnabled ? (
        <UserPlayInPanel
          gameData={gameData}
          userBracket={userBracket}
          onUpdateBracket={handleUpdatePlayInBracket}
          isLocked={false}
          showResults={false}
          leagueId={leagueId}
          targetUserId={targetUserId}
        />
      ) : (
        <BracketEdit
          isEmbedded
          leagueId={leagueId}
          hideBackButton
          entryId={targetUserId}
          allowLockedEdits
        />
      )}
    </div>
  );
};

export default AdminUserBracketEditor;
