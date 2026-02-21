'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletType, WalletConnection, WalletServiceFactory } from '../services/wallet';

interface WalletContextType {
  wallet: WalletConnection | null;
  isConnecting: boolean;
  error: string | null;
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
  getAvailableWallets: () => Promise<WalletType[]>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load wallet from localStorage on mount
  useEffect(() => {
    const savedWallet = window.localStorage.getItem('vaultix_wallet');
    if (savedWallet) {
      try {
        const parsedWallet = JSON.parse(savedWallet) as WalletConnection;
        setWallet(parsedWallet);
      } catch {
        window.localStorage.removeItem('vaultix_wallet');
      }
    }
  }, []);

  const connect = async (walletType: WalletType) => {
    setIsConnecting(true);
    setError(null);

    try {
      const service = WalletServiceFactory.getService(walletType);
      const publicKey = await service.connect();
      
      let network = 'testnet'; // Default
      if (walletType === WalletType.FREIGHTER) {
        network = await service.getNetwork?.() || 'testnet';
      } else if (walletType === WalletType.ALBEDO) {
        network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
      }

      const walletConnection: WalletConnection = {
        publicKey,
        walletType,
        network,
      };

      setWallet(walletConnection);
      window.localStorage.setItem('vaultix_wallet', JSON.stringify(walletConnection));
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    window.localStorage.removeItem('vaultix_wallet');
    setError(null);
  };

  const signTransaction = async (xdr: string): Promise<string> => {
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    const service = WalletServiceFactory.getService(wallet.walletType);
    return await service.signTransaction(xdr);
  };

  const getAvailableWallets = async (): Promise<WalletType[]> => {
    return await WalletServiceFactory.getAvailableWallets();
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isConnecting,
        error,
        connect,
        disconnect,
        signTransaction,
        getAvailableWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};