'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  acceptPartyInvitation,
  rejectPartyInvitation,
} from '@/lib/escrow-api';
import { ICondition, IEscrowExtended, IParty } from '@/types/escrow';
import { PartyAcceptanceModal } from '../modals/PartyAcceptanceModal';

interface PartiesSectionProps {
  escrow: IEscrowExtended;
  userRole: 'creator' | 'counterparty' | 'arbitrator' | null;
  currentParty: IParty | null;
  onEscrowUpdated: () => Promise<void>;
}

const getRoleColor = (role: string) => {
  switch (role.toUpperCase()) {
    case 'BUYER':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    case 'SELLER':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'ARBITRATOR':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toUpperCase()) {
    case 'ACCEPTED':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300';
  }
};

const getStatusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

const PartiesSection: React.FC<PartiesSectionProps> = ({
  escrow,
  currentParty,
  onEscrowUpdated,
}: PartiesSectionProps) => {
  const [selectedParty, setSelectedParty] = useState<IParty | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleOpenModal = (party: IParty) => {
    setSelectedParty(party);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedParty(null);
  };

  const handleAccept = async (escrowId: string, partyId: string) => {
    await acceptPartyInvitation(escrowId, partyId);
    setActionMessage('Invitation accepted. Updating party status...');
    setIsRefreshing(true);
    try {
      await onEscrowUpdated();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReject = async (escrowId: string, partyId: string) => {
    await rejectPartyInvitation(escrowId, partyId);
    setActionMessage('Invitation rejected. Updating party status...');
    setIsRefreshing(true);
    try {
      await onEscrowUpdated();
    } finally {
      setIsRefreshing(false);
    }
  };

  const pendingInvitation =
    currentParty?.status.toUpperCase() === 'PENDING' ? currentParty : null;

  return (
    <div className="bg-card text-card-foreground rounded-lg shadow p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-foreground">Parties</h2>
        {isRefreshing && (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Refreshing
          </span>
        )}
      </div>

      {pendingInvitation && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-500">
                Invitation pending your response
              </h3>
              <p className="mt-1 text-sm text-amber-500/80">
                You&apos;ve been invited as the {pendingInvitation.role.toLowerCase()} on this
                escrow. Review the agreement before you accept or reject it.
              </p>
            </div>
            <button
              onClick={() => handleOpenModal(pendingInvitation)}
              disabled={escrow.status.toUpperCase() === 'CANCELLED'}
              className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              Review invitation
            </button>
          </div>
        </div>
      )}

      {actionMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-500">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{actionMessage}</p>
        </div>
      )}

      <div className="space-y-4">
        {escrow.parties.map((party: IParty) => (
          <div key={party.id} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(party.role)}`}>
                    {party.role}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(party.status)}`}>
                    {getStatusLabel(party.status)}
                  </span>
                  {currentParty?.id === party.id && (
                    <span className="inline-flex items-center rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">
                      You
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">User ID:</span> {party.userId}
                </p>
              </div>

              {currentParty?.id === party.id &&
                party.status.toUpperCase() === 'PENDING' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal(party)}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors cursor-pointer"
                  >
                    Respond
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {escrow.conditions && escrow.conditions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-foreground mb-3">Conditions</h3>
          <ul className="space-y-2">
            {escrow.conditions.map((condition: ICondition) => (
              <li key={condition.id} className="flex items-start">
                <div className="flex-shrink-0 h-5 w-5 text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-muted-foreground">{condition.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedParty && (
        <PartyAcceptanceModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          escrow={escrow}
          party={selectedParty}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {currentParty?.status.toUpperCase() === 'REJECTED' && (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>You have already rejected this invitation.</p>
        </div>
      )}

      {currentParty?.status.toUpperCase() === 'ACCEPTED' && (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-400">
          <UserCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>Your invitation has already been accepted and your status is up to date.</p>
        </div>
      )}

      {pendingInvitation && escrow.status.toUpperCase() === 'CANCELLED' && (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>This escrow has been cancelled, so the invitation can no longer be accepted.</p>
        </div>
      )}
    </div>
  );
};

export default PartiesSection;
