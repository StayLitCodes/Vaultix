/**
 * Welcome / Connect Wallet screen
 * Features: wallet connection simulation, animated branding, navigate to tabs on connect
 */
import React, { useEffect, useState } from 'react';
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
import { consumePendingRedirect, isAuthenticated } from '../services/auth';

export default function WelcomeScreen() {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) return;

    const pending = consumePendingRedirect();
    if (pending?.pathname) {
      router.replace({ pathname: pending.pathname, params: pending.params });
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }, [router]);

  const handleConnectWallet = async () => {
    setConnecting(true);
    try {
      // Simulate wallet connection – in production this uses @stellar/freighter-api or similar
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Store auth token (simulated)
      (global as Record<string, unknown>).__authToken = 'simulated-jwt-token';
      (global as Record<string, unknown>).__walletAddress = 'GABCD...XYZ';

      const pending = consumePendingRedirect();
      if (pending?.pathname) {
        router.replace({ pathname: pending.pathname, params: pending.params });
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch {
      Alert.alert('Connection Failed', 'Could not connect to wallet. Please try again.');
    } finally {
      setConnecting(false);
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
          accessibilityLabel="Connect wallet to continue"
        >
          {connecting ? (
            <View style={styles.connectingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.connectBtnText}>Connecting…</Text>
            </View>
          ) : (
            <Text style={styles.connectBtnText}>Connect Wallet</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By connecting, you agree to the Terms of Service and Privacy Policy.
        </Text>
      </View>

      {/* Skip / Explore */}
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={() => router.replace('/(tabs)/dashboard')}
        accessibilityRole="button"
        accessibilityLabel="Skip wallet connection and explore"
      >
        <Text style={styles.skipBtnText}>Explore without wallet →</Text>
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
  skipBtn: { marginTop: 4 },
  skipBtnText: { color: '#888', fontSize: 13, fontWeight: '500' },
});
