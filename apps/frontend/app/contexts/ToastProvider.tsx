'use client';

import React, { useState, useCallback, useRef } from 'react';
import ToastContext, { Toast, ToastType, ToastAction } from './ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';

const MAX_VISIBLE_TOASTS = 3;
const DEDUPLICATION_WINDOW = 5000; // 5 seconds

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<Toast[]>([]);
  const recentMessagesRef = useRef<{ message: string; timestamp: number }[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => {
      const remaining = prev.filter((toast) => toast.id !== id);
      
      // If there are toasts in the queue, move one to visible
      if (remaining.length < MAX_VISIBLE_TOASTS && queue.length > 0) {
        setQueue((q) => {
          const [nextToast, ...restQueue] = q;
          setToasts([...remaining, nextToast]);
          
          // Start auto-dismiss for the new toast
          if (nextToast.duration !== undefined && nextToast.duration > 0) {
            setTimeout(() => {
              removeToast(nextToast.id);
            }, nextToast.duration);
          }
          return restQueue;
        });
      }
      return remaining;
    });
  }, [queue]);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
    setQueue([]);
  }, []);

  const addToast = useCallback((
    message: string, 
    type: ToastType, 
    duration?: number, 
    action?: ToastAction
  ) => {
    // Deduplication
    const now = Date.now();
    const isDuplicate = recentMessagesRef.current.some(
      (entry) => entry.message === message && now - entry.timestamp < DEDUPLICATION_WINDOW
    );
    
    if (isDuplicate) {
      return;
    }

    // Add to recent messages
    recentMessagesRef.current.push({ message, timestamp: now });
    // Clean up old entries
    recentMessagesRef.current = recentMessagesRef.current.filter(
      (entry) => now - entry.timestamp < DEDUPLICATION_WINDOW
    );

    const id = Math.random().toString(36).substring(2, 9);
    
    // Determine default duration
    let actualDuration = duration;
    if (actualDuration === undefined) {
      actualDuration = type === 'error' ? 0 : 5000; // error is persistent
    }

    const newToast: Toast = { id, message, type, duration: actualDuration, action };
    
    // Add to visible or queue
    setToasts((prev) => {
      if (prev.length < MAX_VISIBLE_TOASTS) {
        // Start auto-dismiss
        if (actualDuration > 0) {
          setTimeout(() => {
            removeToast(id);
          }, actualDuration);
        }
        return [...prev, newToast];
      } else {
        setQueue((q) => [...q, newToast]);
        return prev;
      }
    });
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, removeAllToasts }}>
      {children}
      <ToastContainer 
        toasts={toasts} 
        onRemove={removeToast} 
        onRemoveAll={removeAllToasts} 
      />
    </ToastContext.Provider>
  );
}
