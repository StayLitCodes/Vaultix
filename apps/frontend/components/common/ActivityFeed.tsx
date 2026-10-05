'use client'; // Next.js directive: this component runs on the client (uses hooks, browser APIs)

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // AnimatePresence handles enter/exit animations of list items
import { Filter, Loader2, RefreshCw, Zap } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents'; // Custom hook wrapping a paginated (infinite) query for escrow events
import ActivityItem from './ActivityItem'; // Renders a single event row
import { IEscrowEvent } from '@/types/escrow';
import { ActivityFeedSkeleton } from '../ui/ActivityFeedSkeleton'; // Placeholder shown during the first load

/**
 * Props for the ActivityFeed component.
 */
interface ActivityFeedProps {
    /** Optional: restrict the feed to events belonging to a single escrow */
    escrowId?: string;
    /** Max number of notifications to show (currently not used in the component body) */
    maxNotifications?: number;
    /** Extra Tailwind/CSS classes appended to the root container */
    className?: string;
}

/**
 * Filter tabs shown above the feed.
 * `label` is what the user sees; `value` is sent to the API as the event type.
 * 'ALL' means no event-type filtering.
 */
const EVENT_FILTERS = [
    { label: 'All', value: 'ALL' },
    { label: 'Founding', value: 'FUNDED' },
    { label: 'Conditions', value: 'CONDITION_MET' },
    { label: 'Completion', value: 'COMPLETED' },
    { label: 'Conflicts', value: 'DISPUTED' },
];

/**
 * ActivityFeed
 * A live, filterable, infinitely-scrolling list of escrow events.
 */
const ActivityFeed: React.FC<ActivityFeedProps> = ({
    escrowId,
    maxNotifications = 20,
    className = ""
}) => {
    // Currently selected filter value (matches EVENT_FILTERS[].value)
    const [filter, setFilter] = useState('ALL');
    // Drives the spinning animation on the manual refresh button
    const [isRefreshing, setIsRefreshing] = useState(false);
    // Ref to a sentinel element at the bottom of the list; when it becomes
    // visible, the next page of events is loaded
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Fetch events with pagination. The query re-runs when escrowId or filter changes.
    const {
        data,                 // Paginated result: { pages: [{ events: [...] }, ...] }
        fetchNextPage,        // Loads the next page
        hasNextPage,          // True if more pages are available
        isFetchingNextPage,   // True while a next page is loading
        status,               // 'pending' | 'error' | 'success'
        refetch,              // Manually re-fetch the data
        isFetching            // True during any fetch (initial, background, or next page)
    } = useEvents({
        escrowId,
        eventType: filter,
        limit: 10,            // Events per page
        refetchInterval: false, // Auto-polling disabled; updates happen via manual refresh
    });

    /**
     * Manual refresh handler.
     * Triggers a refetch and keeps the spinner animation running
     * for an extra 600ms so the feedback is visible even if the fetch is fast.
     */
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setTimeout(() => setIsRefreshing(false), 600);
    };

    /**
     * Infinite scroll: use an IntersectionObserver to detect when the
     * sentinel element (loadMoreRef) enters the viewport, then fetch the next page.
     */
    useEffect(() => {
        // Nothing to do if there are no more pages or a page is already loading
        if (!hasNextPage || isFetchingNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Trigger when at least 10% of the sentinel is visible
                if (entries[0].isIntersecting) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        // Cleanup: stop observing when dependencies change or the component unmounts
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Flatten all loaded pages into one array of events (empty array if no data yet)
    const allEvents = data?.pages.flatMap(page => page.events) || [];

    return (
        // Root card container; `className` lets parents customize sizing/spacing
        <div className={`flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
            {/* ---------- Header: title, background-fetch spinner, refresh button ---------- */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    {/* Icon badge */}
                    <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                        <Zap className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm italic tracking-tight uppercase">
                        Live Activity
                    </h3>
                    {/* Small spinner shown during fetches, except when loading the next page
                        (that one has its own spinner at the bottom of the list) */}
                    {isFetching && !isFetchingNextPage && (
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                    )}
                </div>

                {/* Manual refresh button; disabled while the refresh animation runs */}
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-400 hover:text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* ---------- Filters: horizontally scrollable pill buttons ---------- */}
            <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                {EVENT_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        // Active pill is dark; inactive pills are light with a hover border
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border ${filter === f.value
                                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* ---------- Content: skeleton / empty state / event list ---------- */}
            <div className="grow overflow-y-auto custom-scrollbar p-2">
                {status === 'pending' ? (
                    // Initial load: show skeleton placeholders
                    <ActivityFeedSkeleton />
                ) : allEvents.length === 0 ? (
                    // Empty state: loaded successfully, but there are no events
                    <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <Activity className="w-6 h-6 text-gray-300" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">No activity yet</h4>
                        <p className="text-xs text-gray-500">Events related to your escrows will appear here in real-time.</p>
                    </div>
                ) : (
                    // Event list
                    <div className="space-y-1">
                        {/* AnimatePresence animates items entering/leaving; initial={false}
                            skips the enter animation on first render */}
                        <AnimatePresence initial={false}>
                            {allEvents.map((event) => (
                                <ActivityItem key={event.id} event={event} />
                            ))}
                        </AnimatePresence>

                        {/* Infinite Scroll Trigger: the IntersectionObserver watches this div.
                            Shows a spinner while the next page is loading. */}
                        <div
                            ref={loadMoreRef}
                            className="py-4 flex justify-center h-10"
                        >
                            {isFetchingNextPage && (
                                <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ---------- Footer: event count and "Live" indicator ---------- */}
            <div className="p-3 bg-gray-50/30 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-400">
                    Showing {allEvents.length} events
                </span>
                <div className="flex items-center gap-1">
                    {/* Pulsing green dot to suggest a live feed */}
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Live
                    </span>
                </div>
            </div>
        </div>
    );
};

/**
 * Simple inline SVG "activity" (pulse) icon used in the empty state.
 * Defined locally instead of importing from lucide-react.
 */
const Activity = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);

export default ActivityFeed;