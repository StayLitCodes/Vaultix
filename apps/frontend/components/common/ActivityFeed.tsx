import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Loader2, RefreshCw, Zap } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import ActivityItem from './ActivityItem';
import { IEscrowEvent } from '@/types/escrow';

interface ActivityFeedProps {
    escrowId?: string;
    maxNotifications?: number;
    className?: string;
}

const EVENT_FILTERS = [
    { label: 'All', value: 'ALL' },
    { label: 'Founding', value: 'FUNDED' },
    { label: 'Conditions', value: 'CONDITION_MET' },
    { label: 'Completion', value: 'COMPLETED' },
    { label: 'Conflicts', value: 'DISPUTED' },
];

const ActivityFeed: React.FC<ActivityFeedProps> = ({
    escrowId,
    maxNotifications = 20,
    className = ""
}) => {
    const [filter, setFilter] = useState('ALL');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
        refetch,
        isFetching
    } = useEvents({
        escrowId,
        eventType: filter,
        limit: 10,
        refetchInterval: 10000, // Real-time poll every 10s
    });

    // Manual refresh animation
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setTimeout(() => setIsRefreshing(false), 600);
    };

    // Infinite scroll intersection observer
    useEffect(() => {
        if (!hasNextPage || isFetchingNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const allEvents = data?.pages.flatMap(page => page.events) || [];

    return (
        <div className={`flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                        <Zap className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm italic tracking-tight uppercase">
                        Live Activity
                    </h3>
                    {isFetching && !isFetchingNextPage && (
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                    )}
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-400 hover:text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Filters */}
            <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                {EVENT_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border ${filter === f.value
                                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                {status === 'pending' ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin opacity-20" />
                        <p className="text-xs text-gray-400 font-medium">Loading events...</p>
                    </div>
                ) : allEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <Activity className="w-6 h-6 text-gray-300" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">No activity yet</h4>
                        <p className="text-xs text-gray-500">Events related to your escrows will appear here in real-time.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <AnimatePresence initial={false}>
                            {allEvents.map((event) => (
                                <ActivityItem key={event.id} event={event} />
                            ))}
                        </AnimatePresence>

                        {/* Infinite Scroll Trigger */}
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

            {/* Footer */}
            <div className="p-3 bg-gray-50/30 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-400">
                    Showing {allEvents.length} events
                </span>
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Live
                    </span>
                </div>
            </div>
        </div>
    );
};

// Simple icon for empty state
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
