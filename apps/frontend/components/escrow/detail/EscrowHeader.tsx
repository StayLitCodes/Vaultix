import React from 'react';
import { Share, Copy, Wallet, Clock, CheckCircle, AlertTriangle, XCircle, ShareIcon } from 'lucide-react';
import { IEscrowExtended } from '@/types/escrow';

interface EscrowHeaderProps {
  escrow: IEscrowExtended;
  userRole: 'creator' | 'counterparty' | null;
  connected: boolean;
  connect: () => void;
  publicKey: string | null;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'active':
      return 'bg-blue-100 text-blue-800';
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

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return <Clock className="h-4 w-4" />;
    case 'active':
      return <CheckCircle className="h-4 w-4" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4" />;
    case 'disputed':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const EscrowHeader: React.FC<EscrowHeaderProps> = ({ 
  escrow, 
  userRole, 
  connected, 
  connect, 
  publicKey 
}: EscrowHeaderProps) => {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{escrow.title}</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(escrow.status)}`}>
              {getStatusIcon(escrow.status)}
              <span className="ml-1 capitalize">{escrow.status}</span>
            </span>
          </div>
          <p className="text-gray-600 mb-4">{escrow.description}</p>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center">
              <span className="font-medium">ID:</span>
              <span className="ml-1 font-mono">{escrow.id.substring(0, 8)}...</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium">Amount:</span>
              <span className="ml-1">{Number(escrow.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} {escrow.asset}</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium">Created:</span>
              <span className="ml-1">{new Date(escrow.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ShareIcon className="h-4 w-4 mr-2" />
            Share
          </button>
          {!connected && (
            <button
              onClick={connect}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EscrowHeader;