import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc, arrayUnion, getDoc } from "firebase/firestore";
// Use getAvailableGameTypes instead of getAllGameTypes
import { getAvailableGameTypes } from "../gameTypes";

function CreateLeague() {
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");
  const [gameTypes, setGameTypes] = useState([]);
  const [selectedGameType, setSelectedGameType] = useState("");
  const [loadingGameTypes, setLoadingGameTypes] = useState(true);
  const [isCreationBlocked, setIsCreationBlocked] = useState(false);
  const [isCheckingSettings, setIsCheckingSettings] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    // Check if league creation is blocked by admin
    const checkLeagueCreationSetting = async () => {
      try {
        const settingsRef = doc(db, "settings", "leagues");
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          setIsCreationBlocked(settings.blockCreation || false);
        }
      } catch (error) {
        console.error("Error checking league creation settings:", error);
      } finally {
        setIsCheckingSettings(false);
      }
    };

    checkLeagueCreationSetting();
  }, []);

  useEffect(() => {
    // Use getAvailableGameTypes instead of getAllGameTypes
    try {
      const types = getAvailableGameTypes();
      
      // Filter out disabled game types
      const enabledTypes = types.filter(type => type.enabled);
      setGameTypes(enabledTypes);
      
      if (enabledTypes.length > 0 && !selectedGameType) {
        setSelectedGameType(enabledTypes[0].id);
      }
      
      setLoadingGameTypes(false);
    } catch (error) {
      console.error("Error loading game types:", error);
      setError("Failed to load game types. Please try again later.");
      setLoadingGameTypes(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check again if league creation is blocked (in case setting changed during session)
    try {
      const settingsRef = doc(db, "settings", "leagues");
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists() && settingsDoc.data().blockCreation) {
        setIsCreationBlocked(true);
        setError("League creation is currently disabled by the administrator.");
        return;
      }
    } catch (error) {
      console.error("Error checking league creation settings:", error);
    }

    if (!user) {
      setError("You must be logged in to create a league.");
      return;
    }

    if (!selectedGameType) {
      setError("Please select a game type.");
      return;
    }

    try {
      const leagueRef = collection(db, "leagues");

      // Step 1: Create the league document without game data
      const newLeagueDoc = await addDoc(leagueRef, {
        title: leagueName,
        description: description || "",
        gameTypeId: selectedGameType,
        ownerId: user.uid,
        ownerName: user.displayName || user.email,
        createdBy: user.uid,
        createdAt: new Date(),
        users: [
          {
            id: user.uid,
            username: user.displayName || user.email,
            photoURL: user.photoURL || null
          }
        ],
        members: [user.uid],
        userIds: [user.uid]
      });

      // Step 2: Update the league with its generated ID
      await updateDoc(doc(db, "leagues", newLeagueDoc.id), {
        leagueId: newLeagueDoc.id,
      });

      // Step 3: Add the league ID to the user's document
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        leagueIds: arrayUnion(newLeagueDoc.id),
      });

      console.log("League created successfully:", newLeagueDoc.id);

      // Step 4: Redirect to the game-specific setup page
      navigate(`/leagues/${newLeagueDoc.id}/setup`);
    } catch (error) {
      console.error("Error creating league:", error);
      setError("Failed to create league. Please try again.");
    }
  };

  if (isCheckingSettings || loadingGameTypes) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (isCreationBlocked) {
    return (
      <div className="max-w-xl mx-auto p-6 bg-gray-800 text-white rounded-lg shadow-md mt-10 border border-red-700">
        <div className="text-center py-10">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <h1 className="text-2xl font-bold mb-4">League Creation Disabled</h1>
          <p className="text-gray-300 mb-6">
            League creation has been temporarily disabled by the administrator.
            Please check back later or contact support for more information.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-800 text-white rounded-lg shadow-md mt-10 border border-gray-700">
      <h1 className="text-2xl font-bold text-center mb-6">Create a New League</h1>
      
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">League Name:</label>
          <input
            type="text"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
            placeholder="Enter league name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description (optional):</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
            placeholder="Describe your league"
          ></textarea>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Game Type:</label>
          {gameTypes.length > 0 ? (
            <select
              value={selectedGameType}
              onChange={(e) => setSelectedGameType(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
            >
              <option value="">-- Select a Game Type --</option>
              {gameTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name || "Unnamed Game Type"}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-yellow-900/30 border border-yellow-700 text-yellow-300 rounded">
              No game types are currently available. Please check back later.
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={gameTypes.length === 0}
          className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create League
        </button>
      </form>
    </div>
  );
}

export default CreateLeague;