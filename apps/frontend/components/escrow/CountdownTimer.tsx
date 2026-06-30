import React, { useCallback } from 'react';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import { useToast } from '@/hooks/useToast';
import { IEscrowExtended } from '@/types/escrow';
import { expireEscrow } from '@/lib/escrow-api';

interface CountdownTimerProps {
  escrow: IEscrowExtended;
  isPaused?: boolean;
  onRefundSuccess?: () => void;
  userRole?: 'creator' | 'counterparty' | 'arbitrator' | null;
}

const getUrgencyColorClass = (urgency: string) => {
  switch (urgency) {
    case 'green':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
    case 'red':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
    case 'expired':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200 dark:border-gray-700';
  }
};

const CountdownTimer: React.FC<CountdownTimerProps> = ({ 
  escrow, 
  isPaused = false, 
  onRefundSuccess,
  userRole
}) => {
  const { success, error, warning } = useToast();
  const deadline = escrow.expiresAt || escrow.deadline;

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const showNotification = useCallback((title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, { body });
  }, []);

  const countdown = useCountdown({
    targetDate: deadline,
    isPaused,
    on24hWarning: () => {
      requestNotificationPermission();
      showNotification('Escrow Expiring Soon', `Escrow "${escrow.title}" will expire in 24 hours!`);
      warning('Escrow will expire in 24 hours!');
    },
    on1hWarning: () => {
      requestNotificationPermission();
      showNotification('Escrow Expiring Soon', `Escrow "${escrow.title}" will expire in 1 hour!`);
      error('Escrow will expire in 1 hour!');
    }
  });

  const handleRequestRefund = useCallback(async () => {
    try {
      await expireEscrow(escrow.id, { reason: 'Manual refund request after expiration' });
      success('Refund request submitted successfully!');
      onRefundSuccess?.();
    } catch (err: any) {
      console.error('Refund request failed:', err);
      error(err.message || 'Failed to submit refund request');
    }
  }, [escrow.id, success, error, onRefundSuccess]);

  const formatDateWithTimezone = () => {
    const date = new Date(deadline);
    return date.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (!deadline) return null;

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-xl border ${getUrgencyColorClass(countdown.urgency)}`}>
      <div className="flex items-center gap-2">
        {countdown.isExpired ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
        <span className="font-semibold text-sm">
          {countdown.isExpired ? 'Escrow Expired' : 'Time Remaining'}
        </span>
      </div>

      {!countdown.isExpired && !isPaused ? (
        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{String(countdown.days).padStart(2, '0')}</span>
            <span className="text-xs font-medium">d</span>
          </div>
          <span className="text-lg font-bold">:</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{String(countdown.hours).padStart(2, '0')}</span>
            <span className="text-xs font-medium">h</span>
          </div>
          <span className="text-lg font-bold">:</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{String(countdown.minutes).padStart(2, '0')}</span>
            <span className="text-xs font-medium">m</span>
          </div>
          {countdown.totalSeconds < 3600 && (
            <>
              <span className="text-lg font-bold">:</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{String(countdown.seconds).padStart(2, '0')}</span>
                <span className="text-xs font-medium">s</span>
              </div>
            </>
          )}
        </div>
      ) : null}

      {isPaused && !countdown.isExpired ? (
        <div className="text-sm font-medium">
          Countdown paused (escrow is in dispute)
        </div>
      ) : null}

      {countdown.isExpired && userRole && ['creator', 'counterparty'].includes(userRole) && (
        <button
          onClick={handleRequestRefund}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Request Refund
        </button>
      )}

      <div className="text-xs opacity-75">
        {formatDateWithTimezone()}
      </div>
    </div>
  );
};

export default CountdownTimer;
