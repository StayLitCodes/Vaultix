import React from 'react';
import Link from 'next/link';
import EscrowCard from './EscrowCard';

// Define the interface here since we can't import from types yet
interface IEscrow {
  id: string;
  title: string;
  description: string;
  amount: string;
  asset: string;
  creatorAddress: string;
  counterpartyAddress: string;
  deadline: string;
  status: 'created' | 'funded' | 'confirmed' | 'released' | 'completed' | 'cancelled' | 'disputed';
  createdAt: string;
  updatedAt: string;
  milestones?: Array<{
    id: string;
    title: string;
    amount: string;
    status: 'pending' | 'released';
  }>;
}

interface EscrowListProps {
  escrows: IEscrow[];
  isLoading: boolean;
  isError: boolean;
  activeTab: 'all' | 'active' | 'pending' | 'completed' | 'disputed';
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
}

const EscrowList: React.FC<EscrowListProps> = ({
  escrows,
  isLoading,
  isError,
  activeTab,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}) => {
  // Show loading skeletons when data is loading
  if (isLoading && escrows.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="bg-gray-200 animate-pulse rounded-lg p-6 h-32" />
        ))}
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className="text-center py-10">
        <h3 className="text-lg font-medium text-red-600">Error Loading Escrows</h3>
        <p className="text-gray-500 mt-2">There was an issue retrieving your escrow agreements. Please try again later.</p>
      </div>
    );
  }

  // Show empty state based on active tab
  if (escrows.length === 0) {
    let emptyMessage = '';
    switch (activeTab) {
      case 'all':
        emptyMessage = 'You have no escrow agreements yet.';
        break;
      case 'active':
        emptyMessage = 'You have no active escrow agreements.';
        break;
      case 'pending':
        emptyMessage = 'You have no escrows pending confirmation.';
        break;
      case 'completed':
        emptyMessage = 'You have no completed escrow agreements.';
        break;
      case 'disputed':
        emptyMessage = 'You have no disputed escrow agreements.';
        break;
      default:
        emptyMessage = 'No escrow agreements found.';
    }

    return (
      <div className="text-center py-10">
        <h3 className="text-lg font-medium text-gray-900">No Escrows Found</h3>
        <p className="text-gray-500 mt-2">{emptyMessage}</p>
        <div className="mt-6">
          <Link
            href="/escrow/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create New Escrow
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {escrows.map((escrow) => (
        <EscrowCard key={escrow.id} escrow={escrow} />
      ))}

      {/* Load more button for pagination */}
      {hasNextPage && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchNextPage && fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default EscrowList;