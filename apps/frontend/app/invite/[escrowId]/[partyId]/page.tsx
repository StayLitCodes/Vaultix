'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEscrow } from '@/hooks/useEscrow';
import { useWalletConnection } from '@/app/hooks/useWallet';
import { ConnectWalletModal } from '@/components/wallet/ConnectWalletModal';

export default function InviteAcceptancePage() {
  const { escrowId, partyId } = useParams();
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { escrow, loading, error } = useEscrow(escrowId as string);
  const { isConnected, publicKey } = useWalletConnection();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted && !isConnected) {
      router.replace(`/connect?returnUrl=${encodeURIComponent(router.asPath)}`);
    }
  }, [hasMounted, isConnected, router]);

  const invitedParty = useMemo(() => {
    return escrow?.parties?.find(
      (party) => party.id === partyId || party.userId === partyId
    );
  }, [escrow, partyId]);

  const isCorrectWallet = invitedParty?.userId === publicKey;

  const handleAction = async (type: 'accept' | 'reject') => {
    if (!escrowId || !partyId) {
      setActionError('Invalid invitation link.');
      return;
    }

    setActionError(null);
    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/escrows/${escrowId}/parties/${partyId}/${type}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Unable to process invitation.' }));
        throw new Error(data.message || 'Unable to process invitation.');
      }

      setSuccessMessage(
        type === 'accept'
          ? 'Your acceptance has been recorded successfully.'
          : 'The invitation was rejected successfully.'
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to complete this action.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!hasMounted || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Connect to Accept Invitation</h2>
          <p className="text-gray-600">
            Please connect your wallet so Vaultix can verify your invitation and continue.
          </p>
          <p className="mt-3 text-sm text-gray-500">Redirecting to wallet connect page now.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">Loading invitation details…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Invalid Invitation</h2>
          <p className="text-gray-600">{error}</p>
          <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!escrow || !invitedParty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Invitation Not Found</h2>
          <p className="text-gray-600">
            This invitation link is not valid for any party on the selected escrow.
          </p>
          <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!isCorrectWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Wallet Mismatch</h2>
          <p className="text-gray-600">
            The connected wallet does not match the invitation recipient.
          </p>
          <p className="mt-2 text-sm text-gray-500 break-words">
            Expected invitation wallet: <span className="font-mono">{invitedParty.userId}</span>
          </p>
          <Link
            href={`/connect?returnUrl=${encodeURIComponent(router.asPath)}`}
            className="mt-6 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Switch Wallet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-8 py-10 sm:px-12">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold text-gray-900">Accept Escrow Invitation</h1>
            <p className="text-gray-600">
              You were invited as the <span className="font-semibold">{invitedParty.role.toLowerCase()}</span> for escrow <span className="font-mono">{escrow.id}</span>.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-lg font-semibold text-gray-900">Escrow Details</h2>
              <dl className="mt-4 space-y-3 text-sm text-gray-700">
                <div>
                  <dt className="font-medium">Title</dt>
                  <dd>{escrow.title}</dd>
                </div>
                <div>
                  <dt className="font-medium">Amount</dt>
                  <dd>{escrow.amount} {escrow.asset}</dd>
                </div>
                <div>
                  <dt className="font-medium">Created</dt>
                  <dd>{new Date(escrow.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-lg font-semibold text-gray-900">Your Invitation</h2>
              <p className="mt-3 text-sm text-gray-700">
                Wallet address: <span className="font-mono break-all">{invitedParty.userId}</span>
              </p>
              <p className="mt-2 text-sm text-gray-700">Status: <span className="font-semibold">{invitedParty.status}</span></p>
            </div>
          </div>

          {actionError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {actionError}
            </div>
          )}

          {successMessage ? (
            <div className="mt-6 rounded-3xl border border-green-200 bg-green-50 p-6 text-green-800">
              <p className="font-semibold">{successMessage}</p>
              <p className="mt-2 text-sm text-gray-700">You can now review the full escrow agreement.</p>
              <Link
                href={`/escrow/${escrow.id}`}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-white text-sm font-medium hover:bg-blue-700"
              >
                View Escrow Details
              </Link>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('accept')}
                className="inline-flex justify-center rounded-full bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Accepting…' : 'Accept Invitation'}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('reject')}
                className="inline-flex justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Rejecting…' : 'Reject Invitation'}
              </button>
            </div>
          )}

          <div className="mt-8 text-sm text-gray-500">
            <p>
              If you do not want to accept this invitation, you can safely return to the escrow page later.
            </p>
          </div>
        </div>
      </div>

      <ConnectWalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
