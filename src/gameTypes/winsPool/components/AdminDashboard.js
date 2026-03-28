// src/gameTypes/winsPool/components/AdminDashboard.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FaArrowLeft, FaUsers, FaPlayCircle, FaLock, FaLockOpen, FaChartLine, FaCog, FaDraftingCompass, FaTrophy, FaDatabase, FaDownload, FaFlagCheckered } from 'react-icons/fa';
import AdminSettings from './AdminSettings';
import AdminDraftControlPanel from './AdminDraftControlPanel';
import AdminTeamWinsPanel from './AdminTeamWinsPanel';
import { COLLECTION_KEYS, GAME_DATA_DOCUMENTS, DRAFT_STATUS } from '../constants/winsPoolConstants';

const AdminDashboard = ({
  leagueId,
  urlParams = {},
  navigate: providedNavigate,
  baseUrl,
  module
}) => {
  const routerNavigate = useNavigate();
  const navigate = providedNavigate || routerNavigate;
  const location = useLocation();

  const goToUserDashboard = () => {
    if (!navigate) return;
    if (module) {
      navigate(module.generateParameterUrl(baseUrl || `/league/${leagueId}`));
      return;
    }
    if (baseUrl) {
      navigate(baseUrl);
      return;
    }
    if (leagueId) {
      navigate(`/league/${leagueId}`);
    }
  };
  const [activeSubview, setActiveSubview] = useState(urlParams.subview || '');
  const [gameData, setGameData] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  
  useEffect(() => {
    if (!leagueId) return;
    
    const gameDataRef = doc(db, 'leagues', leagueId, COLLECTION_KEYS.GAME_DATA, GAME_DATA_DOCUMENTS.CURRENT);
    const unsubscribe = onSnapshot(gameDataRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameData(snapshot.data());
      }
    });

    return () => unsubscribe();
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) return undefined;

    const userDataRef = collection(db, 'leagues', leagueId, COLLECTION_KEYS.USER_DATA);
    const unsubscribeParticipants = onSnapshot(
      userDataRef,
      async (snapshot) => {
        try {
          const users = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            return {
              id: docSnap.id,
              name:
                data.displayName ||
                data.username ||
                data.ownerName ||
                data.email ||
                docSnap.id
            };
          });

          let ownerId = null;
          let ownerName = null;
          try {
            const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
            if (leagueSnap.exists()) {
              const leagueData = leagueSnap.data() || {};
              ownerId = leagueData.ownerId || null;
              ownerName =
                leagueData.ownerDisplayName ||
                leagueData.ownerName ||
                null;
            }
          } catch (leagueErr) {
            console.warn('[WinsPool][AdminDashboard] Failed to load league owner:', leagueErr);
          }

          const participantMap = new Map();
          users.forEach((entry) => {
            participantMap.set(entry.id, entry);
          });

          if (ownerId && !participantMap.has(ownerId)) {
            let ownerDisplayName = ownerName;
            try {
              const ownerProfileSnap = await getDoc(doc(db, 'users', ownerId));
              if (ownerProfileSnap.exists()) {
                const ownerProfile = ownerProfileSnap.data() || {};
                ownerDisplayName =
                  ownerProfile.displayName ||
                  ownerProfile.username ||
                  ownerProfile.fullName ||
                  ownerDisplayName;
              }
            } catch (ownerProfileErr) {
              console.warn('[WinsPool][AdminDashboard] Failed to load owner profile:', ownerProfileErr);
            }

            participantMap.set(ownerId, {
              id: ownerId,
              name: ownerDisplayName || ownerId
            });
          }

          const participantList = Array.from(participantMap.values());
          setParticipantCount(Math.max(1, participantList.length));
        } catch (error) {
          console.error('[WinsPool][AdminDashboard] Failed to process participants:', error);
        }
      },
      (error) => {
        console.warn('[WinsPool][AdminDashboard] Failed to watch participants:', error);
      }
    );

    const visibilityRef = doc(db, 'leagues', leagueId, 'settings', 'visibility');
    getDoc(visibilityRef)
      .then((visibilitySnap) => {
        if (visibilitySnap.exists()) {
          setFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
        }
      })
      .catch((error) => {
        console.warn('[WinsPool][AdminDashboard] Failed to load visibility settings:', error);
      });

    return () => {
      unsubscribeParticipants();
    };
  }, [leagueId]);
  
  useEffect(() => {
    setActiveSubview(urlParams.subview || '');
  }, [urlParams.subview]);

  useEffect(() => {
    if (urlParams.subview === 'teamPools') {
      handleSubviewChange('settings', { settingsTab: 'teamPools' });
    } else if (urlParams.subview === 'scoring') {
      handleSubviewChange('settings', { settingsTab: 'scoring' });
    } else if (urlParams.subview === 'draft') {
      handleSubviewChange('settings', { settingsTab: 'draft' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams.subview]);
  
  const navigateToAdminRoot = (replace = true) => {
    if (!navigate) return;

    const targetBase = baseUrl || `/league/${leagueId}`;
    if (module && typeof module.getAdminUrl === 'function') {
      const url = module.getAdminUrl(targetBase, null);
      navigate(url, { replace });
      return;
    }

    const queryString = 'view=admin';
    const url = `${targetBase}?${queryString}`;
    navigate(url, { replace });
  };

  const handleSubviewChange = (subviewKey, extraParams = {}) => {
    const nextSubview = subviewKey || '';
    setActiveSubview(nextSubview);

    if (!nextSubview) {
      navigateToAdminRoot(true);
      return;
    }

    if (!navigate) return;

    const basePath = baseUrl || `/league/${leagueId}`;
    const searchParams = new URLSearchParams(location.search);

    searchParams.set('view', 'admin');
    searchParams.set('subview', nextSubview);
    if (nextSubview !== 'settings') {
      searchParams.delete('settingsTab');
    }

    Object.entries(extraParams || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        searchParams.delete(key);
      } else {
        searchParams.set(key, value);
      }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `${basePath}?${queryString}` : basePath;
    navigate(url, { replace: true });
  };

  const draftStatus = gameData?.draft?.status || DRAFT_STATUS.NOT_STARTED;
  const rosterLockLabel = draftStatus === DRAFT_STATUS.COMPLETED ? 'Locked' : 'Open';
  const draftStatusLabel = (() => {
    switch (draftStatus) {
      case DRAFT_STATUS.IN_PROGRESS:
        return 'In Progress';
      case DRAFT_STATUS.COMPLETED:
        return 'Completed';
      case DRAFT_STATUS.PAUSED:
        return 'Paused';
      default:
        return 'Not Started';
    }
  })();
  const leagueStatusLabel = (() => {
    switch (draftStatus) {
      case DRAFT_STATUS.COMPLETED:
        return 'In Season';
      case DRAFT_STATUS.IN_PROGRESS:
        return 'Drafting';
      case DRAFT_STATUS.PAUSED:
        return 'Paused';
      default:
        return 'Pre-Draft';
    }
  })();

  const metricCards = [
    {
      title: 'Players',
      value: participantCount,
      subtitle: 'Managers in this league',
      icon: <FaUsers className="text-indigo-500" />
    },
    {
      title: 'Draft Progress',
      value: draftStatusLabel,
      subtitle: `Status: ${draftStatusLabel}`,
      icon: <FaDraftingCompass className="text-green-500" />
    },
    {
      title: 'Roster Lock',
      value: rosterLockLabel,
      subtitle: `Status: ${rosterLockLabel}`,
      icon: rosterLockLabel === 'Locked' ? <FaLock className="text-amber-500" /> : <FaLockOpen className="text-amber-500" />
    },
    {
      title: 'League Status',
      value: leagueStatusLabel,
      subtitle: draftStatus === DRAFT_STATUS.COMPLETED ? 'Tracking wins' : draftStatus === DRAFT_STATUS.IN_PROGRESS ? 'Draft underway' : draftStatus === DRAFT_STATUS.PAUSED ? 'Draft paused' : 'Awaiting draft',
      icon: <FaChartLine className="text-purple-500" />
    }
  ];

  const adminActions = [
    {
      label: 'Draft',
      description: 'Manage draft order and make picks.',
      icon: <FaPlayCircle className="text-blue-500" />,
      action: () => handleSubviewChange('draftControl'),
      buttonText: 'Draft Console',
      buttonColor: 'bg-blue-600 hover:bg-blue-500'
    },
    {
      label: 'League Settings',
      description: 'Season, draft mode, teams per user, visibility.',
      icon: <FaCog className="text-indigo-500" />,
      action: () => handleSubviewChange('settings', { settingsTab: 'teamPools' }),
      buttonText: 'Settings',
      buttonColor: 'bg-indigo-600 hover:bg-indigo-500'
    },
    {
      label: 'Manage Participants',
      description: 'View and manage league members.',
      icon: <FaUsers className="text-green-500" />,
      action: () => setStatusMessage('Participant management is coming soon.'),
      buttonText: 'Participants',
      buttonColor: 'bg-green-600 hover:bg-green-500'
    },
    {
      label: 'Team Wins',
      description: 'Set team wins and results.',
      icon: <FaTrophy className="text-purple-500" />,
      action: () => handleSubviewChange('teamWins'),
      buttonText: 'Team Wins',
      buttonColor: 'bg-purple-600 hover:bg-purple-500'
    },
    {
      label: 'Stats & Analysis',
      description: 'Aggregate season stats and reports.',
      icon: <FaDatabase className="text-sky-500" />,
      action: () => handleSubviewChange('settings', { settingsTab: 'scoring' }),
      buttonText: 'Statistics',
      buttonColor: 'bg-pink-600 hover:bg-pink-500'
    },
    {
      label: 'Export Data',
      description: 'Download settings, game data, and rosters.',
      icon: <FaDownload className="text-blue-500" />,
      action: () => setStatusMessage('Export functionality coming soon.'),
      buttonText: 'Export All Data',
      buttonColor: 'bg-blue-600 hover:bg-blue-500'
    },
    {
      label: 'End League',
      description: 'Determine winners and archive.',
      icon: <FaFlagCheckered className="text-red-500" />,
      action: () => setStatusMessage('End league flow coming soon.'),
      buttonText: 'End League',
      buttonColor: 'bg-red-600 hover:bg-red-500'
    }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={goToUserDashboard}
            className="flex items-center text-gray-600 hover:text-indigo-600 transition text-sm"
          >
            <FaArrowLeft className="mr-2" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-semibold text-gray-800">Admin Dashboard</h1>
        </div>
        <button
          onClick={() => handleSubviewChange('settings', { settingsTab: 'teamPools' })}
          className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
        >
          <FaCog className="mr-2" /> Settings
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(card => (
          <div key={card.title} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-start gap-3">
            <div className="p-3 rounded-full bg-gray-50">
              {card.icon}
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">{card.title}</p>
              <h3 className="text-xl font-semibold text-gray-800">{card.value}</h3>
              <p className="text-sm text-gray-500">{card.subtitle}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Visibility Settings</h3>
            <p className="text-sm text-gray-500">Control whether managers can view other rosters.</p>
          </div>
          <button
            onClick={async () => {
              const visibilityRef = doc(db, 'leagues', leagueId, 'settings', 'visibility');
              await updateDoc(visibilityRef, { fogOfWarEnabled: !fogOfWarEnabled });
              setFogOfWarEnabled(prev => !prev);
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium ${fogOfWarEnabled ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'}`}
          >
            {fogOfWarEnabled ? 'Show Rosters' : 'Hide Other Rosters'}
          </button>
        </header>
        <div className="px-6 py-5 text-sm text-gray-600">
          When enabled, players can’t see other participants’ rosters and points until the regular season completes.
          Current status: <span className="font-semibold">{fogOfWarEnabled ? 'Enabled' : 'Disabled'}</span>.
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">Admin Actions</h3>
        </header>
        <div className="px-6 py-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminActions.map(action => (
            <div key={action.label} className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col justify-between">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 rounded-full bg-white shadow-sm">
                  {action.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">{action.label}</h4>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              </div>
              <button
                onClick={action.action}
                className={`mt-auto inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-white ${action.buttonColor}`}
              >
                {action.buttonText}
              </button>
            </div>
          ))}
        </div>
      </section>

      {statusMessage && (
        <div className="p-3 bg-blue-100 border border-blue-200 text-blue-700 rounded">
          {statusMessage}
        </div>
      )}
    </div>
  );

  if (activeSubview && activeSubview !== '') {
    if (activeSubview === 'settings') {
      return <AdminSettings />;
    }

    if (activeSubview === 'draftControl') {
      return (
        <AdminDraftControlPanel
          leagueId={leagueId}
          onBack={() => {
            setActiveSubview('');
            navigateToAdminRoot(true);
          }}
        />
      );
    }

    if (activeSubview === 'teamWins') {
      return (
        <AdminTeamWinsPanel
          leagueId={leagueId}
          onBack={() => {
            setActiveSubview('');
            navigateToAdminRoot(true);
          }}
        />
      );
    }

    return renderOverview();
  }

  return renderOverview();
}; 

export default AdminDashboard;
