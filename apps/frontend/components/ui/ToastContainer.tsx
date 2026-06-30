'use client';

import React from 'react';
import Toast from './Toast';
import { Toast as ToastType } from '@/app/contexts/ToastContext';

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
  onRemoveAll: () => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove, onRemoveAll }) => {
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.length >= 2 && (
        <div className="pointer-events-auto">
          <button
            onClick={onRemoveAll}
            className="w-full bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow-md hover:bg-gray-50 text-sm font-medium"
          >
            Dismiss all
          </button>
        </div>
      )}
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
