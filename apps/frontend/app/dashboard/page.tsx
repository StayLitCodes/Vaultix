'use client';

import { useState } from 'react';
import StatusTabs from '@/component/dashboard/StatusTabs';
import EscrowList from '@/component/dashboard/EscrowList';
import EscrowFilters from '@/component/dashboard/EscrowFilters';
import { useEscrows } from '../../hooks/useEscrows';
import { IEscrow } from '@/types/escrow';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'completed' | 'disputed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'deadline'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const { 
    data: escrowsData, 
    isLoading, 
    isError, 
    hasNextPage, 
    fetchNextPage, 
    isFetchingNextPage 
  } = useEscrows({
    status: activeTab,
    search: searchQuery,
    sortBy,
    sortOrder
  });

  // Flatten the paginated data
  const flatEscrows = escrowsData?.pages.flatMap((page: any) => page.escrows) || [];

  // Handle tab changes
  const handleTabChange = (tab: 'all' | 'active' | 'pending' | 'completed' | 'disputed') => {
    setActiveTab(tab);
  };

  // Handle search
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  // Handle sort change
  const handleSortChange = (field: 'date' | 'amount' | 'deadline', order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Escrow Dashboard
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Manage all your escrow agreements in one place
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <StatusTabs activeTab={activeTab} onTabChange={handleTabChange} />
          
          <EscrowFilters 
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />
          
          <EscrowList 
            escrows={flatEscrows}
            isLoading={isLoading}
            isError={isError}
            activeTab={activeTab}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </div>
      </div>
    </div>
  );
}