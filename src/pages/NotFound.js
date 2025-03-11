import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 404 Not Found page
 */
const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-6xl font-bold text-indigo-500 mb-4">404</div>
      <h1 className="text-2xl font-semibold mb-4">Page Not Found</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        The page you are looking for might have been removed, had its name changed,
        or is temporarily unavailable.
      </p>
      <Link 
        to="/"
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
      >
        Return to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;