import { FreighterService } from './freighter';
import { AlbedoService } from './albedo';

export enum WalletType {
  FREIGHTER = 'freighter',
  ALBEDO = 'albedo',
}

export interface WalletConnection {
  publicKey: string;
  walletType: WalletType;
  network: string;
}

export interface IWalletService {
  connect(): Promise<string>;
  signTransaction(xdr: string): Promise<string>;
  getNetwork?(): Promise<string>;
  isInstalled?(): Promise<boolean>;
  disconnect?(): Promise<void>;
}

export class WalletServiceFactory {
  static getService(walletType: WalletType): IWalletService {
    switch (walletType) {
      case WalletType.FREIGHTER:
        return FreighterService.getInstance();
      case WalletType.ALBEDO:
        return AlbedoService.getInstance();
      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }

  static async getAvailableWallets(): Promise<WalletType[]> {
    const availableWallets: WalletType[] = [];
    
    // Check for Freighter
    const freighterService = FreighterService.getInstance();
    try {
      if (await freighterService.isInstalled?.()) {
        availableWallets.push(WalletType.FREIGHTER);
      }
    } catch {
      // Freighter not available
    }
    
    // Albedo is always available as it's a web-based wallet
    availableWallets.push(WalletType.ALBEDO);
    
    return availableWallets;
  }
}