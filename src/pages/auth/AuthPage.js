import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { collection, getDocs, query, where, setDoc, doc } from "firebase/firestore";
import logo from "../../assets/images/logo-no-background white.png";


// Pure Login Form Component
function LoginForm() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const navigate              = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful:", userCredential.user);
      navigate("/dashboard"); // Navigate to dashboard (or your desired route)
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password");
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
      >
        Log In
      </button>
      {error && <p className="text-red-600 text-center">{error}</p>}
    </form>
  );
}

// Pure Signup Form Component
function SignupForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [message, setMessage]   = useState("");
  const navigate              = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      // Check if the username already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setError("Username is already taken.");
        return;
      }
      // Create user in Firebase Authentication.
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      // Write the user data to Firestore.
      await setDoc(doc(db, "users", firebaseUser.uid), {
        username,
        email,
        createdAt: new Date(),
      });
      setMessage("Account created successfully!");
      setError("");
      navigate("/dashboard");
    } catch (err) {
      console.error("Error during signup:", err.message);
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSignup} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Username</label>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Password (6+ chars)</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
      >
        Sign Up
      </button>
      {message && <p className="text-green-600 text-center">{message}</p>}
      {error && <p className="text-red-600 text-center">{error}</p>}
    </form>
  );
}

// AuthPage Component that toggles between Login and Signup
function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const toggleAuthMode = () => setIsLogin((prev) => !prev);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 py-12 lg:px-8">
      {/* Header with Logo and Heading */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          alt="Leagues"
          src={logo}
          className="mx-auto h-10 w-auto"
        />
        <h2 className="mt-10 text-center text-2xl font-bold tracking-tight text-white">
          {isLogin ? "Sign in to your account" : "Sign up for an account"}
        </h2>
      </div>
      
      {/* Card with the Form and Footer Links */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md bg-white rounded-lg shadow p-8">
        {isLogin ? <LoginForm /> : <SignupForm />}
        <div className="mt-6 space-y-2 text-center">
          {isLogin ? (
            <div>
              <span className="text-gray-600 text-sm">Don't have an account?</span>
              <button
                type="button"
                onClick={toggleAuthMode}
                className="ml-2 text-indigo-600 text-sm font-medium hover:underline"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div>
              <span className="text-gray-600 text-sm">Already have an account?</span>
              <button
                type="button"
                onClick={toggleAuthMode}
                className="ml-2 text-indigo-600 text-sm font-medium hover:underline"
              >
                Log In
              </button>
            </div>
          )}
          <div>
            <span className="text-gray-600 text-sm">Forgot your password?</span>
            <button
              type="button"
              onClick={() => navigate("/reset-password")}
              className="ml-2 text-indigo-600 text-sm font-medium hover:underline"
            >
              Reset Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
