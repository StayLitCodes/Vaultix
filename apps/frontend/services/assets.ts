import { apiClient } from '@/lib/api-client';

export interface IAllowedAsset {
  id: string;
  code: string;
  issuer?: string;
  displayName: string;
  iconUrl?: string;
  decimals: number;
  active: boolean;
}

// Standard fallback assets if backend is unavailable or not seeded
const DEFAULT_ASSETS: IAllowedAsset[] = [
  {
    id: 'xlm-native',
    code: 'XLM',
    displayName: 'Stellar Lumens',
    decimals: 7,
    active: true,
    iconUrl: 'https://cryptologos.cc/logos/stellar-xlm-logo.png',
  },
  {
    id: 'usdc-stellar',
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVFAJF2NM6PGDJ5JDGP2UAJ2YTEX44CX7T53CGV', // Circle Testnet Issuer
    displayName: 'USD Coin',
    decimals: 7,
    active: true,
    iconUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
  {
    id: 'yxlm-stellar',
    code: 'yXLM',
    issuer: 'GDRXE2BJUAM3RMX7J6475JU3UEJU7P7MDEVFAJF2NM6PGDJ5JDGP2UAJ2YT',
    displayName: 'Yield-bearing XLM',
    decimals: 7,
    active: true,
    iconUrl: 'https://raw.githubusercontent.com/stellar/assets/master/assets/yXLM-GDRXE2BJUAM3RMX7J6475JU3UEJU7P7MDEVFAJF2NM6PGDJ5JDGP2UAJ2YT.png',
  }
];

export class AssetService {
  // Get active allowed assets
  static async getActiveAssets(): Promise<IAllowedAsset[]> {
    try {
      // Try to load from backend
      const res = await apiClient.get<IAllowedAsset[]>('/assets').catch(() => null);
      if (res && res.length > 0) return res;
    } catch (e) {
      console.warn('Backend assets fetch failed, using fallback list', e);
    }
    
    // Fallback to local storage or defaults
    const local = localStorage.getItem('vaultix_custom_assets');
    if (local) {
      try {
        const parsed = JSON.parse(local) as IAllowedAsset[];
        return parsed.filter(a => a.active);
      } catch {
        // ignore
      }
    }
    return DEFAULT_ASSETS;
  }

  // Admin: Get all assets (active & inactive)
  static async getAllAssets(): Promise<IAllowedAsset[]> {
    try {
      const res = await apiClient.get<IAllowedAsset[]>('/admin/assets').catch(() => null);
      if (res) return res;
    } catch (e) {
      console.warn('Backend admin assets fetch failed, using local storage', e);
    }

    const local = localStorage.getItem('vaultix_custom_assets');
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        // ignore
      }
    }
    
    // Save defaults to local if empty
    localStorage.setItem('vaultix_custom_assets', JSON.stringify(DEFAULT_ASSETS));
    return DEFAULT_ASSETS;
  }

  // Admin: Create asset
  static async createAsset(asset: Omit<IAllowedAsset, 'id'>): Promise<IAllowedAsset> {
    const newAsset: IAllowedAsset = {
      ...asset,
      id: `asset-${Math.random().toString(36).substring(2, 9)}`,
    };

    try {
      const res = await apiClient.post<IAllowedAsset>('/admin/assets', asset).catch(() => null);
      if (res) return res;
    } catch (e) {
      console.warn('Backend asset creation failed, saving to local storage', e);
    }

    const all = await this.getAllAssets();
    all.push(newAsset);
    localStorage.setItem('vaultix_custom_assets', JSON.stringify(all));
    return newAsset;
  }

  // Admin: Update asset
  static async updateAsset(id: string, asset: Partial<IAllowedAsset>): Promise<IAllowedAsset> {
    try {
      const res = await apiClient.patch<IAllowedAsset>(`/admin/assets/${id}`, asset).catch(() => null);
      if (res) return res;
    } catch (e) {
      console.warn('Backend asset update failed, saving to local storage', e);
    }

    const all = await this.getAllAssets();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Asset not found');
    all[idx] = { ...all[idx], ...asset };
    localStorage.setItem('vaultix_custom_assets', JSON.stringify(all));
    return all[idx];
  }

  // Admin: Delete asset
  static async deleteAsset(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/assets/${id}`).catch(() => null);
      return;
    } catch (e) {
      console.warn('Backend asset deletion failed, deleting from local storage', e);
    }

    const all = await this.getAllAssets();
    const filtered = all.filter(a => a.id !== id);
    localStorage.setItem('vaultix_custom_assets', JSON.stringify(filtered));
  }

  // Horizon: fetch user balance and trustline status
  static async getBalanceAndTrustline(
    publicKey: string,
    assetCode: string,
    issuer?: string,
    network: string = 'testnet'
  ): Promise<{ balance: string; trustlineEstablished: boolean }> {
    if (!publicKey) {
      return { balance: '0.00', trustlineEstablished: false };
    }

    // XLM (native) trustline is always established
    if (assetCode === 'XLM' || !issuer) {
      try {
        const horizonUrl = network === 'public'
          ? 'https://horizon.stellar.org'
          : 'https://horizon-testnet.stellar.org';
        const res = await fetch(`${horizonUrl}/accounts/${publicKey}`);
        if (!res.ok) return { balance: '0.00', trustlineEstablished: true };
        const data = await res.json();
        const nativeBal = data.balances.find((b: any) => b.asset_type === 'native');
        return {
          balance: nativeBal ? parseFloat(nativeBal.balance).toFixed(4) : '0.00',
          trustlineEstablished: true,
        };
      } catch {
        return { balance: '0.00', trustlineEstablished: true };
      }
    }

    try {
      const horizonUrl = network === 'public'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org';
      const res = await fetch(`${horizonUrl}/accounts/${publicKey}`);
      if (!res.ok) return { balance: '0.00', trustlineEstablished: false };
      
      const data = await res.json();
      const match = data.balances.find(
        (b: any) => b.asset_code === assetCode && b.asset_issuer === issuer
      );
      
      if (match) {
        return {
          balance: parseFloat(match.balance).toFixed(4),
          trustlineEstablished: true,
        };
      }
      return { balance: '0.00', trustlineEstablished: false };
    } catch (e) {
      console.error('Error checking balance from Horizon:', e);
      return { balance: '0.00', trustlineEstablished: false };
    }
  }

  // Get live USD prices for estimates
  static async getUsdConversionRate(assetCode: string): Promise<number> {
    if (assetCode === 'USDC') return 1.0;
    
    if (assetCode === 'XLM') {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd');
        const data = await res.json();
        return data.stellar.usd || 0.125;
      } catch {
        return 0.125; // standard testnet default estimate
      }
    }
    
    // Default estimate for custom assets
    return 0.5;
  }
}
