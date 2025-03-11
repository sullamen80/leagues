// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";



// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCUM2y4y2sWdiFJfkAvIBHTOnk1jOoqsag",
  authDomain: "leagues-28a9a.firebaseapp.com",
  projectId: "leagues-28a9a",
  storageBucket: "leagues-28a9a.firebasestorage.app",
  messagingSenderId: "1002368090725",
  appId: "1:1002368090725:web:39c216bfd42f66652f3c8c",
  measurementId: "G-D5QVKEEZDX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// **Add this line to initialize Firestore**
const db = getFirestore(app);

// Export them all if needed
export { app, analytics, auth, db };

