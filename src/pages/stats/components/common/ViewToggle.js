// src/pages/stats/components/common/ViewToggle.js
import React from 'react';
import { classNames } from '../../../../utils/formatters';

/**
 * Toggle between different stats views (league or user)
 */
const ViewToggle = ({ activeView, onChange }) => {
  return (
    <div className="flex border border-gray-300 rounded-md p-1 w-fit">
      <button
        type="button"
        className={classNames(
          'px-4 py-2 text-sm font-medium rounded-md',
          activeView === 'league'
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        )}
        onClick={() => onChange('league')}
      >
        League Stats
      </button>
      <button
        type="button"
        className={classNames(
          'px-4 py-2 text-sm font-medium rounded-md',
          activeView === 'user'
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        )}
        onClick={() => onChange('user')}
      >
        User Stats
      </button>
    </div>
  );
};

export default ViewToggle;