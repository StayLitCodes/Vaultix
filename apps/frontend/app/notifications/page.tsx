'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ArrowLeft, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from '@/utils/date';
import { toast } from 'sonner';

const EVENT_ICONS: Record<string, string> = {
  ESCROW_CREATED: '📝',
  ESCROW_FUNDED: '💰',
  MILESTONE_RELEASED: '🎯',
  ESCROW_COMPLETED: '✅',
  ESCROW_CANCELLED: '❌',
  DISPUTE_RAISED: '⚠️',
  DISPUTE_RESOLVED: '✓',
  ESCROW_EXPIRED: '⏰',
  CONDITION_FULFILLED: '✔️',
  CONDITION_CONFIRMED: '👍',
  EXPIRATION_WARNING: '⚡',
};

const EVENT_LABELS: Record<string, string> = {
  ESCROW_CREATED: 'New escrow initialized',
  ESCROW_FUNDED: 'Funds successfully deposited',
  MILESTONE_RELEASED: 'Milestone funds released',
  ESCROW_COMPLETED: 'Escrow completed successfully',
  ESCROW_CANCELLED: 'Escrow contract cancelled',
  DISPUTE_RAISED: 'Conflict dispute raised',
  DISPUTE_RESOLVED: 'Conflict dispute resolved',
  ESCROW_EXPIRED: 'Escrow contract expired',
  CONDITION_FULFILLED: 'Condition fulfillment submitted',
  CONDITION_CONFIRMED: 'Condition confirmed',
  EXPIRATION_WARNING: 'Contract expiration warning',
};

const FILTER_OPTIONS = [
  { label: 'All notifications', value: 'ALL' },
  { label: 'Unread', value: 'UNREAD' },
  { label: 'Escrows', value: 'ESCROW' },
  { label: 'Disputes', value: 'DISPUTE' },
];

const PAGE_SIZE = 10;

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch } = useNotifications();
  const [filter, setFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Apply filters
  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.readAt;
    if (filter === 'ESCROW') return n.eventType.startsWith('ESCROW') || n.eventType.startsWith('CONDITION');
    if (filter === 'DISPUTE') return n.eventType.startsWith('DISPUTE');
    return true;
  });

  // Pagination calculations
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  
  useEffect(() => {
    // Reset to page 1 on filter change
    setCurrentPage(1);
  }, [filter]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success('All notifications marked as read');
  };

  const handleDismiss = (id: string) => {
    const currentDismissed = JSON.parse(localStorage.getItem('vaultix_dismissed_notifications') || '[]');
    localStorage.setItem('vaultix_dismissed_notifications', JSON.stringify([...currentDismissed, id]));
    refetch();
    toast.success('Notification dismissed');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div className="flex items-center gap-3.5">
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-lg bg-[#12121a] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Bell className="w-5.5 h-5.5 text-purple-400" />
                Notifications Center
                {unreadCount > 0 && (
                  <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-medium">
                    {unreadCount} unread
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-500 mt-1">Manage and track your smart contract events.</p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium px-4 py-2 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/15 rounded-lg transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filter === f.value
                  ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-lg shadow-purple-500/15'
                  : 'bg-[#12121a] border border-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Notifications List Container */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-3" />
              <p className="text-xs">Fetching event feed...</p>
            </div>
          ) : paginated.length === 0 ? (
            /* Empty State Illustration */
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto">
                <Bell className="w-7 h-7 text-purple-400/50" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">No notifications</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {filter === 'UNREAD'
                    ? 'All caught up! You have read all notifications in this category.'
                    : 'Nothing to see here. We will notify you when new escrow actions occur.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {paginated.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative flex items-start justify-between gap-4 p-5 hover:bg-white/[0.01] transition-all duration-200 ${
                    !notification.readAt ? 'bg-purple-950/5' : ''
                  }`}
                >
                  <Link
                    href={notification.escrowId ? `/escrow/${notification.escrowId}` : '/dashboard'}
                    onClick={() => {
                      if (!notification.readAt) handleMarkAsRead(notification.id);
                    }}
                    className="flex-1 flex gap-4 min-w-0"
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5 select-none">
                      {EVENT_ICONS[notification.eventType] ?? '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white">
                          {EVENT_LABELS[notification.eventType] ?? notification.eventType.replace(/_/g, ' ')}
                        </p>
                        {!notification.readAt && (
                          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      
                      {!!notification.payload?.message && (
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          {String(notification.payload.message)}
                        </p>
                      )}

                      {notification.escrowId && (
                        <p className="text-[10px] text-gray-500 mt-1.5">
                          Escrow ID: <span className="font-mono">{notification.escrowId.slice(0, 12)}...</span>
                        </p>
                      )}
                      
                      <p className="text-[10px] text-gray-600 mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt))}
                      </p>
                    </div>
                  </Link>

                  {/* Dismiss Button */}
                  <button
                    onClick={() => handleDismiss(notification.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer flex-shrink-0"
                    title="Dismiss notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500 px-1 pt-2">
            <span>
              Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg bg-[#12121a] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-white font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg bg-[#12121a] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
