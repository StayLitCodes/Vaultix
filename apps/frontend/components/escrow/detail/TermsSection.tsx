import React, { useState, useEffect } from 'react';
import { IEscrowExtended } from '@/types/escrow';

interface TermsSectionProps {
  escrow: IEscrowExtended;
  userRole: 'creator' | 'counterparty' | 'arbitrator' | null;
}

const TermsSection: React.FC<TermsSectionProps> = ({ escrow, userRole }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!escrow.expiresAt) return;
    const calc = () => {
      const diff = new Date(escrow.expiresAt!).getTime() - Date.now();
      if (diff <= 0) return setTimeLeft('Expired');
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [escrow.expiresAt]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:sticky lg:top-8">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Terms & Actions</h2>

      <div className="space-y-4">
        {/* Agreement details */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Agreement Details</h3>
          <dl className="space-y-2.5">
            <div className="flex justify-between items-center gap-2">
              <dt className="text-sm text-gray-500 shrink-0">Amount</dt>
              <dd className="text-sm font-medium text-gray-900 text-right">
                {Number(escrow.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} {escrow.asset}
              </dd>
            </div>
            <div className="flex justify-between items-center gap-2">
              <dt className="text-sm text-gray-500">Type</dt>
              <dd className="text-sm font-medium text-gray-900 capitalize">{escrow.type}</dd>
            </div>
            <div className="flex justify-between items-center gap-2">
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-sm font-medium text-gray-900 capitalize">{escrow.status}</dd>
            </div>
            {escrow.expiresAt && (
              <div className="flex justify-between items-start gap-2">
                <dt className="text-sm text-gray-500 shrink-0">Expires</dt>
                <dd className="text-sm font-medium text-gray-900 text-right">
                  {new Date(escrow.expiresAt).toLocaleDateString()}
                  {timeLeft && <span className="block text-xs text-gray-400 mt-0.5">{timeLeft}</span>}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Action buttons */}
        <div className="space-y-2.5">
          {userRole === 'creator' && escrow.status === 'PENDING' && (
            <button className="w-full min-h-[44px] px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
              Fund Escrow
            </button>
          )}
          {userRole === 'counterparty' && escrow.status === 'ACTIVE' && (
            <>
              <button className="w-full min-h-[44px] px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors">
                Confirm Delivery
              </button>
              <button className="w-full min-h-[44px] px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium transition-colors">
                Raise Dispute
              </button>
            </>
          )}
          {(userRole === 'creator' || userRole === 'counterparty') && escrow.status === 'ACTIVE' && (
            <button className="w-full min-h-[44px] px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors">
              Cancel Escrow
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TermsSection;
