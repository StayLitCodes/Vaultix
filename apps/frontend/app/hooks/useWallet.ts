import { useWallet as useWalletContext } from "../contexts/WalletContext";



export const useWalletConnection = () => {
  const { wallet, isConnecting, error, connect, disconnect } = useWalletContext();
  
  return {
    isConnected: !!wallet,
    wallet,
    isConnecting,
    error,
    connect,
    disconnect,
    publicKey: wallet?.publicKey,
    walletType: wallet?.walletType,
    network: wallet?.network,
  };
};