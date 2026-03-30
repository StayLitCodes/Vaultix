'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, RefreshCcw } from 'lucide-react';
import { useWallet as useWalletContext } from '@/app/contexts/WalletContext';
import { WalletType } from '@/app/services/wallet';
import { userService } from '@/services/user';
import { escrowProfileService } from '@/services/escrowProfile';
import { UserProfile } from '@/types/user';

const STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  disputed: 'Disputed',
};

const walletLabels: Record<WalletType, string> = {
  [WalletType.ALBEDO]: 'Albedo',
  [WalletType.FREIGHTER]: 'Freighter',
};

const formatDate = (dateString?: string) =>
  dateString ? new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'Unknown';

const ProfilePage = () => {
  const { wallet, connect, getAvailableWallets, isConnecting, error } = useWalletContext();
  const [availableWallets, setAvailableWallets] = useState<WalletType[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [escrowStats, setEscrowStats] = useState({
    totalCreated: 0,
    active: 0,
    completed: 0,
    disputed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicKey = wallet?.publicKey ?? profile?.walletAddress;
  const network = wallet?.network ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  const explorerUrl = publicKey
    ? `https://stellar.expert/explorer/${network === 'mainnet' ? 'public' : 'testnet'}/account/${publicKey}`
    : undefined;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const [profileData, escrows] = await Promise.all([
          userService.getCurrentUser(),
          escrowProfileService.fetchUserEscrows(1000),
        ]);

        setProfile(profileData);

        const normalized = Array.isArray(escrows) ? escrows : [];
        const created = normalized.filter(
          (item) =>
            (item.creatorId && item.creatorId === profileData.walletAddress) ||
            (item.creatorAddress && item.creatorAddress === profileData.walletAddress),
        ).length;

        const active = normalized.filter(
          (item) => String(item.status).toLowerCase() === 'active',
        ).length;
        const completed = normalized.filter(
          (item) => String(item.status).toLowerCase() === 'completed',
        ).length;
        const disputed = normalized.filter(
          (item) => String(item.status).toLowerCase() === 'disputed',
        ).length;

        setEscrowStats({
          totalCreated: created,
          active,
          completed,
          disputed,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load profile';
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        setAvailableWallets(await getAvailableWallets());
      } catch {
        setAvailableWallets([]);
      }
    };

    void fetchWallets();
  }, [getAvailableWallets]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopyAddress = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
  };

  const connectToWallet = async (walletType: WalletType) => {
    try {
      await connect(walletType);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Profile</p>
            <h1 className="text-4xl font-semibold text-white">User profile & account</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/settings" className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700 transition">
              Open settings
            </Link>
            <button
              type="button"
              onClick={() => void window.location.reload()}
              className="inline-flex items-center justify-center rounded-full bg-slate-700 px-5 py-3 text-sm font-medium text-white hover:bg-slate-600 transition"
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading profile details...
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-500 bg-red-950/30 p-8 text-red-100">
            <h2 className="text-xl font-semibold">Unable to load profile</h2>
            <p className="mt-2 text-sm text-red-200">{loadError}</p>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Account summary</h2>
                    <p className="mt-2 text-sm text-slate-400">Your connected wallet and profile details.</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                    {wallet?.walletType ? walletLabels[wallet.walletType] : 'Wallet not connected'}
                  </span>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/80 p-6">
                    <p className="text-sm text-slate-400">Connected address</p>
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="break-all text-sm text-slate-100">{publicKey ?? 'No connected wallet'}</div>
                      {publicKey && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyAddress}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition"
                          >
                            <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
                          </button>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition"
                            >
                              <ExternalLink className="h-4 w-4" /> Explorer
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-950/80 p-6">
                    <p className="text-sm text-slate-400">Account role</p>
                    <p className="mt-3 text-xl font-semibold text-white">{profile?.role ?? 'USER'}</p>
                    <p className="mt-6 text-sm text-slate-400">Member since</p>
                    <p className="mt-1 text-base font-medium text-slate-100">{formatDate(profile?.createdAt)}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
                <h2 className="text-2xl font-semibold text-white">Escrow statistics</h2>
                <p className="mt-2 text-sm text-slate-400">Quick view of your escrow activity.</p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/80 p-6">
                    <p className="text-sm text-slate-400">Total created</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{escrowStats.totalCreated}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 p-6">
                    <p className="text-sm text-slate-400">Active escrows</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{escrowStats.active}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 p-6">
                    <p className="text-sm text-slate-400">Completed escrows</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{escrowStats.completed}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 p-6">
                    <p className="text-sm text-slate-400">Disputed escrows</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{escrowStats.disputed}</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
                <h3 className="text-xl font-semibold text-white">Wallet network</h3>
                <p className="mt-2 text-sm text-slate-400">Current network used for wallet operations.</p>
                <div className="mt-6 inline-flex items-center rounded-2xl bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100">
                  {network.toUpperCase()}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
                <h3 className="text-xl font-semibold text-white">Wallet connection</h3>
                <p className="mt-2 text-sm text-slate-400">Connect a wallet to manage your profile and transactions.</p>
                <div className="mt-6 space-y-3">
                  {availableWallets.map((walletType) => (
                    <button
                      key={walletType}
                      type="button"
                      onClick={() => void connectToWallet(walletType)}
                      disabled={isConnecting}
                      className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Connect with {walletLabels[walletType]}
                    </button>
                  ))}
                  {error && (
                    <p className="text-sm text-rose-300">{error}</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
