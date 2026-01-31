import React, { useState, useEffect } from 'react';
import Input from '@/component/ui/Input';

interface EscrowFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'date' | 'amount' | 'deadline';
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: 'date' | 'amount' | 'deadline', order: 'asc' | 'desc') => void;
}

const EscrowFilters: React.FC<EscrowFiltersProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, onSearchChange]);

  const handleSortFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value as 'date' | 'amount' | 'deadline', sortOrder);
  };

  const handleSortOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(sortBy, e.target.value as 'asc' | 'desc');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div>
        <Input
          label="Search Escrows"
          placeholder="Search by title or counterparty..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
        <select
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border text-gray-900"
          value={sortBy}
          onChange={handleSortFieldChange}
        >
          <option value="date">Date Created</option>
          <option value="amount">Amount</option>
          <option value="deadline">Deadline</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
        <select
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border text-gray-900"
          value={sortOrder}
          onChange={handleSortOrderChange}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
    </div>
  );
};

export default EscrowFilters;