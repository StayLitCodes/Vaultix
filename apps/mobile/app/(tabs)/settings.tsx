/**
 * Settings tab (#552).
 * Registered in `app/(tabs)/_layout.tsx` — before that it was unreachable and
 * the biometric lock shipped in #333 could never be turned on.
 */
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useBiometricLock } from '../../hooks/useBiometricLock';
import { useSession } from '../../hooks/useSession';
import { CopyButton } from '../../components/CopyButton';
import { revealWalletSeed, importWalletFromSeed, removeWallet } from '../../services/wallet';

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { isSupported, isEnrolled, isEnabled, enableBiometric, disableBiometric } = useBiometricLock();
  const { walletAddress, isAuthenticated, isGuest, signOut, exitGuestMode } = useSession();

  const handleToggle = async (value: boolean) => {
    if (value) {
      await enableBiometric();
    } else {
      await disableBiometric();
    }
  };

  const handleConnect = () => {
    exitGuestMode();
    router.replace('/');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Your wallet key stays on this device, but you will need to sign in again to act on escrows.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ],
    );
  };

  // --- Wallet management state ---
  const [seedVisible, setSeedVisible] = useState(false);
  const [seedValue, setSeedValue] = useState<string | null>(null);
  const [importSeed, setImportSeed] = useState('');

  const handleRevealSeed = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to reveal your secret seed',
          cancelLabel: 'Cancel',
        });
        if (!result.success) return;
      }
      const seed = await revealWalletSeed();
      setSeedValue(seed);
      setSeedVisible(true);
    } catch {
      Alert.alert('Error', 'Could not reveal seed. No wallet found.');
    }
  };

  const handleImportWallet = () => {
    if (!importSeed.trim()) {
      Alert.alert('Error', 'Please enter a secret seed.');
      return;
    }
    Alert.alert(
      'Import Wallet',
      'This will replace your current wallet. You will need to sign in again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              await importWalletFromSeed(importSeed.trim());
              setImportSeed('');
              Alert.alert('Success', 'Wallet imported. Please sign in again.');
              router.replace('/');
            } catch {
              Alert.alert('Invalid Seed', 'The secret seed you entered is not valid.');
            }
          },
        },
      ],
    );
  };

  const handleRemoveWallet = () => {
    Alert.alert(
      'Remove Wallet',
      'This will permanently remove your wallet from this device. You will need to create or import a wallet to continue. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeWallet();
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Settings</Text>

      {/* --- Wallet / session (#550) --- */}
      <Text style={styles.sectionTitle}>Wallet</Text>
      <View style={styles.card}>
        {isAuthenticated && walletAddress ? (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Connected</Text>
                <Text style={styles.settingDescription}>{truncateAddress(walletAddress)}</Text>
              </View>
              <CopyButton value={walletAddress} label="Copy" toastMessage="Address copied" />
            </View>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out of Vaultix"
            >
              <Text style={styles.dangerBtnText}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>
                  {isGuest ? 'Read-only mode' : 'Not connected'}
                </Text>
                <Text style={styles.settingDescription}>
                  Connect a wallet to create, fund or release escrows.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleConnect}
              accessibilityRole="button"
              accessibilityLabel="Connect a wallet"
            >
              <Text style={styles.primaryBtnText}>Connect wallet</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* --- Seed Backup / Import / Remove --- */}
      {isAuthenticated && walletAddress && (
        <>
          <Text style={styles.sectionTitle}>Seed Management</Text>
          <View style={styles.card}>
            {!seedVisible ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleRevealSeed}>
                <Text style={styles.primaryBtnText}>Reveal Secret Seed</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.seedWarning}>
                  ⚠️ Never share this seed with anyone. It grants full control over your funds.
                </Text>
                <View style={styles.seedContainer}>
                  <Text style={styles.seedValue} selectable>{seedValue}</Text>
                </View>
                <CopyButton value={seedValue ?? ''} label="Copy Seed" toastMessage="Seed copied" />
                <TouchableOpacity onPress={() => { setSeedVisible(false); setSeedValue(null); }} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Hide Seed</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Import Wallet</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              value={importSeed}
              onChangeText={setImportSeed}
              placeholder="Enter Stellar secret seed (S...)"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              secureTextEntry
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleImportWallet}>
              <Text style={styles.primaryBtnText}>Import</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleRemoveWallet}>
              <Text style={styles.dangerBtnText}>Remove Wallet</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* --- Security (#333 / #552) --- */}
      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Biometric App Lock</Text>
            <Text style={styles.settingDescription}>
              {!isSupported || !isEnrolled
                ? 'Biometrics not supported or not set up on this device.'
                : 'Require FaceID/TouchID when opening Vaultix'}
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            disabled={!isSupported || !isEnrolled}
            accessibilityLabel="Toggle biometric app lock"
            trackColor={{ false: '#334155', true: '#3B82F6' }}
            thumbColor={isEnabled ? '#ffffff' : '#94A3B8'}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  // Extra bottom room so the last card never sits under the tab bar / home indicator.
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#94A3B8',
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#ef476f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  dangerBtnText: { color: '#ef476f', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnText: { color: '#94A3B8', fontWeight: '600', fontSize: 15 },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 12,
  },
  seedWarning: {
    color: '#F59E0B',
    fontSize: 12,
    marginBottom: 8,
  },
  seedContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  seedValue: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontSize: 13,
  },
});
