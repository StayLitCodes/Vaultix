'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ArrowLeft } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from '@/utils/date';

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
  EXPIRATION_WARNING: '⚡',
};

const EVENT_LABELS: Record<string, string> = {
  ESCROW_CREATED: 'Escrow created',
  ESCROW_FUNDED: 'Escrow funded',
  MILESTONE_RELEASED: 'Milestone released',
  ESCROW_COMPLETED: 'Escrow completed',
  ESCROW_CANCELLED: 'Escrow cancelled',
  DISPUTE_RAISED: 'Dispute raised',
  DISPUTE_RESOLVED: 'Dispute resolved',
  ESCROW_EXPIRED: 'Escrow expired',
  CONDITION_FULFILLED: 'Condition fulfilled',
  EXPIRATION_WARNING: 'Escrow expiring soon',
};

const FILTER_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Unread', value: 'UNREAD' },
  { label: 'Escrow', value: 'ESCROW' },
  { label: 'Disputes', value: 'DISPUTE' },
];

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.readAt;
    if (filter === 'ESCROW') return n.eventType.startsWith('ESCROW');
    if (filter === 'DISPUTE') return n.eventType.startsWith('DISPUTE');
    return true;
  });

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-400" />
              Notifications
              {unreadCount > 0 && (
                <span className="text-sm font-normal bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
              <p className="text-sm">Loading notifications…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm mt-1 text-gray-500">
                {filter === 'UNREAD' ? 'All caught up!' : 'Nothing here yet.'}
              </p>
            </div>
          ) : (
            <>
              {paginated.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.escrowId ? `/escrow/${notification.escrowId}` : '/dashboard'}
                  onClick={() => { if (!notification.readAt) markAsRead(notification.id); }}
                  className={`flex items-start gap-3 px-5 py-4 border-b border-gray-800 hover:bg-gray-800 transition-colors last:border-0 ${
                    !notification.readAt ? 'bg-gray-800/40' : ''
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {EVENT_ICONS[notification.eventType] ?? '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {EVENT_LABELS[notification.eventType] ?? notification.eventType}
                    </p>
                    {notification.escrowId && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Escrow {notification.escrowId.slice(0, 8)}…
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt))}
                    </p>
                  </div>
                  {!notification.readAt && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </Link>
              ))}

              {hasMore && (
                <div className="p-4 text-center border-t border-gray-800">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Load more ({filtered.length - paginated.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
