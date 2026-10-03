import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../components/Toast';
import { hydrateSession } from '../services/session';
import { setSessionExpiredHandler } from '../services/api';
import { registerLogoutSideEffect } from '../services/auth';
import { unregisterPushToken } from '../services/pushNotifications';
import { useRouter } from 'expo-router';
import { validateEnv } from '../security/env';

import { AppState, AppStateStatus } from 'react-native';
import { useBiometricLock } from '../hooks/useBiometricLock';
import { useAppVersion } from '../hooks/useAppVersion';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { MobileLockScreen } from '../components/MobileLockScreen';
import { UpdatePromptModal } from '../components/UpdatePromptModal';
import { colors } from '../theme';
import { useEffect, useRef, useState, useCallback } from 'react';

export default function RootLayout() {
  const {
    isEnabled,
    isUnlocked,
    isInitializing,
    authenticate,
    lock,
    disableBiometric,
    forceDisableBiometric,
    biometricsUnavailableWhileLocked,
    availability,
  } = useBiometricLock();
  const router = useRouter();
  const { needsUpdate, forceUpdate, latestVersion, updateUrl, isLoading } = useAppVersion();
  const appState = useRef(AppState.currentState);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // #761 — Tapping a push notification deep-links to the escrow it is about.
  // The `useCallback` identity is stable so the effect below runs once.
  const handlePushTap = useCallback((payload: { escrowId?: string; type?: string }) => {
    if (payload?.escrowId) {
      router.push(`/escrow/${payload.escrowId}`);
      return;
    }
    // No escrow attached (e.g. a generic dispute notice) — land on the feed.
    router.push('/(tabs)/notifications');
  }, [router]);

  // Installs the foreground Toast handler, the Android channel and the tap
  // listener. Never prompts for permission — that only happens from Settings.
  usePushNotifications(handlePushTap);

  useEffect(() => {
    validateEnv();
    hydrateSession();
  }, []);

  // #719 — on 401, clear token (interceptor) and return to welcome once.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      router.replace('/');
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  // #761 — every logout path must de-register this device's push token, so a
  // shared device stops receiving the previous wallet's escrow activity.
  useEffect(() => registerLogoutSideEffect(() => {
    void unregisterPushToken();
  }), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (isEnabled) {
          authenticate();
        }
      } else if (nextAppState === 'background') {
        lock();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isEnabled, authenticate, lock]);

  // Force update: shown before biometric unlock, cannot be dismissed
  const showForceUpdate = !isLoading && forceUpdate;

  // Soft update: shown after unlock, dismissible once per session
  const showSoftUpdate =
    !isLoading && needsUpdate && !forceUpdate && isUnlocked && !updateDismissed;

  // The real <Stack> must not mount until the biometric preference check
  // resolves AND the user has unlocked. While `isInitializing` is true the
  // SecureStore read is still pending, so isUnlocked is false and the lock
  // screen renders instead — no real screen content is mounted and no
  // screen effects (data fetching, polling timers) fire behind the gate.
  const contentReady = !showForceUpdate && !isInitializing && isUnlocked;

  return (
    <SafeAreaProvider>
      <ToastProvider>
        {/* Force update gate — renders over everything including biometric lock */}
        <UpdatePromptModal
          visible={showForceUpdate}
          forceUpdate={true}
          latestVersion={latestVersion}
          updateUrl={updateUrl}
          onDismiss={() => {}}
        />

        {/* Biometric lock gate */}
        {!showForceUpdate && !isUnlocked && (
          <MobileLockScreen
            onUnlock={authenticate}
            onDisableFallback={async () => {
              if (biometricsUnavailableWhileLocked) {
                await forceDisableBiometric({ preferDevicePasscode: false });
              } else {
                const ok = await disableBiometric();
                if (!ok) {
                  await forceDisableBiometric();
                }
              }
            }}
            biometricsUnavailable={biometricsUnavailableWhileLocked}
            availability={availability}
          />
        )}

        {/* Soft update prompt — shown after unlock, dismissible */}
        <UpdatePromptModal
          visible={showSoftUpdate}
          forceUpdate={false}
          latestVersion={latestVersion}
          updateUrl={updateUrl}
          onDismiss={() => setUpdateDismissed(true)}
        />

        <StatusBar style="auto" />
        {contentReady && (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          >
            {/* Welcome / Connect Wallet */}
            <Stack.Screen name="index" options={{ headerShown: false }} />

            {/* Tab screens (dashboard + notifications + settings) – rendered via (tabs)/_layout */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            {/* Full-screen detail screens */}
            <Stack.Screen name="escrow/[id]" options={{ title: 'Escrow Detail' }} />
            <Stack.Screen name="invite/[token]" options={{ title: 'Accept Invitation' }} />
            <Stack.Screen name="escrow/create" options={{ title: 'Create Escrow' }} />
            <Stack.Screen name="escrow/release" options={{ title: 'Release Milestone' }} />
          </Stack>
        )}
      </ToastProvider>
    </SafeAreaProvider>
  );
}
