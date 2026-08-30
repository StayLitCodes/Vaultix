/**
 * @file freighter.ts
 * @description Centralized Freighter wallet service leveraging the official `@stellar/freighter-api` package.
 */

import { 
  isConnected as freighterIsConnected, 
  getAddress as freighterGetAddress, 
  signTransaction as freighterSignTransaction,
  requestAccess as freighterRequestAccess,
  getNetwork as freighterGetNetwork
} from '@stellar/freighter-api';

export interface FreighterWallet {
  isConnected: () => Promise<boolean>;
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string, opts?: any) => Promise<string>;
  getNetwork: () => Promise<string>;
}

export class FreighterService {
  private static instance: FreighterService;

  private constructor() {}

  /**
   * Retrieves the singleton instance of the FreighterService.
   * @returns {FreighterService} The singleton service instance.
   */
  public static getInstance(): FreighterService {
    if (!FreighterService.instance) {
      FreighterService.instance = new FreighterService();
    }
    return FreighterService.instance;
  }

  /**
   * Checks if the Freighter wallet extension is installed and accessible.
   * @returns {Promise<boolean>} True if connected/available.
   */
  async isInstalled(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;
      const response = await freighterIsConnected();
      
      if (typeof response === 'object' && response !== null && 'isConnected' in response) {
        return Boolean((response as any).isConnected);
      }
      return Boolean(response);
    } catch (error) {
      return false;
    }
  }

  /**
   * Requests access to the Freighter wallet and retrieves the user's public address.
   * @returns {Promise<string>} The public key address.
   */
  async connect(): Promise<string> {
    try {
      const connected = await this.isInstalled();
      if (!connected) {
        await freighterRequestAccess();
      }
      
      const response = await freighterGetAddress();
      let publicKey = '';

      if (typeof response === 'object' && response !== null && 'address' in response) {
        publicKey = String((response as any).address || '');
      } else {
        publicKey = String(response || '');
      }

      if (!publicKey) {
        throw new Error('No public key returned from Freighter wallet.');
      }
      
      return publicKey;
    } catch (error: any) {
      throw new Error(`Failed to connect to Freighter: ${error.message || error}`);
    }
  }

  /**
   * Retrieves the current Stellar network from Freighter.
   * @returns {Promise<string>} The lowercase network identifier.
   */
  async getNetwork(): Promise<string> {
    try {
      const response = await freighterGetNetwork();
      let networkStr = '';

      if (typeof response === 'object' && response !== null) {
        networkStr = String((response as any).network || (response as any).id || '');
      } else {
        networkStr = String(response || '');
      }

      return (networkStr || 'testnet').toLowerCase();
    } catch (error) {
      throw new Error('Failed to get network from Freighter');
    }
  }

  /**
   * Signs a transaction XDR string using Freighter.
   * @param {string} xdr - The transaction XDR payload.
   * @returns {Promise<string>} Signed transaction XDR.
   */
  async signTransaction(xdr: string): Promise<string> {
    try {
      const network = await this.getNetwork();
      const addressResp = await freighterGetAddress();
      let publicKey = '';

      if (typeof addressResp === 'object' && addressResp !== null && 'address' in addressResp) {
        publicKey = String((addressResp as any).address || '');
      } else {
        publicKey = String(addressResp || '');
      }

      // Cast options parameter as any to prevent strict package signature mismatches
      const signedResponse = await freighterSignTransaction(xdr, {
        network: network.toUpperCase().includes('PUBLIC') ? 'PUBLIC' : 'TESTNET',
        accountToSign: publicKey,
      } as any);

      if (typeof signedResponse === 'object' && signedResponse !== null && 'signedTxXdr' in signedResponse) {
        return String((signedResponse as any).signedTxXdr);
      }
      return String(signedResponse);
    } catch (error: any) {
      throw new Error(`Failed to sign transaction: ${error.message || error}`);
    }
  }
}