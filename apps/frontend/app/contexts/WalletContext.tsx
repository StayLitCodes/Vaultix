'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletType, WalletConnection, WalletServiceFactory } from '../services/wallet';

export interface ConnectedAccount extends WalletConnection {
  provider?: string;
  isConnected?: boolean;
}

interface WalletContextType {
  wallet: WalletConnection | null;
  activeAccount: WalletConnection | null;
  connectedAccounts: WalletConnection[];
  isConnecting: boolean;
  error: string | null;
  connect: (walletType: WalletType) => Promise<void>;
  switchAccount: (publicKey: string) => void;
  disconnect: (publicKey?: string) => void;
  signTransaction: (xdr: string) => Promise<string>;
  getAvailableWallets: () => Promise<WalletType[]>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [connectedAccounts, setConnectedAccounts] = useState<WalletConnection[]>([]);
  const [activeAccount, setActiveAccount] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load connected wallets from localStorage on mount
  useEffect(() => {
    const savedWallets = window.localStorage.getItem('vaultix_connected_wallets');
    const legacyWallet = window.localStorage.getItem('vaultix_wallet');

    if (savedWallets) {
      try {
        const parsed = JSON.parse(savedWallets) as WalletConnection[];
        setConnectedAccounts(parsed);
        if (parsed.length > 0) {
          setActiveAccount(parsed[0]);
        }
      } catch {
        window.localStorage.removeItem('vaultix_connected_wallets');
      }
    } else if (legacyWallet) {
      // Migrate legacy single wallet setup
      try {
        const parsed = JSON.parse(legacyWallet) as WalletConnection;
        setConnectedAccounts([parsed]);
        setActiveAccount(parsed);
        window.localStorage.setItem('vaultix_connected_wallets', JSON.stringify([parsed]));
      } catch {
        window.localStorage.removeItem('vaultix_wallet');
      }
    }
  }, []);

  const saveToStorage = (accounts: WalletConnection[]) => {
    setConnectedAccounts(accounts);
    window.localStorage.setItem('vaultix_connected_wallets', JSON.stringify(accounts));
    if (accounts.length > 0 && activeAccount) {
      const stillActive = accounts.find((acc) => acc.publicKey === activeAccount.publicKey);
      if (!stillActive) {
        setActiveAccount(accounts[0]);
      }
    } else if (accounts.length === 0) {
      setActiveAccount(null);
    }
  };

  const connect = async (walletType: WalletType) => {
    setIsConnecting(true);
    setError(null);

    try {
      const service = WalletServiceFactory.getService(walletType);
      const publicKey = await service.connect();
      
      let network = 'testnet';
      if (walletType === WalletType.FREIGHTER) {
        network = await service.getNetwork?.() || 'testnet';
      } else if (walletType === WalletType.ALBEDO) {
        network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
      }

      const newConnection: WalletConnection = {
        publicKey,
        walletType,
        network,
      };

      // Check if account already exists in connected list, otherwise append or insert
      const filtered = connectedAccounts.filter((acc) => acc.publicKey !== publicKey);
      const updatedAccounts = [newConnection, ...filtered];

      setConnectedAccounts(updatedAccounts);
      setActiveAccount(newConnection);
      window.localStorage.setItem('vaultix_connected_wallets', JSON.stringify(updatedAccounts));
      
      // Keep legacy key in sync for backward compatibility
      window.localStorage.setItem('vaultix_wallet', JSON.stringify(newConnection));
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const switchAccount = (publicKey: string) => {
    const target = connectedAccounts.find((acc) => acc.publicKey === publicKey);
    if (target) {
      setActiveAccount(target);
      window.localStorage.setItem('vaultix_wallet', JSON.stringify(target));
      window.dispatchEvent(new CustomEvent('wallet:switched', { detail: target }));
    }
  };

  const disconnect = (publicKey?: string) => {
    if (publicKey) {
      const updated = connectedAccounts.filter((acc) => acc.publicKey !== publicKey);
      saveToStorage(updated);
      if (activeAccount?.publicKey === publicKey) {
        setActiveAccount(updated.length > 0 ? updated[0] : null);
        if (updated.length > 0) {
          window.localStorage.setItem('vaultix_wallet', JSON.stringify(updated[0]));
        } else {
          window.localStorage.removeItem('vaultix_wallet');
        }
      }
    } else {
      // Full disconnect of all accounts
      setConnectedAccounts([]);
      setActiveAccount(null);
      window.localStorage.removeItem('vaultix_connected_wallets');
      window.localStorage.removeItem('vaultix_wallet');
    }
    setError(null);
  };

  const signTransaction = async (xdr: string): Promise<string> => {
    if (!activeAccount) {
      throw new Error('No active wallet connected');
    }

    const service = WalletServiceFactory.getService(activeAccount.walletType);
    return await service.signTransaction(xdr);
  };

  const getAvailableWallets = async (): Promise<WalletType[]> => {
    return await WalletServiceFactory.getAvailableWallets();
  };

  return (
    <WalletContext.Provider
      value={{
        wallet: activeAccount, // Backward compatibility for single-wallet consumers
        activeAccount,
        connectedAccounts,
        isConnecting,
        error,
        connect,
        switchAccount,
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