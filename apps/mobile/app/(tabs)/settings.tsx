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
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useSession } from '../../hooks/useSession';
import { CopyButton } from '../../components/CopyButton';
import { revealWalletSeed, importWalletFromSeed, removeWallet } from '../../services/wallet';
import { resetSessionExpiryGate } from '../../services/api';
import { colors } from '../../theme';

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    isSupported,
    isEnrolled,
    isEnabled,
    enableBiometric,
    disableBiometric,
    reauthRequired,
    setReauthRequired,
  } = useBiometricLock();
  const { walletAddress, isAuthenticated, isGuest, signOut, exitGuestMode } = useSession();
  // #761 — push is opt-in; asking the OS happens only when this toggle flips on.
  const {
    isEnabled: pushEnabled,
    isSupported: pushSupported,
    permissionStatus: pushPermission,
    isBusy: pushBusy,
    setEnabled: setPushEnabled,
    openSystemSettings,
  } = usePushNotifications();

  const handleToggle = async (value: boolean) => {
    if (value) {
      await enableBiometric();
    } else {
      await disableBiometric();
    }
  };

  // #762 — toggleable, and defaults to on whenever the app lock is enabled.
  const handleReauthToggle = async (value: boolean) => {
    const applied = await setReauthRequired(value);
    if (!applied) {
      Alert.alert(
        'Not available',
        'Turn on the biometric app lock first — confirming sensitive actions relies on it.',
        [{ text: 'OK' }],
      );
    }
  };

  const handleConnect = () => {
    exitGuestMode();
    router.replace('/');
  };

  // #761 — flipping the toggle on is the *only* place the OS prompt appears.
  const handlePushToggle = async (value: boolean) => {
    const outcome = await setPushEnabled(value);
    if (outcome.enabled || value) return;
    if (outcome.status === 'denied') {
      Alert.alert(
        'Notifications are blocked',
        'Vaultix can still show you escrow activity inside the app. To get push alerts, allow notifications for Vaultix in your system settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: openSystemSettings },
        ],
      );
    }
  };

  const pushNotificationDescription = !pushSupported
    ? 'Push notifications are not available on this build.'
    : pushPermission === 'denied'
      ? 'Blocked in system settings — the in-app list still works.'
      : pushEnabled
        ? 'Get alerted about funding, releases and disputes.'
        : 'Off. Turn on to get alerted about funding, releases and disputes.';

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

  const handleDisconnectWallet = () => {
    Alert.alert(
      'Disconnect Wallet',
      'This signs you out, clears the stored session token and all cached escrow data. You will need to reconnect your wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            // Go through the shared logout routine rather than calling
            // `clearSession()` directly, so disconnecting clears the dashboard
            // cache, every `escrow_detail_*` entry and the guest flag exactly
            // like "Sign out" does (#764).
            await signOut();
            resetSessionExpiryGate();
            router.replace('/');
          },
        },
      ],
    );
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
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleRevealSeed}
                accessibilityRole="button"
                accessibilityLabel="Reveal secret seed"
                accessibilityHint="Asks for biometric authentication, then shows your wallet's secret seed"
              >
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
                <TouchableOpacity
                  onPress={() => { setSeedVisible(false); setSeedValue(null); }}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Hide secret seed"
                >
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
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              secureTextEntry
              accessibilityLabel="Stellar secret seed to import"
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleImportWallet}
              accessibilityRole="button"
              accessibilityLabel="Import wallet"
              accessibilityHint="Replaces your current wallet with the one from the entered secret seed"
            >
              <Text style={styles.primaryBtnText}>Import</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleRemoveWallet}
              accessibilityRole="button"
              accessibilityLabel="Remove wallet"
              accessibilityHint="Permanently removes this wallet from the device after confirmation"
            >
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
            accessibilityRole="switch"
            accessibilityLabel="Biometric app lock"
            accessibilityHint={
              !isSupported || !isEnrolled
                ? 'Unavailable. Set up Face ID, Touch ID or fingerprint on this device first'
                : 'Requires Face ID, Touch ID or fingerprint when opening Vaultix'
            }
            accessibilityState={{ checked: isEnabled, disabled: !isSupported || !isEnrolled }}
            trackColor={{ false: '#334155', true: '#3B82F6' }}
            thumbColor={isEnabled ? '#ffffff' : '#94A3B8'}
          />
        </View>
      </View>

      {/* --- Notifications (#761) --- */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Text style={styles.settingDescription}>
              {pushNotificationDescription}
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={handlePushToggle}
            disabled={!pushSupported || pushBusy}
            accessibilityLabel="Toggle push notifications"
            trackColor={{ false: colors.border, true: colors.infoStrong }}
            thumbColor={pushEnabled ? colors.text : colors.textSecondary}
          />
        </View>

        {pushPermission === 'denied' && (
          <TouchableOpacity
            onPress={openSystemSettings}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Open system notification settings"
          >
            <Text style={styles.secondaryBtnText}>Open system settings</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        <TouchableOpacity
          onPress={handleDisconnectWallet}
          style={{
            backgroundColor: colors.dangerStrong,
            paddingVertical: 14,
            borderRadius: 8,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Disconnect Wallet"
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
            Disconnect Wallet
          </Text>
        </TouchableOpacity>
      </View>
</ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Extra bottom room so the last card never sits under the tab bar / home indicator.
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingRowSpaced: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingText: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  primaryBtn: {
    backgroundColor: colors.infoStrong,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  dangerBtnText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  seedWarning: {
    color: colors.warning,
    fontSize: 12,
    marginBottom: 8,
  },
  seedContainer: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  seedValue: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 13,
  },
});
