import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
        <Stack.Screen name="index" options={{ title: 'Vaultix' }} />
        <Stack.Screen name="wallet/connect" options={{ title: 'Connect Wallet' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="escrow/[id]" options={{ title: 'Escrow Detail' }} />
        <Stack.Screen name="escrow/create" options={{ title: 'Create Escrow' }} />
        <Stack.Screen name="escrow/release" options={{ title: 'Release Milestone' }} />
      </Stack>
    </>
  );
}
