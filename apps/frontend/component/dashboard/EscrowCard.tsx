import React from 'react';
// Temporarily define the interface here until types are properly configured
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

interface EscrowCardProps {
  escrow: IEscrow;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'created':
    case 'funded':
      return 'bg-blue-100 text-blue-800';
    case 'confirmed':
      return 'bg-yellow-100 text-yellow-800';
    case 'released':
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    case 'disputed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'created':
      return 'Created';
    case 'funded':
      return 'Funded';
    case 'confirmed':
      return 'Confirmed';
    case 'released':
      return 'Released';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'disputed':
      return 'Disputed';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

const EscrowCard: React.FC<EscrowCardProps> = ({ escrow }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getQuickActions = () => {
    const actions = [];
    
    // Based on status, show appropriate actions
    switch (escrow.status) {
      case 'created':
      case 'funded':
        actions.push(
          <a 
            key="view-details"
            href={`/escrow/${escrow.id}`}
            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          >
            View Details
          </a>
        );
        break;
      case 'confirmed':
        actions.push(
          <a 
            key="confirm-delivery"
            href={`/escrow/${escrow.id}/confirm`}
            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          >
            Confirm Delivery
          </a>,
          <a 
            key="dispute"
            href={`/escrow/${escrow.id}/dispute`}
            className="text-red-600 hover:text-red-900 text-sm font-medium ml-4"
          >
            Dispute
          </a>
        );
        break;
      case 'released':
        actions.push(
          <a 
            key="view-details"
            href={`/escrow/${escrow.id}`}
            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          >
            View Details
          </a>
        );
        break;
      case 'completed':
        actions.push(
          <a 
            key="view-details"
            href={`/escrow/${escrow.id}`}
            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          >
            View Details
          </a>
        );
        break;
      case 'disputed':
        actions.push(
          <a 
            key="view-details"
            href={`/escrow/${escrow.id}`}
            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          >
            View Details
          </a>
        );
        break;
      default:
        actions.push(
          <a 
            key="view-details"
            href={`/escrow/${escrow.id}`}
            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          >
            View Details
          </a>
        );
    }
    
    return actions;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <h3 className="text-lg font-medium text-gray-900 truncate">{escrow.title}</h3>
              <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(escrow.status)}`}>
                {getStatusText(escrow.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{escrow.description}</p>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Amount</p>
                <p className="text-sm text-gray-900">{escrow.amount} {escrow.asset}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Counterparty</p>
                <p className="text-sm text-gray-900 truncate">{escrow.counterpartyAddress.substring(0, 10)}...</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <p className="text-sm text-gray-900">{formatDate(escrow.createdAt)}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Deadline</p>
                <p className="text-sm text-gray-900">{formatDate(escrow.deadline)}</p>
              </div>
            </div>
          </div>
          
          <div className="ml-4 flex-shrink-0 flex flex-col items-end space-y-3">
            <div className="flex space-x-3">
              {getQuickActions()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EscrowCard;