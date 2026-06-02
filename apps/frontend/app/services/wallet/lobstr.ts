declare global {
  interface Window {
    lobstr?: any;
  }
}

export class LobstrService {
  private static instance: LobstrService;

  private constructor() {}

  public static getInstance(): LobstrService {
    if (!LobstrService.instance) {
      LobstrService.instance = new LobstrService();
    }
    return LobstrService.instance;
  }

  async isInstalled(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;
      return !!window.lobstr;
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    if (typeof window === 'undefined' || !window.lobstr) {
      throw new Error('Lobstr wallet is not installed');
    }
    try {
      const publicKey = await window.lobstr.getPublicKey();
      return publicKey;
    } catch (error: any) {
      throw new Error(`Failed to connect to Lobstr: ${error.message}`);
    }
  }

  async signTransaction(xdr: string): Promise<string> {
    if (typeof window === 'undefined' || !window.lobstr) {
      throw new Error('Lobstr wallet is not installed');
    }
    try {
      const signedXdr = await window.lobstr.signTransaction(xdr);
      return signedXdr;
    } catch (error: any) {
      throw new Error(`Failed to sign transaction with Lobstr: ${error.message}`);
    }
  }
}
