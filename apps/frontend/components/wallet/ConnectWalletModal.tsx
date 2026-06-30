'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ExternalLink, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
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
  const { connect, getAvailableWallets, isConnecting, error: contextError } = useWallet();
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletKey | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

  // Hydrate supported local platform targets when modal swings open
  useEffect(() => {
    if (!isOpen) return;
    setLocalError(null);
    setSelectedWallet(null);
    
    getAvailableWallets()
      .then((wallets) => setAvailableWallets(wallets))
      .catch((err) => console.error('[Wallet Modal] Failed to parse extensions:', err));
  }, [isOpen, getAvailableWallets]);

  // Cleanup timeout handles when tearing down components
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleConnect = useCallback(async (walletType: WalletKey) => {
    // Prevent double-submits / concurrent racing threads
    if (isConnecting) return;

    setSelectedWallet(walletType);
    setLocalError(null);

    // 1. Enforce Timeout Race Loop (30 Seconds)
    timeoutRef.current = setTimeout(() => {
      if (isConnecting || selectedWallet === walletType) {
        setLocalError('Connection handshake timed out after 30 seconds. Please try again.');
        setSelectedWallet(null);
        console.error(`[Wallet Timeout] Connection request dropped for type: ${walletType}`);
      }
    }, 30000);

    try {
      await connect(walletType as any);
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onClose();
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setSelectedWallet(null);

      // 2. Structural Error Signature Dissection
      const errMsg = err?.message || '';
      if (errMsg.includes('User rejected') || err?.status === 'rejected' || err?.code === 4001) {
        setLocalError('Connection request was cancelled by the user.');
      } else if (errMsg.includes('network') || errMsg.includes('Network')) {
        setLocalError(`Wallet configuration mismatch. Please switch your extension network manually to ${targetNetwork}.`);
      } else if (errMsg.includes('locked') || errMsg.includes('Locked')) {
        setLocalError('Your provider extension appears to be locked. Please open the vault extension and authenticate.');
      } else {
        setLocalError(errMsg || 'An unexpected verification error dropped during handshake.');
      }

      console.error(`[Wallet Connection Failure] Context mapping for ${walletType}:`, err);
    }
  }, [isConnecting, connect, onClose, targetNetwork, selectedWallet]);

  if (!isOpen) return null;

  // Derive consolidated active error frames
  const displayError = localError || contextError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 p-6 shadow-2xl space-y-5">
        
        {/* HEADER SECTION */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white">Connect Wallet</h2>
            <p className="text-gray-400 text-xs mt-0.5">Choose a ledger provider link to connect to Vaultix</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={isConnecting}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30"
            aria-label="Close Modal"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* ACTIONABLE CONTEXTUAL ERROR ANCHORS */}
        {displayError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-400 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="leading-relaxed font-medium">{displayError}</p>
              {selectedWallet && (
                <button
                  type="button"
                  onClick={() => handleConnect(selectedWallet)}
                  className="flex items-center gap-1 font-bold text-red-300 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Handshake
                </button>
              )}
            </div>
          </div>
        )}

        {/* INTEGRATED CARD OPTION BUTTON LIST */}
        <div className="space-y-2.5">
          {(Object.entries(WALLET_INFO) as [WalletKey, typeof WALLET_INFO[WalletKey]][]).map(([type, info]) => {
            const isAvailable = info.alwaysAvailable || availableWallets.includes(type);
            const isConnectingThis = selectedWallet === type && isConnecting;

            return (
              <button
                key={type}
                type="button"
                onClick={() => isAvailable && handleConnect(type)}
                disabled={(!isAvailable && !info.installUrl) || isConnecting}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all border text-left ${
                  isAvailable
                    ? 'bg-gray-800/80 border-gray-700 hover:bg-gray-700/90 hover:border-gray-600 cursor-pointer active:scale-[0.99]'
                    : 'bg-gray-900/40 border-gray-800/60 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <span className="text-xl select-none" role="img" aria-hidden="true">{info.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white truncate">{info.name}</span>
                      {isAvailable ? (
                        <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-400 font-bold tracking-wide uppercase rounded">
                          Ready
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 font-bold tracking-wide uppercase rounded">
                          Absent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{info.description}</p>
                  </div>
                </div>

                {/* DYNAMIC ACTION ROW LABELS */}
                <div className="flex items-center space-x-2 flex-shrink-0 font-semibold text-xs pl-2">
                  {isConnectingThis ? (
                    <div className="flex items-center space-x-1.5 text-blue-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Linking...</span>
                    </div>
                  ) : isAvailable ? (
                    <Check className="w-4 h-4 text-green-400 stroke-[3]" />
                  ) : (
                    <a
                      href={info.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()} // Stop row trigger bubbles
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-0.5 py-1 px-2 hover:bg-blue-500/10 rounded transition-colors"
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

        {/* FOOTER NETWORK INDEX SUMMARY */}
        <div className="mt-4 pt-4 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-1.5">
          <span className="text-gray-400 font-medium">Target Context Cluster</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${targetNetwork === 'mainnet' ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="font-mono font-bold uppercase text-gray-200">
              {targetNetwork}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};