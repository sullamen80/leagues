import React from 'react';
import { Link } from 'react-router-dom';
import { getColorClass } from '../styles/tokens/colors';
import { classNames } from '../utils/formatters';

/**
 * 404 Not Found page
 */
const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className={classNames("text-6xl font-bold mb-4", getColorClass('primary', '500', 'text'))}>
        404
      </div>
      <h1 className="text-2xl font-semibold mb-4">Page Not Found</h1>
      <p className={classNames("mb-8 text-center max-w-md", getColorClass('text', 'secondary', 'text'))}>
        The page you are looking for might have been removed, had its name changed,
        or is temporarily unavailable.
      </p>
      <Link 
        to="/"
        className={classNames(
          "px-4 py-2 rounded transition", 
          getColorClass('primary', '600', 'bg'), 
          getColorClass('primary', '700', 'hover:bg'),
          "text-white"
        )}
      >
        Return to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;