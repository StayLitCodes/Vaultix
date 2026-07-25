'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { IEscrowEvent, EscrowEventType } from '@/types/escrow';
import { useEscrowTimeline } from '@/hooks/useEscrowTimeline';
import { Skeleton } from '@/components/ui/Skeleton';

// ── Types ──────────────────────────────────────────────────────────────────

interface PendingStep {
  key: string;
  label: string;
}

interface EventMeta {
  bg: string;
  ring: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  icon: React.ReactNode;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STELLAR_EXPLORER = 'https://stellar.expert/explorer/testnet/account';

const TERMINAL_STATUSES = new Set([
  'COMPLETED', 'completed',
  'CANCELLED', 'cancelled',
  'EXPIRED',   'expired',
]);

const SVG = (d: string) => (
  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={d} />
  </svg>
);

const EVENT_META: Record<string, EventMeta> = {
  CREATED:            { bg: 'bg-blue-500',   ring: 'ring-blue-200 dark:ring-blue-900/50',   badgeBg: 'bg-blue-50 dark:bg-blue-950',   badgeText: 'text-blue-700 dark:text-blue-300',   label: 'Escrow created',         icon: SVG('M12 6v6m0 0v6m0-6h6m-6 0H6') },
  UPDATED:            { bg: 'bg-sky-500',    ring: 'ring-sky-200 dark:ring-sky-900/50',     badgeBg: 'bg-sky-50 dark:bg-sky-950',     badgeText: 'text-sky-700 dark:text-sky-300',     label: 'Escrow updated',         icon: SVG('M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15') },
  FUNDED:             { bg: 'bg-emerald-500',ring: 'ring-emerald-200 dark:ring-emerald-900/50', badgeBg: 'bg-emerald-50 dark:bg-emerald-950', badgeText: 'text-emerald-700 dark:text-emerald-300', label: 'Funds deposited',     icon: SVG('M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z') },
  PARTY_ACCEPTED:     { bg: 'bg-violet-500', ring: 'ring-violet-200 dark:ring-violet-900/50', badgeBg: 'bg-violet-50 dark:bg-violet-950', badgeText: 'text-violet-700 dark:text-violet-300', label: 'Party accepted',       icon: SVG('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z') },
  PARTY_REJECTED:     { bg: 'bg-rose-400',   ring: 'ring-rose-200 dark:ring-rose-900/50',   badgeBg: 'bg-rose-50 dark:bg-rose-950',   badgeText: 'text-rose-700 dark:text-rose-300',   label: 'Party rejected',         icon: SVG('M6 18L18 6M6 6l12 12') },
  PARTY_ADDED:        { bg: 'bg-purple-400', ring: 'ring-purple-200 dark:ring-purple-900/50', badgeBg: 'bg-purple-50 dark:bg-purple-950', badgeText: 'text-purple-700 dark:text-purple-300', label: 'Party added',          icon: SVG('M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z') },
  CONDITION_FULFILLED:{ bg: 'bg-yellow-500', ring: 'ring-yellow-200 dark:ring-yellow-900/50', badgeBg: 'bg-yellow-50 dark:bg-yellow-950', badgeText: 'text-yellow-700 dark:text-yellow-300', label: 'Condition fulfilled',  icon: SVG('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
  CONDITION_MET:      { bg: 'bg-teal-500',   ring: 'ring-teal-200 dark:ring-teal-900/50',   badgeBg: 'bg-teal-50 dark:bg-teal-950',   badgeText: 'text-teal-700 dark:text-teal-300',   label: 'Condition confirmed',    icon: SVG('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z') },
  MILESTONE_RELEASED: { bg: 'bg-teal-600',   ring: 'ring-teal-200 dark:ring-teal-900/50',   badgeBg: 'bg-teal-50 dark:bg-teal-950',   badgeText: 'text-teal-700 dark:text-teal-300',   label: 'Milestone released',     icon: SVG('M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z') },
  DISPUTE_FILED:      { bg: 'bg-orange-500', ring: 'ring-orange-200 dark:ring-orange-900/50', badgeBg: 'bg-orange-50 dark:bg-orange-950', badgeText: 'text-orange-700 dark:text-orange-300', label: 'Dispute filed',        icon: SVG('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z') },
  DISPUTED:           { bg: 'bg-orange-500', ring: 'ring-orange-200 dark:ring-orange-900/50', badgeBg: 'bg-orange-50 dark:bg-orange-950', badgeText: 'text-orange-700 dark:text-orange-300', label: 'Dispute raised',        icon: SVG('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z') },
  DISPUTE_RESOLVED:   { bg: 'bg-indigo-500', ring: 'ring-indigo-200 dark:ring-indigo-900/50', badgeBg: 'bg-indigo-50 dark:bg-indigo-950', badgeText: 'text-indigo-700 dark:text-indigo-300', label: 'Dispute resolved',     icon: SVG('M5 13l4 4L19 7') },
  RESOLVED:           { bg: 'bg-indigo-500', ring: 'ring-indigo-200 dark:ring-indigo-900/50', badgeBg: 'bg-indigo-50 dark:bg-indigo-950', badgeText: 'text-indigo-700 dark:text-indigo-300', label: 'Dispute resolved',     icon: SVG('M5 13l4 4L19 7') },
  COMPLETED:          { bg: 'bg-green-600',  ring: 'ring-green-200 dark:ring-green-900/50',  badgeBg: 'bg-green-50 dark:bg-green-950',  badgeText: 'text-green-700 dark:text-green-300',  label: 'Escrow completed',       icon: SVG('M5 13l4 4L19 7') },
  CANCELLED:          { bg: 'bg-red-500',    ring: 'ring-red-200 dark:ring-red-900/50',      badgeBg: 'bg-red-50 dark:bg-red-950',      badgeText: 'text-red-700 dark:text-red-300',      label: 'Escrow cancelled',       icon: SVG('M6 18L18 6M6 6l12 12') },
  EXPIRED:            { bg: 'bg-gray-400',   ring: 'ring-gray-200 dark:ring-zinc-800',       badgeBg: 'bg-gray-50 dark:bg-zinc-800',    badgeText: 'text-gray-600 dark:text-zinc-300',    label: 'Escrow expired',         icon: SVG('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z') },
};

const DEFAULT_META: EventMeta = {
  bg: 'bg-gray-400',
  ring: 'ring-gray-200 dark:ring-zinc-800',
  badgeBg: 'bg-gray-50 dark:bg-zinc-800',
  badgeText: 'text-gray-600 dark:text-zinc-300',
  label: 'System event',
  icon: SVG('M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
};

// ── Helpers ────────────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function labelFor(eventType: EscrowEventType): string {
  return (
    (EVENT_META[eventType] ?? DEFAULT_META).label ||
    eventType.replace(/_/g, ' ').toLowerCase()
  );
}

function getPendingSteps(escrowStatus: string, hasConditions: boolean): PendingStep[] {
  if (TERMINAL_STATUSES.has(escrowStatus)) return [];

  const steps: PendingStep[] = [];
  const s = escrowStatus.toUpperCase();

  if (s === 'PENDING') {
    steps.push({ key: 'FUNDED', label: 'Awaiting funding' });
  }
  if (s === 'PENDING' || s === 'ACTIVE') {
    if (hasConditions) {
      steps.push({ key: 'CONDITION_MET', label: 'All conditions to be confirmed' });
    }
    steps.push({ key: 'COMPLETED', label: 'Escrow completion' });
  }
  if (s === 'DISPUTED') {
    steps.push({ key: 'DISPUTE_RESOLVED', label: 'Dispute resolution pending' });
  }

  return steps;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [value],
  );

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy address'}
      className="inline-flex items-center justify-center w-4 h-4 ml-1 rounded text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
}

function ActorRow({ actorId }: { actorId: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 mt-0.5">
      <a
        href={`${STELLAR_EXPLORER}/${actorId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-500 hover:underline font-mono inline-flex items-center gap-0.5"
      >
        {truncateAddress(actorId)}
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
      <CopyButton value={actorId} />
    </span>
  );
}

function TimelineSkeleton() {
  return (
    <ul className="space-y-0" aria-busy="true" aria-label="Loading timeline">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="relative pb-7">
          {i < 3 && (
            <span className="absolute top-3.5 left-3.5 -ml-px h-full w-0.5 bg-border" aria-hidden="true" />
          )}
          <div className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 pt-0.5 space-y-1.5">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-3 w-12 flex-shrink-0 mt-1" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="status"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
        <Circle className="w-6 h-6 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium text-foreground">No activity yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Events will appear here as they happen.
      </p>
    </div>
  );
}

function PendingStepRow({ step, isLast }: { step: PendingStep; isLast: boolean }) {
  return (
    <li className="opacity-40" aria-label={`Pending: ${step.label}`}>
      <div className="relative pb-7">
        {!isLast && (
          <span
            className="absolute top-3.5 left-3.5 -ml-px h-full w-0.5 border-l-2 border-dashed border-border"
            aria-hidden="true"
          />
        )}
        <div className="relative flex items-start gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground bg-background ring-4 ring-background">
            <Circle className="h-3 w-3 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm text-muted-foreground italic">{step.label}</p>
          </div>
          <span className="text-xs text-muted-foreground pt-0.5 whitespace-nowrap">
            Pending
          </span>
        </div>
      </div>
    </li>
  );
}

interface EventRowProps {
  event: IEscrowEvent;
  isLatest: boolean;
  hasConnector: boolean;
}

function EventRow({ event, isLatest, hasConnector }: EventRowProps) {
  const meta = EVENT_META[event.eventType] ?? DEFAULT_META;
  const label = labelFor(event.eventType);
  const fullTimestamp = new Date(event.createdAt).toLocaleString();

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative pb-7">
        {hasConnector && (
          <span
            className="absolute top-3.5 left-3.5 -ml-px h-full w-0.5 bg-border"
            aria-hidden="true"
          />
        )}

        <div className="relative flex items-start gap-3">
          {/* Icon dot */}
          <span
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${meta.bg} ring-4 ${isLatest ? 'ring-primary/30 shadow-md' : meta.ring}`}
            aria-hidden="true"
          >
            {meta.icon}
          </span>

          {/* Content */}
          <div className="min-w-0 flex-1 flex justify-between gap-4">
            <div className="min-w-0">
              {/* Badge + LATEST tag */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${meta.badgeBg} ${meta.badgeText}`}
                >
                  {event.eventType.replace(/_/g, ' ')}
                </span>
                {isLatest && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    LATEST
                  </span>
                )}
              </div>

              {/* Human-readable label */}
              <p className="mt-0.5 text-sm text-foreground leading-snug">{label}</p>

              {/* Amount pill */}
              {event.data?.amount != null && (
                <span className="mt-1 inline-flex items-center text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {event.data.amount} {event.data.asset ?? event.data.assetCode ?? ''}
                </span>
              )}

              {/* Actor */}
              {event.actorId && <ActorRow actorId={event.actorId} />}
            </div>

            {/* Timestamp */}
            <time
              dateTime={event.createdAt}
              title={fullTimestamp}
              className="flex-shrink-0 text-xs text-muted-foreground pt-0.5 whitespace-nowrap cursor-default"
            >
              {relativeTime(event.createdAt)}
            </time>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export interface EscrowTimelineProps {
  escrowId: string;
  escrowStatus?: string;
  hasConditions?: boolean;
  initialEvents?: IEscrowEvent[];
  className?: string;
}

const EscrowTimeline: React.FC<EscrowTimelineProps> = ({
  escrowId,
  escrowStatus = 'PENDING',
  hasConditions = false,
  initialEvents,
  className = '',
}) => {
  const { events, loading, error, refetch } = useEscrowTimeline(
    escrowId,
    initialEvents,
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  const pendingSteps = getPendingSteps(escrowStatus, hasConditions);
  const latestEventId = events.length > 0 ? events[events.length - 1].id : null;
  const totalItems = events.length + pendingSteps.length;

  return (
    <section
      aria-label="Escrow activity timeline"
      className={`bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold text-foreground">Activity Timeline</h2>
          {loading && !events.length && (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" aria-label="Loading" />
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          aria-label="Refresh timeline"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <p role="alert" className="mb-4 text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Content */}
      {loading && !events.length ? (
        <TimelineSkeleton />
      ) : events.length === 0 && pendingSteps.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flow-root">
          <ul className="-mb-6" role="list">
            <AnimatePresence initial={false}>
              {events.map((event, idx) => {
                const isLast = idx === events.length - 1;
                const hasConnector = !isLast || pendingSteps.length > 0;
                return (
                  <EventRow
                    key={event.id}
                    event={event}
                    isLatest={event.id === latestEventId}
                    hasConnector={hasConnector}
                  />
                );
              })}
            </AnimatePresence>

            {pendingSteps.map((step, idx) => (
              <PendingStepRow
                key={step.key}
                step={step}
                isLast={idx === pendingSteps.length - 1}
              />
            ))}
          </ul>

          {totalItems > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground text-right">
              {events.length} event{events.length !== 1 ? 's' : ''}
              {pendingSteps.length > 0
                ? ` · ${pendingSteps.length} pending step${pendingSteps.length !== 1 ? 's' : ''}`
                : ''}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default EscrowTimeline;
