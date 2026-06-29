"use client";

import NotificationPreferences from "@/components/settings/NotificationPreferences";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Account Parameters</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maintain your system identifiers, programmatic hook endpoints, and communication matrices.
          </p>
        </div>

        <hr className="border-border" />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Notification Channels Configuration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Determine how real-time network states update your local node and remote monitoring environments.
            </p>
          </div>
          <NotificationPreferences />
        </section>
      </div>
    </main>
  );
}