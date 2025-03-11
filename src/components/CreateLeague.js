// src/components/CreateLeague.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc, arrayUnion } from "firebase/firestore";
// Use getAvailableGameTypes instead of getAllGameTypes
import { getAvailableGameTypes } from "../gameTypes";

function CreateLeague() {
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");
  const [gameTypes, setGameTypes] = useState([]);
  const [selectedGameType, setSelectedGameType] = useState("");
  const [loadingGameTypes, setLoadingGameTypes] = useState(true);

  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    // Use getAvailableGameTypes instead of getAllGameTypes
    try {
      const types = getAvailableGameTypes();
      setGameTypes(types);
      setLoadingGameTypes(false);
    } catch (error) {
      console.error("Error loading game types:", error);
      setLoadingGameTypes(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("You must be logged in to create a league.");
      return;
    }

    if (!selectedGameType) {
      alert("Please select a game type.");
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
        createdBy: user.uid,
        createdAt: new Date(),
        users: [
          {
            id: user.uid,
            username: user.displayName || "User",
            photoURL: user.photoURL || null
          }
        ],
        members: [user.uid]
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
      alert("Failed to create league. Please try again.");
    }
  };

  if (loadingGameTypes) {
    return <div className="text-center py-10">Loading game types...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-50 rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold text-center mb-6">Create a New League</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Game Type:</label>
          <select
            value={selectedGameType}
            onChange={(e) => setSelectedGameType(e.target.value)}
            required
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">-- Select a Game Type --</option>
            {gameTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name || "Unnamed Game Type"}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition"
        >
          Create League
        </button>
      </form>
    </div>
  );
}

// Make sure to export the component as default
export default CreateLeague;