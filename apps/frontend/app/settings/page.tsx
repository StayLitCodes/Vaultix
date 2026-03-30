'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, RefreshCcw, ShieldCheck, Zap } from 'lucide-react';
import { useWallet as useWalletContext } from '@/app/contexts/WalletContext';
import { WalletType } from '@/app/services/wallet';
import { notificationService } from '@/services/notification';
import { apiKeyService } from '@/services/apiKey';
import {
  NotificationChannel,
  NotificationEventType,
  NotificationPreference,
} from '@/types/notification';
import { ApiKeyItem } from '@/types/user';

const EVENT_TYPES: NotificationEventType[] = [
  'ESCROW_CREATED',
  'ESCROW_FUNDED',
  'MILESTONE_RELEASED',
  'ESCROW_COMPLETED',
  'ESCROW_CANCELLED',
  'DISPUTE_RAISED',
  'DISPUTE_RESOLVED',
  'ESCROW_EXPIRED',
  'CONDITION_FULFILLED',
  'CONDITION_CONFIRMED',
  'EXPIRATION_WARNING',
];

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  webhook: 'Webhook',
};

const walletLabels: Record<WalletType, string> = {
  [WalletType.ALBEDO]: 'Albedo',
  [WalletType.FREIGHTER]: 'Freighter',
};

const defaultChannelPreferences = {
  email: { enabled: true, eventTypes: [...EVENT_TYPES] },
  webhook: { enabled: true, eventTypes: [...EVENT_TYPES] },
};

