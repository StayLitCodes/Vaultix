'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Check, Loader2 } from 'lucide-react';
import { useWallet } from '@/app/contexts/WalletContext';
import { getWalletPlatformInfo } from '@/lib/wallet-platform';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WALLET_INFO = {
  freighter: {
    name: 'Freighter',
    description: 'Desktop extension wallet',
    icon: '🚀',
    installUrl: 'https://www.freighter.app/',
    alwaysAvailable: false,
  },
  albedo: {
    name: 'Albedo',
    description: 'Browser-based wallet for mobile signing',
    icon: '✨',
    installUrl: 'https://albedo.link/',
    alwaysAvailable: true,
  },
  lobstr: {
    name: 'Lobstr',
    description: 'Desktop extension wallet',
    icon: '🦞',
    installUrl: 'https://lobstr.co/vault/',
    alwaysAvailable: false,
  },
} as const;

type WalletKey = keyof typeof WALLET_INFO;

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({ isOpen, onClose }) => {
  const { connect, getAvailableWallets, isConnecting, error } = useWallet();
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [failedWallet, setFailedWallet] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFailedWallet(null);
      setSelectedWallet(null);
      return;
    }

    getAvailableWallets().then((wallets) => setAvailableWallets(wallets));
  }, [isOpen, getAvailableWallets]);

  const platformInfo = getWalletPlatformInfo(availableWallets);
  const walletOrder = platformInfo.orderedWallets.filter((walletType) => walletType in WALLET_INFO) as WalletKey[];
  const displayedError = failedWallet ? error : null;

  const handleConnect = async (walletType: string) => {
    setFailedWallet(null);
    setSelectedWallet(walletType);

    try {
      await connect(walletType as any);
      setFailedWallet(null);
      onClose();
    } catch {
      setFailedWallet(walletType);
    } finally {
      setSelectedWallet(null);
    }
  };

  const handleRetry = async () => {
    if (failedWallet) {
      await handleConnect(failedWallet);
    }
  };

  const handleSwitchWallet = () => {
    setFailedWallet(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
            <p className="text-gray-400 text-sm mt-1">Choose a wallet to connect to Vaultix</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {platformInfo.platform === 'mobile' && (
          <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-200">{platformInfo.recommendationCopy}</p>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200">
                Recommended
              </span>
            </div>
            <p className="mt-2 text-xs text-blue-100/90">
              {platformInfo.limitations[0]}
            </p>
            <p className="mt-1 text-xs text-blue-100/80">
              {platformInfo.limitations[1]}
            </p>
          </div>
        )}

        {/* Error Message */}
        {displayedError && failedWallet && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm font-semibold text-red-200">Connection failed</p>
            <p className="mt-1 text-sm text-red-100">{displayedError}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleRetry}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400"
              >
                Retry connection
              </button>
              <button
                onClick={handleSwitchWallet}
                className="rounded-lg border border-red-300/40 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
              >
                Switch wallet
              </button>
            </div>
          </div>
        )}

        {/* Wallet Options */}
        <div className="space-y-3">
          {walletOrder.map((type) => {
            const info = WALLET_INFO[type];
            const isMobileOnly = platformInfo.platform === 'mobile' && type !== 'albedo';
            const isRecommended = platformInfo.recommendedWallet === type;
            const isAvailable = info.alwaysAvailable || availableWallets.includes(type);
            const isSupportedOnPlatform = !isMobileOnly;
            const isConnectingThis = selectedWallet === type && isConnecting;
            const isEnabled = isAvailable && isSupportedOnPlatform && !isConnecting;

            return (
              <button
                key={type}
                onClick={() => isEnabled && handleConnect(type)}
                disabled={!isEnabled}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 border ${
                  isRecommended
                    ? 'border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                } ${
                  isEnabled ? 'hover:scale-[1.02] active:scale-[0.98]' : 'opacity-70 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{info.icon}</div>
                  <div className="text-left">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">{info.name}</span>
                      {isRecommended && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200">
                          Mobile-first
                        </span>
                      )}
                      {isMobileOnly && (
                        <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-200">
                          Desktop only
                        </span>
                      )}
                      {!isAvailable && !isMobileOnly && (
                        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-200">
                          Not installed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {isMobileOnly ? 'Desktop extension wallet — switch to a desktop browser or use Albedo' : info.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {isConnectingThis && (
                    <div className="flex items-center space-x-1 text-blue-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Connecting…</span>
                    </div>
                  )}
                  {isEnabled && !isConnectingThis && (
                    <Check className="w-5 h-5 text-green-400" />
                  )}
                  {!isEnabled && isMobileOnly && (
                    <span className="text-xs text-gray-300">Desktop only</span>
                  )}
                  {!isEnabled && !isMobileOnly && !info.alwaysAvailable && (
                    <a
                      href={info.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span>Install</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Network Info */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Network</span>
            <span className="text-sm font-medium text-yellow-400">
              {process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Mobile users should use the browser-based Albedo flow. Desktop extensions work best on desktop browsers.
          </p>
        </div>
      </div>
    </div>
  );
};
