"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { User, Copy, Check, Bell, Shield, Settings as SettingsIcon, ArrowRight, Loader2, DollarSign } from "lucide-react";
import { useWallet } from "@/app/contexts/WalletContext";
import ApiKeyManager from "@/components/settings/ApiKeyManager";
import { useNotifications, UserPreferences } from "@/hooks/useNotifications";
import { useCurrency } from "@/context/CurrencyContext";

// ── Types ──────────────────────────────────────────────────────────────────

type PrefChannel = "email" | "inApp";

// ── Helpers ────────────────────────────────────────────────────────────────

function truncate(addr: string, chars = 8) {
  if (!addr || addr.length <= chars * 2) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

// ── Section components ─────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden text-foreground">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-500" />
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Profile Section ────────────────────────────────────────────────────────

function ProfileSectionInner() {
  const { wallet } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (wallet?.publicKey) {
      navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Connected wallet</p>
        {wallet ? (
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono bg-muted text-foreground border border-border px-3 py-1.5 rounded-lg break-all">
              {wallet.publicKey}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 p-1.5 rounded hover:bg-accent transition-colors"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No wallet connected</p>
        )}
      </div>
      {wallet && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            Network:{" "}
            <span className="font-medium text-foreground capitalize">
              {wallet.network}
            </span>
          </span>
          <span>
            Provider:{" "}
            <span className="font-medium text-foreground capitalize">
              {wallet.walletType}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function ProfileSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SectionCard title="Profile" icon={User}>
      {mounted ? (
        <ProfileSectionInner />
      ) : (
        <p className="text-sm text-gray-400 italic">Loading…</p>
      )}
    </SectionCard>
  );
}

// ── Notification Preferences ───────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  ESCROW_FUNDED: "Escrow funded",
  MILESTONE_RELEASED: "Milestone released",
  DISPUTE_RAISED: "Dispute raised",
  DISPUTE_RESOLVED: "Dispute resolved",
  ESCROW_EXPIRED: "Escrow expired",
  EXPIRATION_WARNING: "Expiration warning",
  PARTY_JOINED: "Party joined",
  ESCROW_CREATED: "Escrow created",
  ESCROW_COMPLETED: "Escrow completed",
  ESCROW_CANCELLED: "Escrow cancelled",
  CONDITION_FULFILLED: "Condition fulfilled",
  CONDITION_CONFIRMED: "Condition confirmed",
  PARTY_INVITED: "Party invited",
  PARTY_ACCEPTED: "Party accepted",
  PARTY_REJECTED: "Party rejected",
};

/** Ordered list of event types to display in the settings UI, derived from hook's known types */
const DISPLAY_EVENT_TYPES: string[] = [
  "ESCROW_FUNDED",
  "MILESTONE_RELEASED",
  "DISPUTE_RAISED",
  "DISPUTE_RESOLVED",
  "ESCROW_EXPIRED",
  "EXPIRATION_WARNING",
  "ESCROW_CREATED",
  "ESCROW_COMPLETED",
  "ESCROW_CANCELLED",
  "CONDITION_FULFILLED",
  "CONDITION_CONFIRMED",
  "PARTY_INVITED",
  "PARTY_ACCEPTED",
  "PARTY_REJECTED",
];

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${checked ? "bg-blue-600" : "bg-gray-300"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function NotificationPrefsSection() {
  const {
    preferences,
    preferencesLoading,
    savingPreferences,
    updatePreferences,
  } = useNotifications();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastSaveSucceeded, setLastSaveSucceeded] = useState<boolean | null>(null);
  const successTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sound preference from localStorage on mount
  useEffect(() => {
    const savedSound = localStorage.getItem('vaultix_sound_enabled');
    if (savedSound !== null) {
      setSoundEnabled(savedSound !== 'false');
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  /** Toggle a channel for an event type. The hook handles optimistic UI + debounced API save. */
  const toggleChannel = async (eventType: string, channel: PrefChannel) => {
    const updated: UserPreferences = {
      ...preferences,
      [eventType]: {
        ...preferences[eventType],
        [channel]: !preferences[eventType]?.[channel],
      },
    };

    const success = await updatePreferences(updated);
    setLastSaveSucceeded(success);

    // Clear success/failure indicator after 3 seconds
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setLastSaveSucceeded(null), 3000);
  };

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('vaultix_sound_enabled', String(nextVal));
  };

  // Loading skeleton
  if (preferencesLoading) {
    return (
      <SectionCard title="Notification Preferences" icon={Bell}>
        <div className="space-y-4">
          {/* Sound toggle skeleton */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="space-y-1">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-5 w-9 bg-gray-200 rounded-full animate-pulse" />
          </div>
          {/* Header skeleton */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6">
            <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
          </div>
          {/* Row skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center">
              <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
              <div className="h-5 w-9 bg-gray-100 rounded-full animate-pulse" />
              <div className="h-5 w-9 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))}
          <div className="pt-2">
            <div className="h-9 w-32 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Notification Preferences" icon={Bell}>
      <div className="space-y-4">
        {/* Sound toggle */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-sm font-medium text-foreground block">Notification Sound</span>
            <span className="text-xs text-muted-foreground">Play a chime when a new notification is received</span>
          </div>
          <Toggle checked={soundEnabled} onChange={handleToggleSound} />
        </div>

        {/* Status indicator */}
        {savingPreferences && (
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-3 py-1.5 rounded-lg">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving preferences…
          </div>
        )}
        {!savingPreferences && lastSaveSucceeded === true && (
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-3 py-1.5 rounded-lg">
            <Check className="w-3 h-3" />
            Preferences saved
          </div>
        )}
        {!savingPreferences && lastSaveSucceeded === false && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1.5 rounded-lg">
            <span className="font-medium">Failed to save</span>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 text-xs text-muted-foreground font-medium uppercase tracking-wider px-1 pt-1">
          <span>Event</span>
          <span>Email</span>
          <span>In-app</span>
        </div>
        {DISPLAY_EVENT_TYPES.map((eventType) => {
          const pref = preferences[eventType];
          // Skip event types that aren't in the preferences map
          if (!pref) return null;
          return (
            <div
              key={eventType}
              className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center"
            >
              <span className="text-sm text-foreground">
                {EVENT_LABELS[eventType] || eventType}
              </span>
              <Toggle
                checked={pref.email}
                onChange={() => toggleChannel(eventType, "email")}
                disabled={savingPreferences}
              />
              <Toggle
                checked={pref.inApp}
                onChange={() => toggleChannel(eventType, "inApp")}
                disabled={savingPreferences}
              />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── API Keys Section ───────────────────────────────────────────────────────

function ApiKeysSection() {
  return <ApiKeyManager />;
}

// ── Currency Preferences Section ───────────────────────────────────────────

function CurrencyPreferencesSection() {
  const { currency, setCurrency, showFiat, setShowFiat } = useCurrency();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <SectionCard title="Currency Display" icon={DollarSign}>
        <div className="text-sm text-muted-foreground italic">Loading…</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Currency Display" icon={DollarSign}>
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-sm font-medium text-foreground block">Show Fiat Equivalent</span>
            <span className="text-xs text-muted-foreground">Display fiat equivalents alongside XLM amounts</span>
          </div>
          <Toggle checked={showFiat} onChange={() => setShowFiat(!showFiat)} />
        </div>
        
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-sm font-medium text-foreground block">Preferred Currency</span>
            <span className="text-xs text-muted-foreground">Choose your local currency for conversion</span>
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="text-sm border border-border bg-background text-foreground rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            disabled={!showFiat}
          >
            <option value="usd">USD</option>
            <option value="eur">EUR</option>
            <option value="ngn">NGN</option>
            <option value="kes">KES</option>
            <option value="ghs">GHS</option>
            <option value="zar">ZAR</option>
          </select>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Templates Link Section ─────────────────────────────────────────────────

function TemplatesLinkSection() {
  return (
    <Link href="/settings/templates">
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
              <SettingsIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Manage Templates</h3>
              <p className="text-xs text-muted-foreground">Create, edit, and delete your custom escrow templates</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>

        <ProfileSection />
        <TemplatesLinkSection />
        <CurrencyPreferencesSection />
        <NotificationPrefsSection />
        <ApiKeysSection />
      </div>
    </div>
  );
}
