import React from 'react';
import { IEscrowExtended } from '@/types/escrow';

interface PartiesSectionProps {
  escrow: IEscrowExtended;
  userRole: 'creator' | 'counterparty' | null;
}

const getRoleColor = (role: string) => {
  switch (role.toUpperCase()) {
    case 'BUYER':
      return 'bg-blue-100 text-blue-800';
    case 'SELLER':
      return 'bg-green-100 text-green-800';
    case 'ARBITRATOR':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toUpperCase()) {
    case 'ACCEPTED':
      return 'bg-green-100 text-green-800';
    case 'REJECTED':
      return 'bg-red-100 text-red-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const PartiesSection: React.FC<PartiesSectionProps> = ({ escrow, userRole }: PartiesSectionProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Parties</h2>
      
      <div className="space-y-4">
        {escrow.parties.map((party: any) => (
          <div key={party.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(party.role)}`}>
                    {party.role}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(party.status)}`}>
                    {party.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">User ID:</span> {party.userId}
                </p>
              </div>
              
              {userRole === 'creator' && party.status === 'PENDING' && (
                <div className="flex space-x-2">
                  <button className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600">
                    Accept
                  </button>
                  <button className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600">
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {escrow.conditions && escrow.conditions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Conditions</h3>
          <ul className="space-y-2">
            {escrow.conditions.map((condition: any) => (
              <li key={condition.id} className="flex items-start">
                <div className="flex-shrink-0 h-5 w-5 text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-700">{condition.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PartiesSection;