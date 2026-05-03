'use client';

import React from 'react';
import { useToast } from '@/hooks/useToast';

/**
 * Example component demonstrating toast notification usage
 * This can be removed or used as reference
 */
const ToastExample: React.FC = () => {
  const toast = useToast();

  return (
    <div className="flex flex-wrap gap-3 p-4">
      <button
        onClick={() => toast.success('Operation completed successfully!')}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Show Success
      </button>
      
      <button
        onClick={() => toast.error('An error occurred. Please try again.')}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Show Error
      </button>
      
      <button
        onClick={() => toast.warning('This action cannot be undone.')}
        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
      >
        Show Warning
      </button>
      
      <button
        onClick={() => toast.info('New updates are available.')}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Show Info
      </button>
      
      <button
        onClick={() => toast.success('This will stay for 10 seconds', 10000)}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
      >
        Custom Duration (10s)
      </button>
    </div>
  );
};

export default ToastExample;
