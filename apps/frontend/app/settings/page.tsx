"use client";

import React, { useState, useEffect } from "react";
import { User, Copy, Check, Bell, Shield } from "lucide-react";
import { useWallet } from "@/app/contexts/WalletContext";
import ApiKeyManager from "@/components/settings/ApiKeyManager";

// ── Types ──────────────────────────────────────────────────────────────────

interface NotificationPref {
  eventType: string;
  label: string;
  email: boolean;
  inApp: boolean;
}

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-500" />
        <h2 className="font-semibold text-gray-800">{title}</h2>
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
        <p className="text-xs text-gray-500 mb-1">Connected wallet</p>
        {wallet ? (
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg break-all">
              {wallet.publicKey}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 p-1.5 rounded hover:bg-gray-100 transition-colors"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No wallet connected</p>
        )}
      </div>
      {wallet && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span>
            Network:{" "}
            <span className="font-medium text-gray-700 capitalize">
              {wallet.network}
            </span>
          </span>
          <span>
            Provider:{" "}
            <span className="font-medium text-gray-700 capitalize">
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

const DEFAULT_PREFS: NotificationPref[] = [
  {
    eventType: "ESCROW_FUNDED",
    label: "Escrow funded",
    email: true,
    inApp: true,
  },
  {
    eventType: "MILESTONE_RELEASED",
    label: "Milestone released",
    email: true,
    inApp: true,
  },
  {
    eventType: "DISPUTE_RAISED",
    label: "Dispute raised",
    email: true,
    inApp: true,
  },
  {
    eventType: "DISPUTE_RESOLVED",
    label: "Dispute resolved",
    email: true,
    inApp: true,
  },
  {
    eventType: "ESCROW_EXPIRED",
    label: "Escrow expired",
    email: false,
    inApp: true,
  },
  {
    eventType: "EXPIRATION_WARNING",
    label: "Expiration warning",
    email: true,
    inApp: true,
  },
  {
    eventType: "PARTY_JOINED",
    label: "Party joined",
    email: false,
    inApp: true,
  },
];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
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
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const savedSound = localStorage.getItem('vaultix_sound_enabled');
    if (savedSound !== null) {
      setSoundEnabled(savedSound !== 'false');
    }
  }, []);

  const toggle = (index: number, field: "email" | "inApp") => {
    setPrefs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: !p[field] } : p))
    );
    setSaved(false);
  };

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('vaultix_sound_enabled', String(nextVal));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SectionCard title="Notification Preferences" icon={Bell}>
      <div className="space-y-4">
        {/* Sound toggle */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <span className="text-sm font-medium text-gray-700 block">Notification Sound</span>
            <span className="text-xs text-gray-400">Play a chime when a new notification is received</span>
          </div>
          <Toggle checked={soundEnabled} onChange={handleToggleSound} />
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 text-xs text-gray-400 font-medium uppercase tracking-wider px-1 pt-1">
          <span>Event</span>
          <span>Email</span>
          <span>In-app</span>
        </div>
        {prefs.map((pref, i) => (
          <div
            key={pref.eventType}
            className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center"
          >
            <span className="text-sm text-gray-700">{pref.label}</span>
            <Toggle checked={pref.email} onChange={() => toggle(i, "email")} />
            <Toggle checked={pref.inApp} onChange={() => toggle(i, "inApp")} />
          </div>
        ))}
        <div className="pt-2">
          <button
            onClick={handleSave}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {saved ? "Saved!" : "Save preferences"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── API Keys Section ───────────────────────────────────────────────────────

function ApiKeysSection() {
  return <ApiKeyManager />;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>

        <ProfileSection />
        <NotificationPrefsSection />
        <ApiKeysSection />
      </div>
    </div>
  );
}
