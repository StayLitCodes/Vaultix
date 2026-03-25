import React from 'react';
import { IEscrowExtended } from '@/types/escrow';

interface TransactionHistoryProps {
  escrow: IEscrowExtended;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ escrow }: TransactionHistoryProps) => {
  // Filter events that represent transactions
  const transactionEvents = escrow.events.filter((event: any) => 
    event.eventType === 'FUNDED' || 
    event.eventType === 'CONDITION_MET' || 
    event.eventType === 'COMPLETED' || 
    event.eventType === 'CANCELLED'
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Transaction History</h2>
      
      {transactionEvents.length === 0 ? (
        <p className="text-gray-500 italic">No transaction history available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactionEvents.map((event: any) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {event.eventType.replace(/_/g, ' ').toLowerCase()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {event.eventType === 'FUNDED' && `${Number(escrow.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} ${escrow.asset}`}
                      {event.eventType === 'COMPLETED' && `${Number(escrow.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} ${escrow.asset}`}
                      {event.eventType === 'CANCELLED' && '0 XLM'}
                      {event.eventType === 'CONDITION_MET' && 'Variable'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {event.eventType === 'COMPLETED' ? 'Completed' : 
                       event.eventType === 'CANCELLED' ? 'Cancelled' : 'Processed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {event.data?.transactionHash ? (
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${event.data.transactionHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Transaction
                      </a>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;