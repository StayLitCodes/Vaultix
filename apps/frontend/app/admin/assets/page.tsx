'use client';

import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Loader2,
  Globe,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react';
import { AssetService, IAllowedAsset } from '@/services/assets';
import { toast } from 'sonner';

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<IAllowedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [code, setCode] = useState('');
  const [issuer, setIssuer] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [decimals, setDecimals] = useState(7);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const res = await AssetService.getAllAssets();
      setAssets(res);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load assets list');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !displayName.trim()) {
      toast.error('Asset code and display name are required');
      return;
    }
    
    // Issuer length check for non-native assets
    if (code !== 'XLM' && issuer.length !== 56) {
      toast.error('Stellar issuer address must be exactly 56 characters');
      return;
    }

    setSubmitting(true);
    try {
      await AssetService.createAsset({
        code: code.toUpperCase(),
        issuer: code === 'XLM' ? undefined : issuer,
        displayName,
        iconUrl: iconUrl || undefined,
        decimals,
        active: true,
      });

      toast.success(`${code.toUpperCase()} added to whitelist successfully`);
      setCode('');
      setIssuer('');
      setDisplayName('');
      setIconUrl('');
      setDecimals(7);
      setShowAddForm(false);
      loadAssets();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add custom asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (asset: IAllowedAsset) => {
    try {
      const updated = await AssetService.updateAsset(asset.id, {
        active: !asset.active,
      });
      toast.success(`${asset.code} is now ${updated.active ? 'active' : 'inactive'}`);
      loadAssets();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update asset status');
    }
  };

  const handleDeleteAsset = async (id: string, code: string) => {
    if (code === 'XLM' || code === 'USDC') {
      toast.error('Default system assets cannot be deleted');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${code} from the whitelist?`)) {
      return;
    }

    try {
      await AssetService.deleteAsset(id);
      toast.success(`${code} removed successfully`);
      loadAssets();
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove asset');
    }
  };

  const truncateAddress = (addr?: string) => {
    if (!addr) return 'Native';
    return `${addr.slice(0, 10)}...${addr.slice(-10)}`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Coins className="text-purple-400 w-7 h-7" />
            Asset Whitelist Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure Stellar assets supported for smart contract escrows.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/10 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Custom Asset
        </button>
      </div>

      {/* Add Custom Asset Form */}
      {showAddForm && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Register Custom Stellar Token</h3>
          <form onSubmit={handleAddAsset} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-medium">Asset Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. yXLM, RMT"
                required
                className="w-full bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-medium">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Yield-bearing XLM"
                required
                className="w-full bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-gray-400 font-medium">Issuer Public Key (56 characters)</label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                disabled={code.toUpperCase() === 'XLM'}
                placeholder={code.toUpperCase() === 'XLM' ? 'Not required for native token' : 'e.g. GDRXE2BJUA...'}
                required={code.toUpperCase() !== 'XLM'}
                className="w-full bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-medium">Icon URL (optional)</label>
              <input
                type="url"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="e.g. https://domain.com/token.png"
                className="w-full bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-medium">Decimals</label>
              <input
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value))}
                min="0"
                max="18"
                className="w-full bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-white/5 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add Asset
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Assets List */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <Loader2 className="animate-spin h-6 w-6 border-b-2 border-purple-500 mx-auto mb-2" />
            <p className="text-xs">Loading whitelisted assets...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] text-gray-500 uppercase font-bold tracking-wider bg-white/[0.01]">
                  <th className="p-4">Asset</th>
                  <th className="p-4">Issuer</th>
                  <th className="p-4">Decimals</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-white/[0.01] transition-colors">
                    
                    {/* Name & Icon */}
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center p-1.5 flex-shrink-0">
                        {asset.iconUrl ? (
                          <img src={asset.iconUrl} alt={asset.code} className="w-full h-full object-contain" />
                        ) : (
                          <Globe className="w-4 h-4 text-purple-400" />
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-white block">{asset.code}</span>
                        <span className="text-[10px] text-gray-500">{asset.displayName}</span>
                      </div>
                    </td>

                    {/* Issuer Key */}
                    <td className="p-4 font-mono text-[11px] text-gray-400">
                      {asset.issuer ? (
                        <span title={asset.issuer}>{truncateAddress(asset.issuer)}</span>
                      ) : (
                        <span className="text-purple-400 font-semibold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded text-[10px]">
                          Native XLM
                        </span>
                      )}
                    </td>

                    {/* Decimals */}
                    <td className="p-4">{asset.decimals}</td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                        asset.active
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-gray-400 bg-white/5 border-white/5'
                      }`}>
                        {asset.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleActive(asset)}
                        className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer"
                        title={asset.active ? 'Deactivate' : 'Activate'}
                      >
                        {asset.active ? (
                          <ToggleRight className="w-5 h-5 text-purple-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                      
                      <button
                        disabled={asset.code === 'XLM' || asset.code === 'USDC'}
                        onClick={() => handleDeleteAsset(asset.id, asset.code)}
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-white/5 disabled:opacity-20 disabled:hover:text-gray-500 transition-colors cursor-pointer"
                        title="Remove Whitelist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
