'use client';

import React, { useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Loader2, User, DollarSign, FileText, Calendar } from 'lucide-react';
import { IEscrowExtended, IParty } from '@/types/escrow';

interface PartyAcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  escrow: IEscrowExtended;
  party: IParty;
  onAccept: (escrowId: string, partyId: string) => Promise<void>;
  onReject: (escrowId: string, partyId: string) => Promise<void>;
}

type ConfirmationType = 'accept' | 'reject' | null;

export const PartyAcceptanceModal: React.FC<PartyAcceptanceModalProps> = ({
  isOpen,
  onClose,
  escrow,
  party,
  onAccept,
  onReject,
}) => {
  const [confirmationType, setConfirmationType] = useState<ConfirmationType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (confirmationType !== 'accept') {
      setConfirmationType('accept');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onAccept(escrow.id, party.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (confirmationType !== 'reject') {
      setConfirmationType('reject');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onReject(escrow.id, party.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmationType(null);
    setError(null);
    setIsLoading(false);
    onClose();
  };

  const formatAmount = (amount: string, asset: string) => {
    const numAmount = parseFloat(amount);
    return `${numAmount.toLocaleString()} ${asset}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRoleDisplay = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Escrow Invitation</h2>
              <p className="text-blue-100 text-sm mt-1">
                Review the terms before accepting
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Confirmation Dialog */}
          {confirmationType && (
            <div className={`p-4 rounded-lg border ${
              confirmationType === 'accept' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                {confirmationType === 'accept' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className={`font-semibold ${
                    confirmationType === 'accept' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {confirmationType === 'accept' 
                      ? 'Confirm Acceptance' 
                      : 'Confirm Rejection'}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    confirmationType === 'accept' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {confirmationType === 'accept'
                      ? 'Are you sure you want to accept this escrow invitation? This action cannot be undone.'
                      : 'Are you sure you want to reject this escrow invitation? This action cannot be undone.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Escrow Summary */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Escrow Summary</h3>
            
            {/* Title & Description */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="font-medium text-gray-900">{escrow.title}</p>
                </div>
              </div>
              {escrow.description && (
                <p className="text-sm text-gray-600 ml-8">{escrow.description}</p>
              )}
            </div>

            {/* Amount */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <DollarSign className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium text-gray-900">
                    {formatAmount(escrow.amount, escrow.asset)}
                  </p>
                </div>
              </div>
            </div>

            {/* Your Role */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-500">Your Role</p>
                  <p className="font-medium text-gray-900">{getRoleDisplay(party.role)}</p>
                </div>
              </div>
            </div>

            {/* Deadline */}
            {escrow.deadline && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500">Deadline</p>
                    <p className="font-medium text-gray-900">{formatDate(escrow.deadline)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Conditions */}
            {escrow.conditions && escrow.conditions.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">Conditions</p>
                <ul className="space-y-2">
                  {escrow.conditions.map((condition) => (
                    <li key={condition.id} className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{condition.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={isLoading || (confirmationType === 'accept')}
              className={`flex-1 px-4 py-2.5 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmationType === 'reject'
                  ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                  : 'border border-red-300 text-red-700 hover:bg-red-50 focus:ring-red-500'
              }`}
            >
              {isLoading && confirmationType === 'reject' ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Rejecting...</span>
                </span>
              ) : confirmationType === 'reject' ? (
                'Confirm Reject'
              ) : (
                'Reject'
              )}
            </button>
            <button
              onClick={handleAccept}
              disabled={isLoading || (confirmationType === 'reject')}
              className={`flex-1 px-4 py-2.5 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmationType === 'accept'
                  ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              {isLoading && confirmationType === 'accept' ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Accepting...</span>
                </span>
              ) : confirmationType === 'accept' ? (
                'Confirm Accept'
              ) : (
                'Accept'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartyAcceptanceModal;
