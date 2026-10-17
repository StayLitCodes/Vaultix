'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-16 z-50 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  );
}