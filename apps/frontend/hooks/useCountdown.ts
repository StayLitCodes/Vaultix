import { useState, useEffect, useRef, useCallback } from 'react';

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  urgency: 'green' | 'yellow' | 'red' | 'expired';
}

interface UseCountdownOptions {
  targetDate: Date | string | null;
  isPaused?: boolean;
  on24hWarning?: () => void;
  on1hWarning?: () => void;
}

export const calculateCountdown = (targetDate: Date, now: Date = new Date()): CountdownState => {
  const diff = targetDate.getTime() - now.getTime();
  const totalSeconds = Math.floor(diff / 1000);
  const isExpired = totalSeconds <= 0;

  let urgency: 'green' | 'yellow' | 'red' | 'expired';
  if (isExpired) {
    urgency = 'expired';
  } else if (totalSeconds < 24 * 60 * 60) {
    urgency = 'red';
  } else if (totalSeconds < 48 * 60 * 60) {
    urgency = 'yellow';
  } else {
    urgency = 'green';
  }

  const seconds = Math.max(0, Math.abs(totalSeconds) % 60);
  const minutes = Math.max(0, Math.floor(Math.abs(totalSeconds) / 60) % 60);
  const hours = Math.max(0, Math.floor(Math.abs(totalSeconds) / 3600) % 24);
  const days = Math.max(0, Math.floor(Math.abs(totalSeconds) / (3600 * 24)));

  return { days, hours, minutes, seconds, totalSeconds, isExpired, urgency };
};

export const useCountdown = ({ 
  targetDate, 
  isPaused = false, 
  on24hWarning, 
  on1hWarning 
}: UseCountdownOptions): CountdownState => {
  const [state, setState] = useState<CountdownState>(() => {
    if (!targetDate) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        isExpired: true,
        urgency: 'expired'
      };
    }
    return calculateCountdown(new Date(targetDate));
  });

  const warned24h = useRef(false);
  const warned1h = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateCountdown = useCallback(() => {
    if (!targetDate || isPaused) return;
    
    const target = new Date(targetDate);
    const newState = calculateCountdown(target);
    
    if (newState.totalSeconds <= 24 * 60 * 60 && newState.totalSeconds > 23 * 60 * 60 && !warned24h.current) {
      warned24h.current = true;
      on24hWarning?.();
    }
    
    if (newState.totalSeconds <= 60 * 60 && newState.totalSeconds > 59 * 60 && !warned1h.current) {
      warned1h.current = true;
      on1hWarning?.();
    }
    
    setState(newState);
  }, [targetDate, isPaused, on24hWarning, on1hWarning]);

  useEffect(() => {
    if (!targetDate || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    updateCountdown();

    const interval = state.totalSeconds < 3600 ? 1000 : 60000;
    intervalRef.current = setInterval(updateCountdown, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [targetDate, isPaused, updateCountdown, state.totalSeconds]);

  return state;
};
