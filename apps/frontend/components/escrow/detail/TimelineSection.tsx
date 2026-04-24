'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { IEscrowExtended, IEscrowEvent } from '@/types/escrow';

interface TimelineSectionProps {
  escrow: IEscrowExtended;
}

const STELLAR_EXPLORER_BASE = 'https://stellar.expert/explorer/testnet/account';

const PAGE_SIZE = 5;

const POLL_INTERVAL_MS = 30_000;

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const EVENT_META: Record<string, { bg: string; ring: string; badge: string; label: string; iconPath: string }> = {
  CREATED:            { bg: 'bg-blue-500',   ring: 'ring-blue-100',   badge: 'bg-blue-50 text-blue-700',   label: 'Escrow created',            iconPath: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  FUNDED:             { bg: 'bg-green-500',  ring: 'ring-green-100',  badge: 'bg-green-50 text-green-700', label: 'Escrow funded',             iconPath: 'M5 13l4 4L19 7' },
  MILESTONE_RELEASED: { bg: 'bg-teal-500',   ring: 'ring-teal-100',   badge: 'bg-teal-50 text-teal-700',   label: 'Milestone released',        iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  DISPUTED:           { bg: 'bg-orange-500', ring: 'ring-orange-100', badge: 'bg-orange-50 text-orange-700', label: 'Dispute raised',           iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  RESOLVED:           { bg: 'bg-indigo-500', ring: 'ring-indigo-100', badge: 'bg-indigo-50 text-indigo-700', label: 'Dispute resolved',         iconPath: 'M5 13l4 4L19 7' },
  EXPIRED:            { bg: 'bg-gray-400',   ring: 'ring-gray-100',   badge: 'bg-gray-50 text-gray-600',   label: 'Escrow expired',            iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  CANCELLED:          { bg: 'bg-red-500',    ring: 'ring-red-100',    badge: 'bg-red-50 text-red-700',     label: 'Escrow cancelled',          iconPath: 'M6 18L18 6M6 6l12 12' },
  CONDITION_MET:      { bg: 'bg-yellow-500', ring: 'ring-yellow-100', badge: 'bg-yellow-50 text-yellow-700', label: 'Condition met',           iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  PARTY_ACCEPTED:     { bg: 'bg-purple-500', ring: 'ring-purple-100', badge: 'bg-purple-50 text-purple-700', label: 'Party accepted',          iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  COMPLETED:          { bg: 'bg-purple-600', ring: 'ring-purple-100', badge: 'bg-purple-50 text-purple-700', label: 'Escrow completed',        iconPath: 'M5 13l4 4L19 7' },
};

const DEFAULT_META = { bg: 'bg-gray-500', ring: 'ring-gray-100', badge: 'bg-gray-50 text-gray-700', label: '', iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };

function EventIcon({ eventType }: { eventType: string }) {
  const meta = EVENT_META[eventType] ?? DEFAULT_META;
  return (
    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${meta.bg} ring-4 ${meta.ring}`}>
      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={meta.iconPath} />
      </svg>
    </span>
  );
}

function EventRow({ event, isLast }: { event: IEscrowEvent; isLast: boolean }) {
  const meta = EVENT_META[event.eventType] ?? DEFAULT_META;
  const label = meta.label || event.eventType.replace(/_/g, ' ').toLowerCase();

  return (
    <li>
      <div className="relative pb-7">
        {!isLast && (
          <span className="absolute top-3.5 left-3.5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
        )}
        <div className="relative flex items-start space-x-3">
          <EventIcon eventType={event.eventType} />
          <div className="min-w-0 flex-1 flex justify-between space-x-4">
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                {event.eventType.replace(/_/g, ' ')}
              </span>
              <p className="mt-0.5 text-sm text-gray-700">{label}</p>
              {event.actorId && (
                <a
                  href={`${STELLAR_EXPLORER_BASE}/${event.actorId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 text-xs text-blue-500 hover:underline font-mono"
                >
                  {truncateAddress(event.actorId)}
                </a>
              )}
            </div>
            <time
              className="whitespace-nowrap text-xs text-gray-400 pt-0.5"
              title={new Date(event.createdAt).toLocaleString()}
            >
              {relativeTime(event.createdAt)}
            </time>
          </div>
        </div>
      </div>
    </li>
  );
}

const TimelineSection: React.FC<TimelineSectionProps> = ({ escrow }) => {
  const [allEvents, setAllEvents] = useState<IEscrowEvent[]>(() =>
    [...(escrow.events ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sync when escrow prop updates and poll for new events via parent refetch
  useEffect(() => {
    setAllEvents(
      [...(escrow.events ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  }, [escrow.events]);

  // Shallow polling: re-sort whenever escrow.events reference changes
  useEffect(() => {
    const id = setInterval(() => {
      setAllEvents((prev) => [...prev]); // trigger relative-time re-render
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const visible = allEvents.slice(0, visibleCount);
  const hasMore = visibleCount < allEvents.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Timeline</h2>

      {allEvents.length === 0 ? (
        <p className="text-gray-500 italic text-sm">No events recorded yet.</p>
      ) : (
        <>
          <div className="flow-root">
            <ul className="-mb-6">
              {visible.map((event, index) => (
                <EventRow key={event.id} event={event} isLast={index === visible.length - 1 && !hasMore} />
              ))}
            </ul>
          </div>

          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Load more ({allEvents.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default TimelineSection;
