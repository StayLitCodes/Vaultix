import React, { useMemo } from 'react';
import { motion } from 'framer-motion'; // Used to animate each item as it appears
import { 
  PlusCircle, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Wallet, 
  Activity, 
  AlertTriangle, 
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react'; // Icons used to represent each event type
import { IEscrowEvent } from '@/types/escrow';
import { formatDistanceToNow } from '@/utils/date'; // Formats a date as relative time (e.g. "5 minutes ago")

/**
 * Props for ActivityItem.
 */
interface ActivityItemProps {
  /** The escrow event to display */
  event: IEscrowEvent;
}

/**
 * ActivityItem
 * Renders a single row in the activity feed: an icon, a title, a description,
 * a relative timestamp, an optional amount badge, and a hover-only "details" button.
 */
const ActivityItem: React.FC<ActivityItemProps> = ({ event }) => {
  /**
   * Maps the event type to its display configuration
   * (icon, title, description and background color of the icon circle).
   * Memoized so the config is only recomputed when the event type
   * or actor changes, rather than on every render.
   */
  const config = useMemo(() => {
    switch (event.eventType) {
      // A new escrow agreement was created
      case 'CREATED':
        return {
          icon: <PlusCircle className="w-5 h-5 text-blue-500" />,
          title: 'Escrow Created',
          description: 'A new escrow agreement was initiated.',
          color: 'bg-blue-50'
        };
      // A user was added to the escrow; shows a shortened actor ID (first 6 chars)
      case 'PARTY_ADDED':
        return {
          icon: <UserPlus className="w-5 h-5 text-indigo-500" />,
          title: 'Party Added',
          description: `User ${event.actorId?.slice(0, 6)}... was added to the escrow.`,
          color: 'bg-indigo-50'
        };
      // A participant accepted the terms
      case 'PARTY_ACCEPTED':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
          title: 'Party Accepted',
          description: 'A participant has accepted the terms.',
          color: 'bg-green-50'
        };
      // A participant rejected the terms
      case 'PARTY_REJECTED':
        return {
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          title: 'Party Rejected',
          description: 'A participant has rejected the terms.',
          color: 'bg-red-50'
        };
      // Funds were deposited and the escrow became active
      case 'FUNDED':
        return {
          icon: <Wallet className="w-5 h-5 text-emerald-500" />,
          title: 'Funds Deposited',
          description: 'The escrow has been funded and is now active.',
          color: 'bg-emerald-50'
        };
      // One of the release conditions was satisfied
      case 'CONDITION_MET':
        return {
          icon: <Activity className="w-5 h-5 text-amber-500" />,
          title: 'Condition Met',
          description: 'One of the release conditions has been satisfied.',
          color: 'bg-amber-50'
        };
      // Funds were released and the escrow finished successfully
      case 'COMPLETED':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          title: 'Escrow Completed',
          description: 'Funds have been released and the escrow is finished.',
          color: 'bg-green-100'
        };
      // The escrow was aborted and funds returned
      case 'CANCELLED':
        return {
          icon: <XCircle className="w-5 h-5 text-gray-500" />,
          title: 'Escrow Cancelled',
          description: 'The escrow has been aborted and funds returned.',
          color: 'bg-gray-100'
        };
      // A dispute was opened on the escrow
      case 'DISPUTED':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-rose-500" />,
          title: 'Dispute Raised',
          description: 'A dispute has been opened regarding this escrow.',
          color: 'bg-rose-50'
        };
      // Terms or details of the escrow were changed
      case 'UPDATED':
        return {
          icon: <RefreshCw className="w-5 h-5 text-sky-500" />,
          title: 'Escrow Updated',
          description: 'Terms or details have been modified.',
          color: 'bg-sky-50'
        };
      // Fallback for any event type not handled above
      default:
        return {
          icon: <Activity className="w-5 h-5 text-gray-400" />,
          title: 'Activity Detected',
          description: 'A system event occurred.',
          color: 'bg-gray-50'
        };
    }
  }, [event.eventType, event.actorId]);

  return (
    // Row container: fades in and slides in from the left on mount.
    // `group` lets child elements react to hover on the whole row.
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors group"
    >
      {/* Icon circle, colored according to the event type */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.color} flex items-center justify-center`}>
        {config.icon}
      </div>
      
      {/* Main content: title, timestamp, description and optional amount */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {config.title}
          </h4>
          {/* Relative timestamp, e.g. "2 hours ago" */}
          <span className="text-[10px] uppercase font-medium text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(event.createdAt))}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          {config.description}
        </p>
        
        {/* Amount badge: only shown when the event carries an amount (e.g. funding) */}
        {event.data?.amount && (
          <div className="mt-2 text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">
            {event.data.amount} {event.data.asset}
          </div>
        )}
      </div>

      {/* "View details" button: hidden by default, fades in when the row is hovered.
          Note: it currently has no onClick handler. */}
      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400" aria-label="View Details">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default ActivityItem;