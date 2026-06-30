"use client";
import React from "react";
import { X } from "lucide-react";

interface FilterBadgesProps {
  searchQuery?: string;
  minAmount?: string;
  maxAmount?: string;
  fromDate?: string;
  toDate?: string;
  activeStatuses?: string[];
  onClear: (key: string) => void;
  onClearAll: () => void;
}

export default function FilterBadges({
  searchQuery, minAmount, maxAmount, fromDate, toDate,
  activeStatuses = [], onClear, onClearAll,
}: FilterBadgesProps) {
  const badges: { key: string; label: string }[] = [
    ...(searchQuery ? [{ key: "search", label: `Search: ${searchQuery}` }] : []),
    ...(minAmount ? [{ key: "minAmount", label: `Min: ${minAmount} XLM` }] : []),
    ...(maxAmount ? [{ key: "maxAmount", label: `Max: ${maxAmount} XLM` }] : []),
    ...(fromDate ? [{ key: "fromDate", label: `From: ${fromDate}` }] : []),
    ...(toDate ? [{ key: "toDate", label: `To: ${toDate}` }] : []),
    ...activeStatuses.map((s) => ({ key: `status-${s}`, label: s })),
  ];
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {badges.map((b) => (
        <span key={b.key} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          {b.label}
          <button onClick={() => onClear(b.key)} aria-label={`Remove ${b.label} filter`} className="hover:text-blue-600 focus:outline-none">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button onClick={onClearAll} className="text-xs text-gray-400 underline hover:text-gray-600">
        Clear all
      </button>
    </div>
  );
}
