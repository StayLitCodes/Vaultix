"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { NotificationEventType, INotificationPreferences, IWebhook } from "@/types/notifications";

const EVENT_LABELS: Record<NotificationEventType, string> = {
  [NotificationEventType.ESCROW_CREATED]: "Escrow Created",
  [NotificationEventType.ESCROW_FUNDED]: "Escrow Funded",
  [NotificationEventType.MILESTONE_RELEASED]: "Milestone Released",
  [NotificationEventType.DISPUTE_FILED]: "Dispute Filed",
  [NotificationEventType.DISPUTE_RESOLVED]: "Dispute Resolved",
};

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Record<NotificationEventType, { email: boolean; webhook: boolean }>>({
    [NotificationEventType.ESCROW_CREATED]: { email: true, webhook: false },
    [NotificationEventType.ESCROW_FUNDED]: { email: true, webhook: false },
    [NotificationEventType.MILESTONE_RELEASED]: { email: true, webhook: false },
    [NotificationEventType.DISPUTE_FILED]: { email: true, webhook: false },
    [NotificationEventType.DISPUTE_RESOLVED]: { email: true, webhook: false },
  });

  const [webhooks, setWebhooks] = useState<IWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Webhook Form State
  const [newUrl, setNewUrl] = useState("");
  const [selectedWebhookEvents, setSelectedWebhookEvents] = useState<NotificationEventType[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [prefRes, webRes] = await Promise.all([
        fetch("/api/notifications/preferences"),
        fetch("/api/webhooks")
      ]);

      if (prefRes.ok) {
        const prefData: INotificationPreferences = await prefRes.json();
        if (prefData?.preferences) {
          setPreferences(prefData.preferences);
        }
      }

      if (webRes.ok) {
        const webData = await webRes.json();
        setWebhooks(webData);
      }
    } catch (err) {
      console.error("Error fetching notification structures:", err);
      toast.error("Failed to load your notification preference profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleToggleChannel = (eventType: NotificationEventType, channel: "email" | "webhook") => {
    setPreferences((prev) => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [channel]: !prev[eventType][channel],
      },
    }));
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });

      if (!res.ok) throw new Error();
      toast.success("Notification configurations synced successfully.");
    } catch {
      toast.error("Failed to persist channels profile updates.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
      toast.error("Webhook endpoint targets must supply valid HTTP/HTTPS base protocols.");
      return;
    }
    if (selectedWebhookEvents.length === 0) {
      toast.error("Select at least one delivery topic trigger channel event mapping.");
      return;
    }

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, eventTypes: selectedWebhookEvents }),
      });

      if (!res.ok) throw new Error();
      toast.success("Webhook channel target registered.");
      setNewUrl("");
      setSelectedWebhookEvents([]);
      void fetchData();
    } catch {
      toast.error("Could not append the custom target endpoint interface.");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Webhook listener destroyed cleanly.");
      void fetchData();
    } catch {
      toast.error("Could not delete requested webhook listener endpoint node.");
    }
  };

  const handleTriggerTestNotification = async (channel: "email" | "webhook", targetId?: string) => {
    const contextKey = targetId ? `${channel}-${targetId}` : channel;
    try {
      setTesting(contextKey);
      const endpoint = channel === "email" 
        ? "/api/notifications/test-email" 
        : `/api/webhooks/${targetId}/test`;

      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success(`Test verification dispatched via standard ${channel} streams.`);
    } catch {
      toast.error(`Verification testing path dropped for execution handle ${channel}.`);
    } finally {
      setTesting(null);
    }
  };

  const toggleWebhookEventSelection = (event: NotificationEventType) => {
    setSelectedWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground animate-pulse p-4">Indexing configurations...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* SECTION 1: Master Channels Event Grid */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-bold">Event Notification Matrix</h3>
            <p className="text-xs text-muted-foreground">Select the delivery parameters routing transactional updates.</p>
          </div>
          <button
            onClick={() => void handleTriggerTestNotification("email")}
            disabled={testing !== null}
            className="text-xs font-semibold h-9 px-4 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {testing === "email" ? "Firing..." : "Test Dispatch Email"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs font-medium uppercase tracking-wider">
                <th className="py-3">Trigger Core Topic Name</th>
                <th className="py-3 text-center w-24">Email</th>
                <th className="py-3 text-center w-24">Webhook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(Object.keys(EVENT_LABELS) as NotificationEventType[]).map((event) => (
                <tr key={event} className="hover:bg-muted/40 transition-colors">
                  <td className="py-4 font-medium">{EVENT_LABELS[event]}</td>
                  <td className="py-4 text-center">
                    <input
                      type="checkbox"
                      checked={preferences[event]?.email ?? false}
                      onChange={() => handleToggleChannel(event, "email")}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-4 text-center">
                    <input
                      type="checkbox"
                      checked={preferences[event]?.webhook ?? false}
                      onChange={() => handleToggleChannel(event, "webhook")}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-border">
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            className="min-h-11 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving Changes..." : "Save Preferences"}
          </button>
        </div>
      </div>

      {/* SECTION 2: Webhook Endpoint Registries */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-1">Developer Webhook Streams</h3>
        <p className="text-xs text-muted-foreground mb-6">Stream JSON transaction lifecycle envelopes to custom listener routes.</p>

        {/* Existing Hook Iteration Lists */}
        {webhooks.length > 0 ? (
          <div className="space-y-4 mb-8">
            {webhooks.map((hook) => (
              <div key={hook.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-muted/50 border border-border gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="font-mono text-sm break-all font-semibold text-foreground">{hook.url}</div>
                  <div className="flex flex-wrap gap-1">
                    {hook.eventTypes.map((e) => (
                      <span key={e} className="text-[10px] bg-background px-2 py-0.5 rounded border border-border font-medium text-muted-foreground">
                        {EVENT_LABELS[e]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => void handleTriggerTestNotification("webhook", hook.id)}
                    disabled={testing !== null}
                    className="text-xs font-medium h-8 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {testing === `webhook-${hook.id}` ? "Testing..." : "Test Node"}
                  </button>
                  <button
                    onClick={() => void handleDeleteWebhook(hook.id)}
                    className="text-xs font-medium h-8 px-3 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground bg-muted/30 border border-dashed border-border rounded-lg p-6 text-center mb-8">
            No live active developer hook targets bound to this account context.
          </div>
        )}

        {/* Form Pipeline append updates */}
        <form onSubmit={handleAddWebhook} className="space-y-4 border-t border-border pt-6">
          <h4 className="text-sm font-semibold">Register Developer Listener Endpoints</h4>
          
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Endpoint Listener Payload Destination URL</label>
            <input
              type="text"
              placeholder="https://api.yourdomain.com/v1/escrow-receiver"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full h-11 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium block">Subscription Event Scope</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(EVENT_LABELS) as NotificationEventType[]).map((event) => (
                <label
                  key={event}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    selectedWebhookEvents.includes(event)
                      ? "bg-blue-600/5 border-blue-500 text-foreground"
                      : "bg-background border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedWebhookEvents.includes(event)}
                    onChange={() => toggleWebhookEventSelection(event)}
                    className="sr-only"
                  />
                  <span>{EVENT_LABELS[event]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="min-h-11 px-5 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              Add Hook Receiver
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}