import React from 'react';
import { Monitor } from 'lucide-react';

const PreviewButton = ({ onClick, hasActiveApps = false }) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium
        transition-colors duration-200
        ${hasActiveApps 
          ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }
      `}
      title={hasActiveApps ? 'Preview available' : 'Open preview panel'}
    >
      <Monitor className="w-4 h-4" />
      <span>Preview</span>
      {hasActiveApps && (
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      )}
    </button>
  );
};

export default PreviewButton;