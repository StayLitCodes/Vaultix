import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface EscrowFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'date' | 'amount' | 'deadline';
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: 'date' | 'amount' | 'deadline', order: 'asc' | 'desc') => void;
  minAmount?: string;
  maxAmount?: string;
  onAmountChange?: (min: string, max: string) => void;
  fromDate?: string;
  toDate?: string;
  onDateChange?: (from: string, to: string) => void;
}

const EscrowFilters: React.FC<EscrowFiltersProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  minAmount = '',
  maxAmount = '',
  onAmountChange,
  fromDate = '',
  toDate = '',
  onDateChange,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => onSearchChange(localSearch), 300);
    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange]);

  return (
    <div className="mb-5 space-y-3">
      {/* Search + sort row */}
      <div className="flex gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search escrows…"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort select */}
        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-') as ['date' | 'amount' | 'deadline', 'asc' | 'desc'];
            onSortChange(field, order);
          }}
          className="min-h-[44px] rounded-lg border border-gray-300 text-sm text-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0"
          aria-label="Sort escrows"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-desc">Amount ↓</option>
          <option value="amount-asc">Amount ↑</option>
          <option value="deadline-asc">Deadline soon</option>
          <option value="deadline-desc">Deadline later</option>
        </select>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          aria-label="Toggle advanced filters"
          aria-expanded={showAdvanced}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Advanced filters — collapsible */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min Amount</label>
            <input
              type="number"
              placeholder="0"
              value={minAmount}
              onChange={(e) => onAmountChange?.(e.target.value, maxAmount)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max Amount</label>
            <input
              type="number"
              placeholder="Any"
              value={maxAmount}
              onChange={(e) => onAmountChange?.(minAmount, e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onDateChange?.(e.target.value, toDate)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onDateChange?.(fromDate, e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EscrowFilters;
