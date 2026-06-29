'use client';

import React, { useState } from 'react';
import { Bell, CheckCheck, X, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from '@/utils/date';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch } = useNotifications();

  // Limit to 10 most recent notifications in the dropdown
  const recentNotifications = notifications.slice(0, 10);

  // Group notifications by date
  const groupedNotifications = recentNotifications.reduce((acc, notification) => {
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

  const getEventMessage = (eventType: string) => {
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

  const handleNotificationClick = async (notificationId: string) => {
    const matched = notifications.find(n => n.id === notificationId);
    if (matched && !matched.readAt) {
      await markAsRead(notificationId);
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success('All notifications marked as read');
  };

  const handleDismissItem = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentDismissed = JSON.parse(localStorage.getItem('vaultix_dismissed_notifications') || '[]');
    localStorage.setItem('vaultix_dismissed_notifications', JSON.stringify([...currentDismissed, id]));
    refetch();
    toast.success('Notification dismissed');
  };

  return (
    <div className={`relative ${className}`}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5.5 h-5.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel with AnimatePresence slide-in */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-black/10 md:bg-transparent" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Panel (Full width on mobile, w-96 on desktop) */}
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed md:absolute right-0 left-0 md:left-auto top-16 md:top-auto mt-2 w-full md:w-96 bg-[#12121a] border border-white/5 md:rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white">Recent Notifications</h3>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* View all link */}
              <div className="px-4 py-2 border-b border-white/5 bg-white/[0.01]">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium flex items-center justify-between"
                >
                  <span>See all notifications</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Content */}
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-white/5">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-500">
                    <Loader2 className="animate-spin h-5 w-5 border-b-2 border-purple-500 mx-auto mb-2" />
                    <p className="text-xs">Loading notifications...</p>
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400" />
                    <p className="text-xs font-semibold text-white">No notifications yet</p>
                    <p className="text-[11px] mt-1">We&apos;ll notify you when there&apos;s something new</p>
                  </div>
                ) : (
                  Object.entries(groupedNotifications).map(([group, groupNotifications]) => (
                    <div key={group}>
                      <div className="px-4 py-1 bg-white/[0.02] border-b border-white/5">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                          {group}
                        </span>
                      </div>
                      {groupNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`relative group flex items-start justify-between gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors ${
                            !notification.readAt ? 'bg-purple-950/5' : ''
                          }`}
                        >
                          <Link
                            href={notification.escrowId ? `/escrow/${notification.escrowId}` : '/dashboard'}
                            onClick={() => handleNotificationClick(notification.id)}
                            className="flex-1 flex gap-3 min-w-0"
                          >
                            <span className="text-base flex-shrink-0 mt-0.5">
                              {getEventIcon(notification.eventType)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">
                                {getEventMessage(notification.eventType)}
                              </p>
                              {notification.escrowId && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  Escrow: {notification.escrowId.slice(0, 8)}...
                                </p>
                              )}
                              <p className="text-[9px] text-gray-600 mt-1">
                                {formatDistanceToNow(new Date(notification.createdAt))}
                              </p>
                            </div>
                            {!notification.readAt && (
                              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </Link>

                          {/* Per-item dismiss button */}
                          <button
                            onClick={(e) => handleDismissItem(e, notification.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white rounded transition-all cursor-pointer flex-shrink-0"
                            title="Dismiss notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
