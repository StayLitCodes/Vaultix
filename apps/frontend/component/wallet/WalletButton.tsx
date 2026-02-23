'use client';

import React, { useState } from 'react';
import { Wallet, LogOut, Copy, Check, AlertCircle } from 'lucide-react';
import { useWalletConnection } from '@/app/hooks/useWallet';
import { ConnectWalletModal } from './ConnectWalletModal';
import { truncateAddress } from '@/lib/utils';

export const WalletButton: React.FC = () => {
  const { isConnected, wallet, disconnect, network } = useWalletConnection();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const handleCopyAddress = () => {
    if (wallet?.publicKey) {
      navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDisconnect(false);
  };

  if (!isConnected) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Wallet className="w-4 h-4" />
          <span className="font-medium">Connect Wallet</span>
        </button>

        <ConnectWalletModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center space-x-3">
        {/* Network Indicator */}
        {network !== process.env.NEXT_PUBLIC_STELLAR_NETWORK && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span className="text-xs text-red-400">Wrong Network</span>
          </div>
        )}

        {/* Wallet Info */}
        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-lg">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-300">
            {truncateAddress(wallet!.publicKey)}
          </span>
        </div>

        {/* Actions Dropdown Trigger */}
        <button
          onClick={() => setShowDisconnect(!showDisconnect)}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Wallet className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {showDisconnect && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
          <div className="p-4">
            {/* Wallet Info */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Connected with</p>
              <p className="text-sm font-medium text-white capitalize">
                {wallet!.walletType}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-400">
                  {truncateAddress(wallet!.publicKey, 12)}
                </p>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Network Info */}
            <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Network</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300 capitalize">
                  {wallet!.network}
                </p>
                {wallet!.network === process.env.NEXT_PUBLIC_STELLAR_NETWORK ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">Correct</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-xs text-red-400">Wrong</span>
                  </div>
                )}
              </div>
            </div>

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">Disconnect</span>
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDisconnect && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDisconnect(false)}
        />
      )}
    </div>
  );
};