'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEscrow } from '@/hooks/useEscrow';
import { useWallet } from '@/hooks/useWallet';
import EscrowHeader from '@/components/escrow/detail/EscrowHeader';
import PartiesSection from '@/components/escrow/detail/PartiesSection';
import TermsSection from '@/components/escrow/detail/TermsSection';
import TimelineSection from '@/components/escrow/detail/TimelineSection';
import ActivityFeed from '@/components/common/ActivityFeed';
import ConditionsList from '@/component/escrow/ConditionsList';
import { IParty } from '@/types/escrow';
import FileDisputeModal from '@/components/escrow/detail/file-dispute-modal';
import DisputeSection from '@/components/escrow/detail/DisputeSection';
import ArbitratorResolutionModal from '@/components/escrow/detail/ArbitratorResolutionModal';
import { Button } from '@/components/ui/button';
import { EscrowDetailSkeleton } from '@/components/ui/EscrowDetailSkeleton';

const EscrowDetailPage = () => {
  const { id } = useParams();

  const { escrow, error, loading, refetch } = useEscrow(id as string);
  const { connected, publicKey, connect } = useWallet();
  const [userRole, setUserRole] = useState<'creator' | 'counterparty' | 'arbitrator' | null>(null);
  const [currentParty, setCurrentParty] = useState<IParty | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [dispute, setDispute] = useState<any>(null);

  useEffect(() => {
    if (escrow && publicKey) {
      if (escrow.creatorId === publicKey) {
        setUserRole('creator');
        setCurrentParty(null);
      } else if (escrow.parties?.some((party) => party.userId === publicKey)) {
        setUserRole('counterparty');
        setCurrentParty(
          escrow.parties.find((party) => party.userId === publicKey) ?? null,
        );
      } else {
        setUserRole(null);
        setCurrentParty(null);
      }
    } else {
      setUserRole(null);
      setCurrentParty(null);
    }
  }, [escrow, publicKey]);

  if (loading) {
    return <EscrowDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Escrow</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Escrow Not Found</h2>
          <p className="text-gray-600">The requested escrow agreement could not be found.</p>
          <Link
            href="/escrow"
            className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back to Escrows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <EscrowHeader
          escrow={escrow}
          userRole={userRole}
          connected={connected}
          connect={connect}
          publicKey={publicKey}
          onFileDispute={() => setDisputeOpen(true)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Dispute Section (only show if disputed) */}
            {escrow.status === 'DISPUTED' && (
              <DisputeSection
                escrowId={escrow.id}
                escrowStatus={escrow.status}
                userRole={userRole}
                publicKey={publicKey}
                onDisputeUpdate={() => {
                  // Refresh escrow data to get updated status
                  window.location.reload();
                }}
              />
            )}
            <PartiesSection
              escrow={escrow}
              currentParty={currentParty}
              onEscrowUpdated={refetch}
              userRole={userRole}
            />

            <ConditionsList
              escrowId={escrow.id}
              escrowStatus={escrow.status}
              conditions={escrow.conditions}
              currentParty={currentParty}
              onConditionsUpdated={refetch}
            />

            <TimelineSection escrow={escrow} />

            <ActivityFeed escrowId={id as string} />
          </div>

          <div className="lg:col-span-1">
            <TermsSection escrow={escrow} userRole={userRole} />
          </div>
        </div>
      </div>

      <FileDisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        escrowId={escrow.id}
        userRole={userRole}
        escrowStatus={escrow.status}
      />

      <ArbitratorResolutionModal
        open={resolutionOpen}
        onClose={() => setResolutionOpen(false)}
        dispute={dispute}
        escrowAmount={escrow.amount}
        escrowAsset={escrow.asset}
        onResolutionComplete={() => {
          // Refresh escrow data to get updated status
          window.location.reload();
        }}
      />
    </div>
  );
};

export default EscrowDetailPage;
