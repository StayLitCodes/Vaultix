"use client";
import React, { useState } from "react";
import { X, QrCode } from "lucide-react";
import { isValidStellarAddress } from "../../utils/validators";

interface FilterBadgesProps {
  searchQuery?: string;
  minAmount?: string;
  maxAmount?: string;
  fromDate?: string;
  toDate?: string;
  activeStatuses?: string[];
  walletAddress?: string;
  onWalletAddressChange?: (address: string) => void;
  onClear: (key: string) => void;
  onClearAll: () => void;
}

export default function FilterBadges({
  searchQuery, minAmount, maxAmount, fromDate, toDate,
  activeStatuses = [], walletAddress, onWalletAddressChange, onClear, onClearAll,
}: FilterBadgesProps) {
  const [localWallet, setLocalWallet] = useState(walletAddress || "");
  const [error, setError] = useState("");

  const handleWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localWallet) {
      setError("");
      onWalletAddressChange?.("");
      return;
    }
    if (isValidStellarAddress(localWallet)) {
      setError("");
      onWalletAddressChange?.(localWallet);
    } else {
      setError("Invalid Stellar address (must start with G and be 56 chars long)");
    }
  };

  const badges: { key: string; label: string }[] = [
    ...(searchQuery ? [{ key: "search", label: `Search: ${searchQuery}` }] : []),
    ...(minAmount ? [{ key: "minAmount", label: `Min: ${minAmount} XLM` }] : []),
    ...(maxAmount ? [{ key: "maxAmount", label: `Max: ${maxAmount} XLM` }] : []),
    ...(fromDate ? [{ key: "fromDate", label: `From: ${fromDate}` }] : []),
    ...(toDate ? [{ key: "toDate", label: `To: ${toDate}` }] : []),
    ...(walletAddress ? [{ key: "walletAddress", label: `Wallet: ${walletAddress.substring(0, 4)}...${walletAddress.substring(52)}` }] : []),
    ...activeStatuses.map((s) => ({ key: `status-${s}`, label: s })),
  ];
  
  if (badges.length === 0 && !onWalletAddressChange) return null;
  
  return (
    <div className="flex flex-col gap-3 py-2">
      {onWalletAddressChange && (
        <form onSubmit={handleWalletSubmit} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search by Stellar address..."
            value={localWallet}
            onChange={(e) => {
              setLocalWallet(e.target.value);
              if (error) setError("");
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 md:w-80"
          />
          <button 
            type="button" 
            onClick={() => alert("QR Scanner not implemented yet")} 
            className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            title="Scan QR Code"
          >
            <QrCode className="h-5 w-5 text-gray-500" />
          </button>
          <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Search Address
          </button>
          {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
        </form>
      )}
      
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {badges.map((b) => (
            <span key={b.key} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {b.label}
              <button onClick={() => onClear(b.key)} aria-label={`Remove ${b.label} filter`} className="hover:text-blue-600 focus:outline-none">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={onClearAll} className="text-xs text-gray-400 underline hover:text-gray-600">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
