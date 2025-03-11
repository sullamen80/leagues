import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';

const LeagueJoin = () => {
  const [leagues, setLeagues] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAvailableLeagues = async () => {
      try {
        setIsLoading(true);
        const leaguesCollection = collection(db, 'leagues');
        const leaguesSnapshot = await getDocs(leaguesCollection);
        
        const leaguesList = leaguesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setLeagues(leaguesList);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch available leagues');
        setIsLoading(false);
        console.error('Error fetching leagues:', err);
      }
    };

    fetchAvailableLeagues();
  }, []);

  const handleJoinLeague = async (leagueId) => {
    if (!currentUser) {
      setError('You must be logged in to join a league');
      return;
    }

    try {
      setIsLoading(true);
      
      // 1. Add user to league members and users arrays
      const leagueRef = doc(db, 'leagues', leagueId);
      
      // Get the league data to include in user info
      const leagueSnap = await getDoc(leagueRef);
      if (!leagueSnap.exists()) {
        throw new Error('League not found');
      }
      
      // Add user to the league
      await updateDoc(leagueRef, {
        members: arrayUnion(currentUser.uid),
        users: arrayUnion({
          id: currentUser.uid,
          username: currentUser.displayName || 'User',
          photoURL: currentUser.photoURL || null,
          role: 'member',
          joinedAt: Timestamp.now()
        }),
        updatedAt: Timestamp.now()
      });

      // 2. Add league to user's leagueIds array
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // Update existing user document
        await updateDoc(userRef, {
          leagueIds: arrayUnion(leagueId)
        });
      } else {
        // Create new user document if it doesn't exist
        await setDoc(userRef, {
          id: currentUser.uid,
          username: currentUser.displayName || 'User',
          email: currentUser.email,
          photoURL: currentUser.photoURL || null,
          leagueIds: [leagueId],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      navigate(`/league/${leagueId}`);
    } catch (err) {
      setError('Failed to join league: ' + err.message);
      console.error('Error joining league:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Join a League</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4">Loading leagues...</div>
      ) : (
        <div className="space-y-4">
          {leagues.length === 0 ? (
            <div className="text-gray-600 text-center py-4">
              No available leagues at the moment
            </div>
          ) : (
            leagues.map((league) => (
              <div 
                key={league.id} 
                className="border p-4 rounded-lg bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">{league.title}</h2>
                    {league.description && (
                      <p className="text-gray-600 text-sm">{league.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleJoinLeague(league.id)}
                    disabled={isLoading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    Join League
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LeagueJoin;