"use client";
import React, { useState } from "react";
import { X, QrCode } from "lucide-react";
import { isValidStellarAddress } from "../../utils/validators";
import { CanonicalEscrowStatus } from "@/utils/escrowStatus";
import { useTranslations } from 'next-intl';

const STATUS_MESSAGE_KEYS: Record<CanonicalEscrowStatus, string> = {
  [CanonicalEscrowStatus.CREATED]: 'pending',
  [CanonicalEscrowStatus.FUNDED]: 'funded',
  [CanonicalEscrowStatus.ACTIVE]: 'active',
  [CanonicalEscrowStatus.DISPUTED]: 'disputed',
  [CanonicalEscrowStatus.RESOLVED]: 'resolved',
  [CanonicalEscrowStatus.REFUNDED]: 'refunded',
  [CanonicalEscrowStatus.CANCELLED]: 'cancelled',
  [CanonicalEscrowStatus.COMPLETED]: 'completed',
  [CanonicalEscrowStatus.EXPIRED]: 'expired',
  [CanonicalEscrowStatus.UNKNOWN]: 'unknown',
};

interface FilterBadgesProps {
  searchQuery?: string;
  minAmount?: string;
  maxAmount?: string;
  fromDate?: string;
  toDate?: string;
  activeStatuses?: CanonicalEscrowStatus[];
  walletAddress?: string;
  onWalletAddressChange?: (address: string) => void;
  onClear: (key: string) => void;
  onClearAll: () => void;
}

export default function FilterBadges({
  searchQuery, minAmount, maxAmount, fromDate, toDate,
  activeStatuses = [], walletAddress, onWalletAddressChange, onClear, onClearAll,
}: FilterBadgesProps) {
  const t = useTranslations('dashboard');
  const badgesT = useTranslations('dashboardBadges');
  const statusT = useTranslations('dashboardCards.status');
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
      setError(t('invalidStellarAddress'));
    }
  };

  const badges: { key: string; label: string }[] = [
    ...(searchQuery ? [{ key: "search", label: badgesT('search', { value: searchQuery }) }] : []),
    ...(minAmount ? [{ key: "minAmount", label: badgesT('minimum', { value: minAmount }) }] : []),
    ...(maxAmount ? [{ key: "maxAmount", label: badgesT('maximum', { value: maxAmount }) }] : []),
    ...(fromDate ? [{ key: "fromDate", label: badgesT('from', { value: fromDate }) }] : []),
    ...(toDate ? [{ key: "toDate", label: badgesT('to', { value: toDate }) }] : []),
    ...(walletAddress ? [{ key: "walletAddress", label: badgesT('wallet', { value: `${walletAddress.substring(0, 4)}...${walletAddress.substring(52)}` }) }] : []),
    ...activeStatuses.map((status) => ({ key: `status-${status}`, label: statusT(STATUS_MESSAGE_KEYS[status]) })),
  ];
  
  if (badges.length === 0 && !onWalletAddressChange) return null;
  
  return (
    <div className="flex flex-col gap-3 py-2">
      {onWalletAddressChange && (
        <form onSubmit={handleWalletSubmit} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={t('searchWallet')}
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
            title={t('scanQr')}
          >
            <QrCode className="h-5 w-5 text-gray-500" />
          </button>
          <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {t('searchAddress')}
          </button>
          {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
        </form>
      )}
      
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {badges.map((b) => (
            <span key={b.key} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {b.label}
              <button onClick={() => onClear(b.key)} aria-label={t('removeFilter', { filter: b.label })} className="hover:text-blue-600 focus:outline-none">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={onClearAll} className="text-xs text-gray-400 underline hover:text-gray-600">
            {t('clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}
