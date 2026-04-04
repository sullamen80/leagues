import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const getRequiredFirebaseEnv = (key) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required Firebase environment variable: ${key}`);
  }

  return value;
};

const firebaseConfig = {
  apiKey: getRequiredFirebaseEnv("REACT_APP_FIREBASE_API_KEY"),
  authDomain: getRequiredFirebaseEnv("REACT_APP_FIREBASE_AUTH_DOMAIN"),
  projectId: getRequiredFirebaseEnv("REACT_APP_FIREBASE_PROJECT_ID"),
  storageBucket: getRequiredFirebaseEnv("REACT_APP_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getRequiredFirebaseEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getRequiredFirebaseEnv("REACT_APP_FIREBASE_APP_ID"),
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || undefined
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics =
  typeof window !== "undefined" && firebaseConfig.measurementId
    ? getAnalytics(app)
    : null;

export { app, analytics, auth, db };
