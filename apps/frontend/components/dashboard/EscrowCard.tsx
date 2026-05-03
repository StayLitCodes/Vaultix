import React from 'react';
import Link from 'next/link';

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
  milestones?: Array<{ id: string; title: string; amount: string; status: 'pending' | 'released' }>;
}

interface EscrowCardProps {
  escrow: IEscrow;
}

const STATUS_STYLES: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  funded: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-yellow-100 text-yellow-800',
  released: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  disputed: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  funded: 'Funded',
  confirmed: 'Confirmed',
  released: 'Released',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const truncateAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.slice(-4)}`;

const EscrowCard: React.FC<EscrowCardProps> = ({ escrow }) => {
  const statusStyle = STATUS_STYLES[escrow.status] || 'bg-gray-100 text-gray-800';
  const statusLabel = STATUS_LABELS[escrow.status] || escrow.status;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-gray-900 leading-tight line-clamp-1 min-w-0">
            {escrow.title}
          </h3>
          <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 mb-4">{escrow.description}</p>

        {/* Details grid — 2 cols on mobile, 4 on md+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Amount</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {escrow.amount} <span className="text-gray-500 font-normal">{escrow.asset}</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Counterparty</p>
            <p className="text-sm font-mono text-gray-700">{truncateAddress(escrow.counterpartyAddress)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Created</p>
            <p className="text-sm text-gray-700">{formatDate(escrow.createdAt)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Deadline</p>
            <p className="text-sm text-gray-700">{formatDate(escrow.deadline)}</p>
          </div>
        </div>
      </div>

      {/* Card footer / actions */}
      <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
        <Link
          href={`/escrow/${escrow.id}`}
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          View Details
        </Link>
        {escrow.status === 'confirmed' && (
          <div className="flex gap-2">
            <Link
              href={`/escrow/${escrow.id}/confirm`}
              className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
            >
              Confirm
            </Link>
            <Link
              href={`/escrow/${escrow.id}/dispute`}
              className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
            >
              Dispute
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default EscrowCard;
