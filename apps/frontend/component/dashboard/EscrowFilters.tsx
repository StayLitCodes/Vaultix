import React, { useState, useEffect } from "react";
import Input from "@/component/ui/Input";

interface EscrowFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "date" | "amount" | "deadline";
  sortOrder: "asc" | "desc";
  onSortChange: (field: "date" | "amount" | "deadline", order: "asc" | "desc") => void;
  minAmount?: string;
  maxAmount?: string;
  onAmountChange: (min: string, max: string) => void;
  fromDate?: string;
  toDate?: string;
  onDateChange: (from: string, to: string) => void;
}

const EscrowFilters: React.FC<EscrowFiltersProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  minAmount = "",
  maxAmount = "",
  onAmountChange,
  fromDate = "",
  toDate = "",
  onDateChange,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange, searchQuery]);

  return (
    <div className="space-y-6 mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
      {/* Search and Sort Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Search Escrows"
          placeholder="Title or description..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Sort By</label>
          <select
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 border bg-white text-gray-900"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any, sortOrder)}
          >
            <option value="date">Date Created</option>
            <option value="amount">Amount</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Order</label>
          <select
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 border bg-white text-gray-900"
            value={sortOrder}
            onChange={(e) => onSortChange(sortBy, e.target.value as any)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Advanced Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 pt-4 border-t border-gray-200">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Amount Range</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full rounded-lg border-gray-300 p-2 border bg-white text-gray-900"
              value={minAmount}
              onChange={(e) => onAmountChange(e.target.value, maxAmount)}
            />
            <span className="hidden sm:block text-gray-400">-</span>
            <input
              type="number"
              placeholder="Max"
              className="w-full rounded-lg border-gray-300 p-2 border bg-white text-gray-900"
              value={maxAmount}
              onChange={(e) => onAmountChange(minAmount, e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Date Range</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="date"
              className="w-full rounded-lg border-gray-300 p-2 border bg-white text-gray-900"
              value={fromDate}
              onChange={(e) => onDateChange(e.target.value, toDate)}
            />
            <span className="text-gray-400 text-center sm:block">to</span>
            <input
              type="date"
              className="w-full rounded-lg border-gray-300 p-2 border bg-white text-gray-900"
              value={toDate}
              onChange={(e) => onDateChange(fromDate, e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EscrowFilters;