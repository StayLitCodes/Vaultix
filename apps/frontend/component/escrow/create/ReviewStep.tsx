'use client';

import { useFormContext } from 'react-hook-form';
import { CreateEscrowFormData } from '@/lib/escrow-schema';

export default function ReviewStep() {
  const { getValues } = useFormContext<CreateEscrowFormData>();
  const values = getValues();

  const formatDate = (date: Date) => {
    if (!date) return 'Not set';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Review & Confirm</h2>
        <p className="text-sm text-gray-500">
          Please review the details below carefully before creating the escrow.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 space-y-4 border border-gray-200">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Basic Info</h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <span className="block text-xs text-gray-400">Title</span>
                <span className="block text-sm text-gray-900 font-medium">{values.title}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Category</span>
                <span className="block text-sm text-gray-900 font-medium capitalize">{values.category}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="block text-xs text-gray-400">Description</span>
                <span className="block text-sm text-gray-900 mt-1">{values.description}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Parties</h3>
            <div className="mt-2 text-wrap break-all">
              <span className="block text-xs text-gray-400">Counterparty Address</span>
              <span className="block text-sm text-gray-900 font-mono break-all">{values.counterpartyAddress}</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Terms</h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <span className="block text-xs text-gray-400">Amount</span>
                <span className="block text-lg text-blue-600 font-bold">
                  {values.amount} {values.asset}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Deadline</span>
                <span className="block text-sm text-gray-900 font-medium">{values.deadline ? formatDate(values.deadline) : '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              {/* Warning Icon */}
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Review carefully</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Once deployed on-chain, some parameters cannot be changed. Ensure the counterparty address is correct.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
