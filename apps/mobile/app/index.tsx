/**
 * Welcome / Connect Wallet screen
 *
 * #550 — real Stellar challenge/response sign-in:
 * resolve the built-in wallet keypair → request a nonce from the backend →
 * sign it → exchange the signature for a JWT that is persisted in SecureStore.
 * No simulated token or hardcoded address remains.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { consumePendingRedirect, enterGuestMode, exitGuestMode } from '../services/auth';
import { signInWithBuiltInWallet } from '../services/walletAuth';
import {
  ExternalWalletName,
  isWalletCancelled,
  openExternalWalletGuide,
} from '../services/wallet';
import { useSession } from '../hooks/useSession';
import { toFriendlyError } from '../utils/errors';
import { showToast } from '../components/Toast';

/**
 * External wallets can deep-link, but they cannot yet answer the backend
 * sign-in challenge — the UI says so instead of silently doing nothing.
 */
const EXTERNAL_WALLETS: { name: ExternalWalletName; label: string }[] = [
  { name: 'lobstr', label: 'Lobstr' },
  { name: 'solar', label: 'Solar' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useSession();
  const [connecting, setConnecting] = useState(false);

  const goToApp = useCallback(() => {
    const pending = consumePendingRedirect();
    if (pending?.pathname) {
      router.replace({ pathname: pending.pathname, params: pending.params });
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }, [router]);

  // Restore a previously persisted session on cold start.
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    goToApp();
  }, [isHydrated, isAuthenticated, goToApp]);

  const handleConnectWallet = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      exitGuestMode();
      await signInWithBuiltInWallet();
      goToApp();
    } catch (error) {
      // Cancellation is not a failure — stay on the welcome screen, no dialog.
      if (isWalletCancelled(error)) {
        showToast({ message: 'Wallet connection cancelled', type: 'info' });
        return;
      }
      const friendly = toFriendlyError(error);
      Alert.alert(friendly.title, friendly.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleExploreWithoutWallet = () => {
    enterGuestMode();
    router.replace('/(tabs)/dashboard');
  };

  const handleExternalWallet = async (wallet: ExternalWalletName, label: string) => {
    try {
      await openExternalWalletGuide(wallet);
      showToast({
        message: `Opened ${label}. External-wallet sign-in isn't supported yet — use the built-in wallet.`,
        type: 'info',
        durationMs: 4000,
      });
    } catch (error) {
      Alert.alert(
        `${label} unavailable`,
        error instanceof Error ? error.message : toFriendlyError(error).message,
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
      {/* Branding */}
      <View style={styles.brandSection}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.appName}>Vaultix</Text>
        <Text style={styles.tagline}>Trustless Escrow on Stellar</Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        <FeatureItem icon="🛡️" title="Secure Escrow" description="Funds locked on-chain until conditions are met" />
        <FeatureItem icon="📋" title="Milestone Tracking" description="Release payments step-by-step as work is delivered" />
        <FeatureItem icon="⚖️" title="Dispute Resolution" description="Built-in arbitration to resolve disagreements fairly" />
      </View>

      {/* Connect wallet */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.connectBtn, connecting && styles.btnDisabled]}
          onPress={handleConnectWallet}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityState={{ disabled: connecting, busy: connecting }}
          accessibilityLabel="Connect wallet to continue"
        >
          {connecting ? (
            <View style={styles.connectingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.connectBtnText}>Signing in…</Text>
            </View>
          ) : (
            <Text style={styles.connectBtnText}>Connect Wallet</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your key is generated on this device and kept in secure storage. Connecting signs a
          one-time challenge — it never moves funds.
        </Text>
      </View>

      {/* External wallets — deep-link only, sign-in not yet supported */}
      <View style={styles.externalSection}>
        <Text style={styles.externalHeading}>Already use another wallet?</Text>
        <View style={styles.externalRow}>
          {EXTERNAL_WALLETS.map(({ name, label }) => (
            <TouchableOpacity
              key={name}
              style={[styles.externalBtn, connecting && styles.btnDisabled]}
              onPress={() => handleExternalWallet(name, label)}
              disabled={connecting}
              accessibilityRole="button"
              accessibilityLabel={`Open ${label} — external wallet sign-in is not available yet`}
            >
              <Text style={styles.externalBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.externalNote}>
          External-wallet sign-in isn&apos;t available yet — these open the app (or its website) so
          you can move funds to your Vaultix address.
        </Text>
      </View>

      {/* Skip / Explore */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={handleExploreWithoutWallet}
        disabled={connecting}
        accessibilityRole="button"
        accessibilityLabel="Explore Vaultix in read-only mode without connecting a wallet"
      >
        <Text style={styles.skipBtnText}>Explore without wallet (read-only) →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f' },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 40 },
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 64, marginBottom: 12 },
  appName: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#888', fontSize: 16, marginTop: 6 },
  features: { width: '100%', marginBottom: 36 },
  featureItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e30', borderRadius: 12, padding: 14, marginBottom: 10 },
  featureIcon: { fontSize: 24, marginRight: 12 },
  featureText: { flex: 1 },
  featureTitle: { color: '#fff', fontWeight: '600', fontSize: 15, marginBottom: 2 },
  featureDesc: { color: '#888', fontSize: 12, lineHeight: 16 },
  actionSection: { width: '100%', alignItems: 'center', marginBottom: 16 },
  connectBtn: {
    backgroundColor: '#6c63ff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  connectingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disclaimer: { color: '#666', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  externalSection: { width: '100%', alignItems: 'center', marginBottom: 20 },
  externalHeading: { color: '#888', fontSize: 12, marginBottom: 8 },
  externalRow: { flexDirection: 'row', gap: 10, width: '100%' },
  externalBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2d2d44',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  externalBtnText: { color: '#aaa', fontWeight: '600', fontSize: 14 },
  externalNote: { color: '#666', fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 8 },
  skipBtn: { marginTop: 4 },
  skipBtnText: { color: '#888', fontSize: 13, fontWeight: '500' },
});
