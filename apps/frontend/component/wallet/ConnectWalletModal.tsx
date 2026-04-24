'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Check, Loader2 } from 'lucide-react';
import { useWallet } from '@/app/contexts/WalletContext';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WALLET_INFO = {
  freighter: {
    name: 'Freighter',
    description: 'Browser extension wallet',
    icon: '🚀',
    installUrl: 'https://www.freighter.app/',
    alwaysAvailable: false,
  },
  albedo: {
    name: 'Albedo',
    description: 'Web-based wallet — no extension needed',
    icon: '✨',
    installUrl: 'https://albedo.link/',
    alwaysAvailable: true,
  },
  lobstr: {
    name: 'Lobstr',
    description: 'Browser extension wallet',
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

  useEffect(() => {
    if (!isOpen) return;
    getAvailableWallets().then((wallets) => setAvailableWallets(wallets));
  }, [isOpen, getAvailableWallets]);

  const handleConnect = async (walletType: string) => {
    try {
      setSelectedWallet(walletType);
      await connect(walletType as any);
      onClose();
    } catch {
      // Error surfaced via context
    } finally {
      setSelectedWallet(null);
    }
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

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Wallet Options */}
        <div className="space-y-3">
          {(Object.entries(WALLET_INFO) as [WalletKey, typeof WALLET_INFO[WalletKey]][]).map(([type, info]) => {
            const isAvailable = info.alwaysAvailable || availableWallets.includes(type);
            const isConnectingThis = selectedWallet === type && isConnecting;

            return (
              <button
                key={type}
                onClick={() => isAvailable && handleConnect(type)}
                disabled={!isAvailable || isConnecting}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 border border-gray-700 ${
                  isAvailable
                    ? 'bg-gray-800 hover:bg-gray-700 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gray-900/50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{info.icon}</div>
                  <div className="text-left">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white">{info.name}</span>
                      {!isAvailable && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
                          Not installed
                        </span>
                      )}
                      {isAvailable && !isConnectingThis && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                          Ready
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{info.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {isConnectingThis && (
                    <div className="flex items-center space-x-1 text-blue-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Connecting…</span>
                    </div>
                  )}
                  {isAvailable && !isConnectingThis && (
                    <Check className="w-5 h-5 text-green-400" />
                  )}
                  {!isAvailable && (
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
            Make sure your wallet is connected to the correct network
          </p>
        </div>
      </div>
    </div>
  );
};
