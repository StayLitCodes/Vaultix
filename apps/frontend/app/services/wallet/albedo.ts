import albedo from '@albedo-link/intent';

export interface AlbedoIntentResult {
  signed_envelope_xdr?: string;
  pubkey?: string;
  signature?: string;
}

export class AlbedoService {
  private static instance: AlbedoService;

  private constructor() {}

  public static getInstance(): AlbedoService {
    if (!AlbedoService.instance) {
      AlbedoService.instance = new AlbedoService();
    }
    return AlbedoService.instance;
  }

  async connect(): Promise<string> {
    try {
      const result = await this.publicKey();
      return result;
    } catch (error: any) {
      if (error.message?.includes('rejected')) {
        throw new Error('Albedo connection was rejected by the user.');
      }
      throw new Error(`Failed to connect with Albedo: ${error.message}`);
    }
  }

  async signTransaction(xdr: string): Promise<string> {
    try {
      const result = await albedo.tx({ xdr, network: this.getNetworkParam() });

      if (!result.signed_envelope_xdr) {
        throw new Error('No signed envelope returned from Albedo');
      }

      return result.signed_envelope_xdr;
    } catch (error: any) {
      if (error.message?.includes('rejected')) {
        throw new Error('Transaction signing was rejected by the user.');
      }
      throw new Error(`Failed to sign transaction with Albedo: ${error.message}`);
    }
  }

  private getNetworkParam(): 'public' | 'testnet' {
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
    return network === 'mainnet' ? 'public' : 'testnet';
  }

  private async publicKey(): Promise<string> {
    try {
      const result = await albedo.publicKey({});
      return result.pubkey;
    } catch (error: any) {
      if (error.message?.includes('rejected')) {
        throw new Error('Albedo connection was rejected by the user.');
      }
      throw new Error(`Failed to get public key from Albedo: ${error.message}`);
    }
  }
}