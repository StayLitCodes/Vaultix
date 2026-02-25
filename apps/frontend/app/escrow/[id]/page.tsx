'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEscrow } from '@/hooks/useEscrow';
import { useWallet } from '@/hooks/useWallet';
import EscrowHeader from '@/components/escrow/detail/EscrowHeader';
import PartiesSection from '@/components/escrow/detail/PartiesSection';
import TermsSection from '@/components/escrow/detail/TermsSection';
import TimelineSection from '@/components/escrow/detail/TimelineSection';
import TransactionHistory from '@/components/escrow/detail/TransactionHistory';
import ActivityFeed from '@/components/common/ActivityFeed';
import { IEscrowExtended } from '@/types/escrow';
import FileDisputeModal from '@/components/escrow/detail/file-dispute-modal';
import { Button } from '@/components/ui/button';
import { EscrowDetailSkeleton } from '@/components/ui/EscrowDetailSkeleton';

const EscrowDetailPage = () => {
  const { id } = useParams();

  const { escrow, error, loading } = useEscrow(id as string);
  const { connected, publicKey, connect } = useWallet(); // Assuming wallet hook exists
  const [userRole, setUserRole] = useState<'creator' | 'counterparty' | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);

  useEffect(() => {
    if (escrow && publicKey) {
      if (escrow.creatorId === publicKey) {
        setUserRole('creator');
      } else if (escrow.parties?.some((party: any) => party.userId === publicKey)) {
        setUserRole('counterparty');
      }
    }
  }, [escrow, publicKey]);

  if (loading) {
    return (
      // <div className="min-h-screen flex items-center justify-center bg-gray-50">
      //   <div className="text-center">
      //     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      //     <p className="mt-4 text-lg text-gray-600">Loading escrow details...</p>
      //   </div>
      // </div>
      <EscrowDetailSkeleton />
    );
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
        {/* Header Section */}
        <EscrowHeader
          escrow={escrow}
          userRole={userRole}
          connected={connected}
          connect={connect}
          publicKey={publicKey}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Parties Section */}
            <PartiesSection escrow={escrow} userRole={userRole} />

            {/* Timeline Section */}
            <TimelineSection escrow={escrow} />

            {/* Activity Feed */}
            <ActivityFeed escrowId={id as string} />
          </div>

          <div className="lg:col-span-1">
            {/* Terms Section */}
            <TermsSection escrow={escrow} userRole={userRole} />
          </div>
        </div>
      </div>

      <FileDisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        escrowId={escrow.id}
      />
    </div>
  );
};

export default EscrowDetailPage;