'use client';

import React, { useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from '@/utils/date';
import Link from 'next/link';

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  // Group notifications by date
  const groupedNotifications = notifications.reduce((acc, notification) => {
    const date = new Date(notification.createdAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    let group = 'Earlier';
    if (date.toDateString() === now.toDateString()) {
      group = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = 'Yesterday';
    }

    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(notification);
    return acc;
  }, {} as Record<string, typeof notifications>);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'ESCROW_CREATED':
        return '📝';
      case 'ESCROW_FUNDED':
        return '💰';
      case 'MILESTONE_RELEASED':
        return '🎯';
      case 'ESCROW_COMPLETED':
        return '✅';
      case 'ESCROW_CANCELLED':
        return '❌';
      case 'DISPUTE_RAISED':
        return '⚠️';
      case 'DISPUTE_RESOLVED':
        return '✓';
      case 'ESCROW_EXPIRED':
        return '⏰';
      case 'CONDITION_FULFILLED':
        return '✔️';
      case 'CONDITION_CONFIRMED':
        return '👍';
      case 'EXPIRATION_WARNING':
        return '⚡';
      default:
        return '🔔';
    }
  };

  const getEventMessage = (eventType: string, payload: Record<string, unknown>) => {
    const messages: Record<string, string> = {
      ESCROW_CREATED: 'New escrow created',
      ESCROW_FUNDED: 'Escrow has been funded',
      MILESTONE_RELEASED: 'Milestone released',
      ESCROW_COMPLETED: 'Escrow completed successfully',
      ESCROW_CANCELLED: 'Escrow cancelled',
      DISPUTE_RAISED: 'Dispute raised',
      DISPUTE_RESOLVED: 'Dispute resolved',
      ESCROW_EXPIRED: 'Escrow expired',
      CONDITION_FULFILLED: 'Condition fulfilled',
      CONDITION_CONFIRMED: 'Condition confirmed',
      EXPIRATION_WARNING: 'Escrow expiring soon',
    };
    return messages[eventType] || 'Notification';
  };

  const handleNotificationClick = async (notificationId: string, escrowId?: string) => {
    if (!notifications.find(n => n.id === notificationId)?.readAt) {
      await markAsRead(notificationId);
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Footer — see all */}
            <div className="px-4 py-2 border-b border-gray-700">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                See all notifications →
              </Link>
            </div>

            {/* Content */}
            <div className="max-h-[70vh] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                  <p className="text-sm mt-1">We&apos;ll notify you when there&apos;s something new</p>
                </div>
              ) : (
                Object.entries(groupedNotifications).map(([group, groupNotifications]) => (
                  <div key={group}>
                    <div className="px-4 py-2 bg-gray-800/50 border-y border-gray-700">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group}
                      </h4>
                    </div>
                    {groupNotifications.map((notification) => (
                      <Link
                        key={notification.id}
                        href={notification.escrowId ? `/escrow/${notification.escrowId}` : '/dashboard'}
                        onClick={() => handleNotificationClick(notification.id, notification.escrowId)}
                        className={`block px-4 py-3 border-b border-gray-700 hover:bg-gray-800 transition-colors ${
                          !notification.readAt ? 'bg-gray-800/30' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{getEventIcon(notification.eventType)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {getEventMessage(notification.eventType, notification.payload)}
                            </p>
                            {notification.escrowId && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Escrow: {notification.escrowId.slice(0, 8)}...
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(notification.createdAt))}
                            </p>
                          </div>
                          {!notification.readAt && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
