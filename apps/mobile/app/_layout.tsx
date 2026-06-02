import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ToastProvider } from '../components/Toast';

import { AppState, AppStateStatus } from 'react-native';
import { useBiometricLock } from '../hooks/useBiometricLock';
import { useAppVersion } from '../hooks/useAppVersion';
import { MobileLockScreen } from '../components/MobileLockScreen';
import { UpdatePromptModal } from '../components/UpdatePromptModal';
import { useEffect, useRef, useState } from 'react';

export default function RootLayout() {
  const { isEnabled, isUnlocked, authenticate, lock, disableBiometric } = useBiometricLock();
  const { needsUpdate, forceUpdate, latestVersion, updateUrl, isLoading } = useAppVersion();
  const appState = useRef(AppState.currentState);
  const [updateDismissed, setUpdateDismissed] = useState(false);

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

  return (
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
          onDisableFallback={disableBiometric}
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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {/* Welcome / Connect Wallet */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* Tab screens (dashboard + notifications) – rendered via (tabs)/_layout */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Full-screen detail screens */}
        <Stack.Screen name="escrow/[id]" options={{ title: 'Escrow Detail' }} />
        <Stack.Screen name="invite/[token]" options={{ title: 'Accept Invitation' }} />
        <Stack.Screen name="escrow/create" options={{ title: 'Create Escrow' }} />
        <Stack.Screen name="escrow/release" options={{ title: 'Release Milestone' }} />
      </Stack>
    </ToastProvider>
  );
}
