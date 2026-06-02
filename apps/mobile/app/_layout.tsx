import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppState, AppStateStatus, ActivityIndicator, StyleSheet, View } from 'react-native';
import { useBiometricLock } from '../hooks/useBiometricLock';
import { MobileLockScreen } from '../components/MobileLockScreen';
import { useEffect, useRef, useState } from 'react';
import { initializeAuthState } from '../services/auth';

export default function RootLayout() {
  const { isEnabled, isUnlocked, authenticate, lock, disableBiometric } = useBiometricLock();
  const appState = useRef(AppState.currentState);

  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initializeAuthState().finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
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

  if (!authReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
      </View>
    );
  }

  if (!isUnlocked) {
    return (
      <MobileLockScreen 
        onUnlock={authenticate} 
        onDisableFallback={disableBiometric} 
      />
    );
  }

  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12121f',
  },
});
