import React, { useState, useEffect } from 'react';
import { IEscrowExtended } from '@/types/escrow';

interface TermsSectionProps {
  escrow: IEscrowExtended;
  userRole: 'creator' | 'counterparty' | null;
}

const TermsSection: React.FC<TermsSectionProps> = ({ escrow, userRole }: TermsSectionProps) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (escrow.expiresAt) {
      const calculateTimeLeft = () => {
        const expiryDate = new Date(escrow.expiresAt!);
        const now = new Date();
        const difference = expiryDate.getTime() - now.getTime();

        if (difference <= 0) {
          return 'Expired';
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

        return `${days}d ${hours}h ${minutes}m`;
      };

      setTimeLeft(calculateTimeLeft());
      const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
      }, 60000); // Update every minute

      return () => clearInterval(timer);
    }
  }, [escrow.expiresAt]);

  return (
    <div className="bg-white rounded-lg shadow p-6 sticky top-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Terms & Actions</h2>
      
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Agreement Details</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Amount</dt>
              <dd className="text-sm font-medium text-gray-900">{Number(escrow.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} {escrow.asset}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Type</dt>
              <dd className="text-sm font-medium text-gray-900 capitalize">{escrow.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-sm font-medium text-gray-900 capitalize">{escrow.status}</dd>
            </div>
            {escrow.expiresAt && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Expires</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(escrow.expiresAt).toLocaleDateString()} 
                  <br />
                  <span className="text-xs text-gray-500">{timeLeft}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>
        
        {/* Action buttons based on user role and escrow status */}
        <div className="space-y-3">
          {userRole === 'creator' && escrow.status === 'PENDING' && (
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Fund Escrow
            </button>
          )}
          
          {userRole === 'counterparty' && escrow.status === 'ACTIVE' && (
            <>
              <button className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                Confirm Delivery
              </button>
              <button className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2">
                Raise Dispute
              </button>
            </>
          )}
          
          {(userRole === 'creator' || userRole === 'counterparty') && escrow.status === 'ACTIVE' && (
            <button className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
              Cancel Escrow
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TermsSection;