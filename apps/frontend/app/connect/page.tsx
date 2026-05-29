'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ConnectWalletModal } from '@/components/wallet/ConnectWalletModal';
import { useWalletConnection } from '@/app/hooks/useWallet';

export default function ConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') ?? '/dashboard';
  const { isConnected } = useWalletConnection();
  const [isModalOpen, setIsModalOpen] = useState(true);

  useEffect(() => {
    if (isConnected) {
      router.replace(returnUrl);
    }
  }, [isConnected, returnUrl, router]);

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl bg-white shadow-xl rounded-3xl border border-gray-200 overflow-hidden">
        <div className="px-8 py-10 sm:px-12">
          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-semibold text-gray-900">Connect Your Wallet</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Vaultix requires a wallet connection before you can access protected escrow flows. After you connect, you will be returned to the page you came from.
            </p>
            <p className="text-sm text-gray-500">
              Return path: <span className="font-mono text-xs text-gray-700 break-all">{returnUrl}</span>
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-full bg-blue-600 px-6 py-3 text-white font-medium shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-colors"
            >
              Open Wallet Connect
            </button>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              Back to home
            </Link>
          </div>
        </div>
      </div>

      <ConnectWalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
