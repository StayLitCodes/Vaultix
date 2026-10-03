'use client'; // Next.js directive: this component runs on the client (uses context/hooks)

import React from 'react';
import { Wifi, WifiOff, RotateCw } from 'lucide-react'; // Icons for each connection state
import { useWebSocket } from '@/app/contexts/WebSocketContext'; // Provides the current WebSocket connection status

/**
 * Display configuration for each possible connection status.
 * - label: accessible text / tooltip / optional visible label
 * - icon: the lucide icon component to render
 * - dotClassName: background color of the status dot
 * - textClassName: color for the icon and label (with dark-mode variants)
 * `as const` makes the keys and values read-only literal types,
 * so `connectionStatus` can be used safely as an index.
 */
const STATUS_CONFIG = {
  // WebSocket is open and receiving updates
  connected: {
    label: 'Live updates connected',
    icon: Wifi,
    dotClassName: 'bg-emerald-500',
    textClassName: 'text-emerald-600 dark:text-emerald-400',
  },
  // Connection was lost and a retry is in progress
  reconnecting: {
    label: 'Reconnecting to live updates…',
    icon: RotateCw,
    dotClassName: 'bg-amber-500',
    textClassName: 'text-amber-600 dark:text-amber-400',
  },
  // No connection and no retry in progress
  disconnected: {
    label: 'Live updates disconnected',
    icon: WifiOff,
    dotClassName: 'bg-gray-400 dark:bg-gray-600',
    textClassName: 'text-gray-500 dark:text-gray-400',
  },
} as const;

/**
 * Props for ConnectionStatusIndicator.
 */
interface ConnectionStatusIndicatorProps {
  /** Show the text label next to the dot. Defaults to icon+dot only. */
  showLabel?: boolean;
  /** Extra classes applied to the root element */
  className?: string;
}

/** Small connected/reconnecting/disconnected indicator for the WebSocket link. */
export default function ConnectionStatusIndicator({
  showLabel = false,
  className = '',
}: ConnectionStatusIndicatorProps) {
  // Current connection state from the WebSocket context
  const { connectionStatus } = useWebSocket();
  // Look up the styling/label/icon for this state
  const config = STATUS_CONFIG[connectionStatus];
  // Assign to a capitalized variable so it can be rendered as a JSX component
  const Icon = config.icon;

  return (
    // role="status" makes screen readers announce changes politely;
    // aria-label and title provide the text for assistive tech and mouse hover
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="status"
      aria-label={config.label}
      title={config.label}
    >
      {/* Status dot */}
      <span className="relative flex h-2 w-2">
        {/* Pulsing "ping" ring behind the dot, shown only while reconnecting */}
        {connectionStatus === 'reconnecting' && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dotClassName}`}
          />
        )}
        {/* The solid dot itself */}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${config.dotClassName}`}
        />
      </span>

      {/* Status icon; spins while reconnecting */}
      <Icon
        size={14}
        className={`${config.textClassName} ${connectionStatus === 'reconnecting' ? 'animate-spin' : ''}`}
      />

      {/* Optional visible text label */}
      {showLabel && (
        <span className={`text-xs font-medium ${config.textClassName}`}>
          {config.label}
        </span>
      )}
    </span>
  );
} 