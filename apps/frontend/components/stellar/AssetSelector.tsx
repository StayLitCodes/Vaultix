'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Star,
  Plus,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Wallet,
  Globe,
  ChevronDown,
  X,
  Info,
} from 'lucide-react';
import { AssetService, IAllowedAsset } from '@/services/assets';
import { useWallet } from '@/app/contexts/WalletContext';
import { toast } from 'sonner';
import * as StellarSdk from 'stellar-sdk';

interface AssetSelectorProps {
  selectedAsset: IAllowedAsset | null;
  onSelectAsset: (asset: IAllowedAsset) => void;
  amount?: string;
  className?: string;
}

export default function AssetSelector({
  selectedAsset,
  onSelectAsset,
  amount = '0',
  className = '',
}: AssetSelectorProps) {
  const { wallet, connect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<IAllowedAsset[]>([]);
  const [balances, setBalances] = useState<Record<string, { balance: string; trustlineEstablished: boolean }>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Trustline establishment modal
  const [trustlineModalAsset, setTrustlineModalAsset] = useState<IAllowedAsset | null>(null);
  const [creatingTrustline, setCreatingTrustline] = useState(false);

  // Load assets & favorites
  useEffect(() => {
    loadInitialData();
  }, [wallet]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const activeAssets = await AssetService.getActiveAssets();
      setAssets(activeAssets);

      // Load favorites
      const savedFavs = localStorage.getItem('vaultix_favorite_assets');
      if (savedFavs) {
        setFavorites(JSON.parse(savedFavs));
      }

      // Fetch rates & balances
      const rateMap: Record<string, number> = {};
      const balanceMap: Record<string, { balance: string; trustlineEstablished: boolean }> = {};

      for (const asset of activeAssets) {
        // Fetch rate
        const rate = await AssetService.getUsdConversionRate(asset.code);
        rateMap[asset.code] = rate;

        // Fetch balance if wallet connected
        if (wallet?.publicKey) {
          const res = await AssetService.getBalanceAndTrustline(
            wallet.publicKey,
            asset.code,
            asset.issuer,
            wallet.network
          );
          balanceMap[asset.id] = res;
        } else {
          balanceMap[asset.id] = { balance: '0.00', trustlineEstablished: false };
        }
      }
      setRates(rateMap);
      setBalances(balanceMap);
    } catch (e) {
      console.error('Error loading assets data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Star/Unstar Favorite
  const toggleFavorite = (e: React.MouseEvent, assetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    let updated: string[];
    if (favorites.includes(assetId)) {
      updated = favorites.filter(id => id !== assetId);
    } else {
      updated = [...favorites, assetId];
    }
    setFavorites(updated);
    localStorage.setItem('vaultix_favorite_assets', JSON.stringify(updated));
  };

  // Create trustline via Freighter transaction signing
  const handleCreateTrustline = async () => {
    if (!wallet || !trustlineModalAsset || !trustlineModalAsset.issuer) return;
    setCreatingTrustline(true);
    try {
      const horizonUrl = wallet.network === 'public'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org';

      // 1. Fetch account details to get current sequence number
      const accountRes = await fetch(`${horizonUrl}/accounts/${wallet.publicKey}`);
      if (!accountRes.ok) {
        throw new Error('Your Stellar account was not found on the network. Please fund it first with some test XLM.');
      }
      const accountData = await accountRes.json();
      const sourceAccount = new StellarSdk.Account(wallet.publicKey, accountData.sequence);

      // 2. Build ChangeTrust transaction
      const asset = new StellarSdk.Asset(trustlineModalAsset.code, trustlineModalAsset.issuer);
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: wallet.network === 'public' 
          ? StellarSdk.Networks.PUBLIC 
          : StellarSdk.Networks.TESTNET,
      })
        .addOperation(StellarSdk.Operation.changeTrust({ asset }))
        .setTimeout(180)
        .build();

      const xdr = transaction.toXDR();

      // 3. Request user to sign via Freighter
      toast.info('Please approve the trustline transaction in your Freighter wallet extension.');
      
      // Access freighter directly for signing
      if (!window.freighter) {
        throw new Error('Freighter wallet extension is not installed.');
      }
      const signedXdr = await window.freighter.signTransaction(xdr, {
        network: wallet.network.toUpperCase(),
        accountToSign: wallet.publicKey,
      });

      // 4. Submit signed transaction to Horizon
      toast.info('Submitting trustline transaction to Stellar blockchain...');
      const submitRes = await fetch(`${horizonUrl}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tx: signedXdr }),
      });
      const submitData = await submitRes.json();
      
      if (!submitRes.ok) {
        throw new Error(submitData.detail || 'Stellar Horizon network submission failed.');
      }

      toast.success(`Trustline established for ${trustlineModalAsset.code}!`);
      setTrustlineModalAsset(null);
      // Reload balances
      loadInitialData();
    } catch (err: any) {
      console.error('Trustline creation failed:', err);
      toast.error(err.message || 'Failed to establish trustline');
    } finally {
      setCreatingTrustline(false);
    }
  };

  // Filter and sort assets
  const sortedAndFilteredAssets = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = assets.filter(
      a => a.code.toLowerCase().includes(term) || a.displayName.toLowerCase().includes(term)
    );

    // Sort by Favorites first, then name
    return filtered.sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 1 : 0;
      const bFav = favorites.includes(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.code.localeCompare(b.code);
    });
  }, [assets, search, favorites]);

  // Real-time USD conversion estimate calculation
  const usdEstimate = useMemo(() => {
    if (!selectedAsset || isNaN(parseFloat(amount))) return '0.00';
    const rate = rates[selectedAsset.code] || 0;
    return (parseFloat(amount) * rate).toLocaleString([], {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [selectedAsset, amount, rates]);

  // Truncate Issuer Key
  const truncateIssuer = (addr?: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  // Handle asset click: prevent selecting if trustline is missing
  const handleAssetClick = (asset: IAllowedAsset) => {
    const isXlm = asset.code === 'XLM';
    const hasTrust = balances[asset.id]?.trustlineEstablished;
    
    if (!wallet) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isXlm && !hasTrust) {
      // Trigger trustline creation guide modal
      setTrustlineModalAsset(asset);
      setIsOpen(false);
      return;
    }

    onSelectAsset(asset);
    setIsOpen(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-xs text-gray-400 font-medium block">Select Funding Asset</label>

      {!wallet ? (
        /* Wallet Not Connected State */
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold text-white">Wallet Not Connected</p>
              <p className="text-[10px] text-gray-500">Connect a Freighter or Albedo wallet to view balances and check trustlines.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => connect('FREIGHTER' as any)}
            className="w-full sm:w-auto text-xs font-semibold px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/15 transition-all cursor-pointer"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        /* Asset Selection Dropdown */
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between bg-[#12121a] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 text-xs text-left text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectedAsset?.iconUrl ? (
                <img src={selectedAsset.iconUrl} alt={selectedAsset.code} className="w-5 h-5 object-contain" />
              ) : (
                <Globe className="w-5 h-5 text-purple-400" />
              )}
              <div className="min-w-0">
                <span className="font-semibold text-white">{selectedAsset?.code || 'Select Asset'}</span>
                {selectedAsset?.issuer && (
                  <span className="text-[10px] text-gray-500 ml-2">
                    ({truncateIssuer(selectedAsset.issuer)})
                  </span>
                )}
                {selectedAsset && (
                  <span className="text-[10px] text-purple-400 block mt-0.5">
                    Balance: {balances[selectedAsset.id]?.balance || '0.00'} {selectedAsset.code}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedAsset && selectedAsset.code !== 'XLM' && (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
                  Trustline OK
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              
              <div className="absolute left-0 right-0 mt-2 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 flex flex-col">
                {/* Search Bar */}
                <div className="p-3 border-b border-white/5 flex items-center gap-2 bg-white/[0.01]">
                  <Search className="w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by code or name..."
                    className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>

                {/* Assets List */}
                <div className="overflow-y-auto divide-y divide-white/5 flex-1">
                  {loading ? (
                    <div className="p-4 text-center text-gray-500 text-xs flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      Loading asset matrix...
                    </div>
                  ) : sortedAndFilteredAssets.length === 0 ? (
                    <p className="p-4 text-center text-gray-500 text-xs">No assets match your search.</p>
                  ) : (
                    sortedAndFilteredAssets.map((asset) => {
                      const isFav = favorites.includes(asset.id);
                      const isXlm = asset.code === 'XLM';
                      const balanceInfo = balances[asset.id] || { balance: '0.00', trustlineEstablished: false };
                      const trustOK = isXlm || balanceInfo.trustlineEstablished;

                      return (
                        <div
                          key={asset.id}
                          onClick={() => handleAssetClick(asset)}
                          className="flex items-center justify-between gap-2 p-3 hover:bg-white/[0.02] cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Favorite Star */}
                            <button
                              onClick={(e) => toggleFavorite(e, asset.id)}
                              className="p-1 rounded text-gray-500 hover:text-amber-400 transition-colors"
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-400 fill-amber-400' : ''}`} />
                            </button>
                            
                            {asset.iconUrl ? (
                              <img src={asset.iconUrl} alt={asset.code} className="w-5 h-5 object-contain" />
                            ) : (
                              <Globe className="w-5 h-5 text-purple-400" />
                            )}
                            
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white">{asset.code}</span>
                                {asset.issuer && (
                                  <span className="text-[9px] text-gray-500 font-mono">
                                    ({truncateIssuer(asset.issuer)})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-500 block">{asset.displayName}</span>
                            </div>
                          </div>

                          {/* Balance & Trust status */}
                          <div className="text-right">
                            <span className="font-semibold text-white block">
                              {balanceInfo.balance} {asset.code}
                            </span>
                            {!trustOK ? (
                              <span className="inline-flex items-center gap-1 text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full mt-0.5">
                                <AlertTriangle className="w-2 h-2" />
                                Needs Trustline
                              </span>
                            ) : (
                              !isXlm && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full mt-0.5">
                                  <CheckCircle className="w-2 h-2" />
                                  Ready
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Real-time USD Estimate */}
      {selectedAsset && parseFloat(amount) > 0 && (
        <p className="text-[11px] text-gray-500 pl-1 font-medium">
          Est. USD Value: <span className="text-gray-300 font-semibold">~ ${usdEstimate}</span>
        </p>
      )}

      {/* Trustline Establishment Dialog Modal */}
      {trustlineModalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setTrustlineModalAsset(null)}
          />
          <div className="relative bg-[#12121a] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Trustline Required</h3>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">
                To hold or transfer <span className="text-white font-semibold">{trustlineModalAsset.code}</span> on the Stellar network, your account must first establish a trustline to the issuer:
              </p>
              <code className="block text-[10px] bg-white/[0.02] border border-white/5 rounded p-2 font-mono text-gray-400 mt-2 break-all">
                {trustlineModalAsset.issuer}
              </code>
            </div>

            <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3 text-[11px] text-gray-400 space-y-1">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-purple-400" />
                How it works:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Creating a trustline requires a small base reserve of 0.5 XLM.</li>
                <li>Freighter wallet will sign the transaction.</li>
                <li>Once signed, the trustline is instantly active.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 justify-end pt-2 text-xs">
              <button
                type="button"
                onClick={() => setTrustlineModalAsset(null)}
                className="px-4 py-2 border border-white/5 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTrustline}
                disabled={creatingTrustline}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer flex items-center gap-1.5"
              >
                {creatingTrustline && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Establish Trustline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
