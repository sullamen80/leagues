import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Create the auth context
const AuthContext = createContext(null);

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        try {
          // Fetch the user document directly by UID
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userDocData = userDoc.data();
            setUserData(userDocData);
            setIsSuperuser(userDocData.username === "superuser");
          } else {
            console.warn("No user data found in Firestore.");
            setUserData(null);
            setIsSuperuser(false);
          }
        } catch (error) {
          console.error("Error fetching Firestore data:", error);
          setUserData(null);
          setIsSuperuser(false);
        }
      } else {
        console.warn("No user is logged in.");
        setCurrentUser(null);
        setUserData(null);
        setIsSuperuser(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserData(null);
      setIsSuperuser(false);
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  };

  const value = {
    currentUser,
    userData,
    isSuperuser,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};