const SettingsPage = () => {
  const { wallet, connect, disconnect, getAvailableWallets, isConnecting } = useWalletContext();
  const [availableWallets, setAvailableWallets] = useState<WalletType[]>([]);
  const [preferences, setPreferences] = useState<Record<NotificationChannel, { enabled: boolean; eventTypes: NotificationEventType[] }>>(defaultChannelPreferences);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const network = wallet?.network ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoadingPreferences(true);
        setPreferencesError(null);
        const response = await notificationService.getPreferences();
        const emailPref = response.find((item) => item.channel === 'email');
        const webhookPref = response.find((item) => item.channel === 'webhook');

        setPreferences({
          email: emailPref
            ? { enabled: emailPref.enabled, eventTypes: emailPref.eventTypes }
            : defaultChannelPreferences.email,
          webhook: webhookPref
            ? { enabled: webhookPref.enabled, eventTypes: webhookPref.eventTypes }
            : defaultChannelPreferences.webhook,
        });
      } catch (err) {
        setPreferencesError('Unable to load notification preferences.');
      } finally {
        setLoadingPreferences(false);
      }
    };

    const loadWallets = async () => {
      try {
        setAvailableWallets(await getAvailableWallets());
      } catch {
        setAvailableWallets([]);
      }
    };

    const loadApiKeys = async () => {
      try {
        const keys = await apiKeyService.listApiKeys();
        setApiKeys(keys);
      } catch {
        setApiKeyError('Failed to load API keys.');
      }
    };

    void loadPreferences();
    void loadWallets();
    void loadApiKeys();
  }, [getAvailableWallets]);

  const handleToggleEventType = (channel: NotificationChannel, eventType: NotificationEventType) => {
    setPreferences((prev) => {
      const selected = prev[channel].eventTypes.includes(eventType)
        ? prev[channel].eventTypes.filter((item) => item !== eventType)
        : [...prev[channel].eventTypes, eventType];

      return {
        ...prev,
        [channel]: {
          enabled: selected.length > 0,
          eventTypes: selected,
        },
      };
    });
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    setPreferencesError(null);

    try {
      const payload = (['email', 'webhook'] as NotificationChannel[]).map((channel) => {
        const preference = preferences[channel];
        return {
          channel,
          enabled: preference.enabled,
          eventTypes: preference.enabled ? preference.eventTypes : EVENT_TYPES,
        };
      });

      await notificationService.updatePreferences(payload);
    } catch (err) {
      setPreferencesError('Failed to save notification preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      setApiKeyError('Please enter a name for the API key.');
      return;
    }

    setCreatingKey(true);
    setApiKeyError(null);
    setCreatedKey(null);

    try {
      const newKey = await apiKeyService.createApiKey(newApiKeyName.trim());
      setApiKeys((prev) => [newKey, ...prev]);
      setCreatedKey(newKey.key ?? null);
      setNewApiKeyName('');
    } catch {
      setApiKeyError('Unable to create API key.');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await apiKeyService.revokeApiKey(id);
      setApiKeys((prev) => prev.filter((key) => key.id !== id));
    } catch {
      setApiKeyError('Unable to revoke API key.');
    }
  };

  const handleConnectWallet = async (walletType: WalletType) => {
    try {
      await connect(walletType);
    } catch {
      // ignore connect errors in the UI for now
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Settings</p>
            <h1 className="text-4xl font-semibold text-white">Notification, API key, and wallet settings</h1>
          </div>
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200">
              <Zap className="h-4 w-4" /> {network.toUpperCase()} network
            </span>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Notification preferences</h2>
                  <p className="mt-2 text-sm text-slate-400">Toggle email and webhook delivery per event type.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={savingPreferences || loadingPreferences}
                  className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> Save preferences
                </button>
              </div>

              {loadingPreferences ? (
                <div className="mt-8 rounded-3xl bg-slate-950/80 p-8 text-slate-400">Loading preferences...</div>
              ) : (
                <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
                  <div className="grid grid-cols-[1.8fr_1fr_1fr] gap-px bg-slate-800 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <div className="px-4 py-3 bg-slate-900">Event</div>
                    <div className="px-4 py-3 bg-slate-900">Email</div>
                    <div className="px-4 py-3 bg-slate-900">Webhook</div>
                  </div>
                  {EVENT_TYPES.map((eventType) => (
                    <div key={eventType} className="grid grid-cols-[1.8fr_1fr_1fr] gap-px border-t border-slate-800">
                      <div className="bg-slate-950 px-4 py-4 text-sm text-slate-100">{eventType.replace(/_/g, ' ')}</div>
                      {(['email', 'webhook'] as NotificationChannel[]).map((channel) => {
                        const active = preferences[channel].eventTypes.includes(eventType);
                        return (
                          <button
                            key={`${channel}-${eventType}`}
                            type="button"
                            onClick={() => handleToggleEventType(channel, eventType)}
                            className={`bg-slate-950 px-4 py-4 text-sm font-semibold transition ${active ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                          >
                            {active ? 'On' : 'Off'}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {preferencesError && (
                <div className="mt-4 rounded-2xl bg-rose-950/70 px-4 py-3 text-sm text-rose-200">{preferencesError}</div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">API key management</h2>
                  <p className="mt-2 text-sm text-slate-400">Create, list, and revoke API keys for backend access.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateApiKey}
                  disabled={creatingKey}
                  className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> Create key
                </button>
              </div>

              <div className="mt-8 flex flex-col gap-4 rounded-3xl bg-slate-950/80 p-6">
                <label className="text-sm font-medium text-slate-200">Key name</label>
                <input
                  value={newApiKeyName}
                  onChange={(event) => setNewApiKeyName(event.target.value)}
                  className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500"
                  placeholder="e.g. My API key"
                />
              </div>

              {createdKey && (
                <div className="mt-6 rounded-3xl border border-emerald-600/30 bg-emerald-950/20 p-6 text-sm text-emerald-100">
                  <p className="font-medium text-emerald-100">API key created successfully. Copy it now — this value will not be shown again.</p>
                  <div className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-sm text-slate-100">{createdKey}</div>
                </div>
              )}

              {apiKeyError && (
                <div className="mt-4 rounded-2xl bg-rose-950/70 px-4 py-3 text-sm text-rose-200">{apiKeyError}</div>
              )}

              <div className="mt-8 space-y-4">
                {apiKeys.length === 0 ? (
                  <div className="rounded-2xl bg-slate-950/80 p-6 text-sm text-slate-400">No API keys available yet.</div>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-200">{key.name}</p>
                            <p className="text-xs text-slate-500">Created {new Date(key.createdAt).toLocaleDateString()}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRevokeApiKey(key.id)}
                            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500"
                          >
                            Revoke
                          </button>
                        </div>
                        <p className="mt-4 text-xs text-slate-400">Status: {key.active ? 'Active' : 'Revoked'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-violet-300" />
                <h2 className="text-xl font-semibold text-white">Wallet management</h2>
              </div>
              <p className="mt-3 text-sm text-slate-400">Disconnect, reconnect, or switch wallet provider.</p>

              <div className="mt-8 space-y-4">
                <div className="rounded-3xl bg-slate-950/80 p-6">
                  <p className="text-sm text-slate-400">Connected wallet</p>
                  <p className="mt-2 break-all text-sm font-medium text-slate-100">{wallet?.publicKey ?? 'No wallet connected'}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {wallet ? (
                      <button
                        type="button"
                        onClick={disconnect}
                        className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-400">Connect a wallet below.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-950/80 p-6">
                  <p className="text-sm text-slate-400">Switch wallet</p>
                  <div className="mt-4 grid gap-3">
                    {availableWallets.length === 0 && (
                      <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-400">No wallet providers detected.</div>
                    )}
                    {availableWallets.map((walletType) => (
                      <button
                        key={walletType}
                        type="button"
                        onClick={() => void handleConnectWallet(walletType)}
                        className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${wallet?.walletType === walletType ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'}`}
                        disabled={isConnecting}
                      >
                        {walletLabels[walletType]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-300" />
                <h2 className="text-xl font-semibold text-white">Current network</h2>
              </div>
              <p className="mt-3 text-sm text-slate-400">Wallet connection is using this network for Stellar interactions.</p>
              <div className="mt-6 inline-flex rounded-full bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100">{network.toUpperCase()}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
