import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createChallenge,
  extractWalletCallback,
  openWallet,
  supportsWalletOnPlatform,
  verifyWalletSignature,
  WALLET_CALLBACK_PATH,
  WALLET_CALLBACK_SCHEME,
  WALLET_OPTIONS,
  WalletConnectionState,
  WalletOption,
} from '../../services/wallet';

const INITIAL_STATE: WalletConnectionState = {
  status: 'idle',
  walletId: 'lobstr',
  message: 'Choose a mobile wallet and approve the signature prompt.',
};

export default function WalletConnectScreen() {
  const router = useRouter();
  const [selectedWallet, setSelectedWallet] = useState<WalletOption>(WALLET_OPTIONS[0]);
  const [connectionState, setConnectionState] = useState<WalletConnectionState>(INITIAL_STATE);
  const pendingChallengeRef = useRef<string | null>(null);

  const beginConnect = useCallback(async (wallet: WalletOption) => {
    const challenge = createChallenge(wallet.id);
    pendingChallengeRef.current = challenge;
    setConnectionState({
      status: 'connecting',
      walletId: wallet.id,
      challenge,
      message: `Opening ${wallet.name}. Approve the signing request from your wallet.`,
    });

    try {
      await openWallet(wallet, challenge);
      setConnectionState((current) => ({
        ...current,
        status: 'waiting',
        message: `Waiting for ${wallet.name} to return. If the wallet did not open, retry or switch wallets.`,
      }));
    } catch (error) {
      setConnectionState({
        status: 'error',
        walletId: wallet.id,
        message: `Unable to open ${wallet.name}. Please retry or switch wallets.`,
      });
      Alert.alert('Wallet connection issue', `Unable to open ${wallet.name}. Please retry or switch wallets.`);
    }
  }, []);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const parsed = extractWalletCallback(event.url);
      if (!parsed) {
        return;
      }

      const expectedChallenge = pendingChallengeRef.current;
      if (!expectedChallenge || parsed.challenge !== expectedChallenge) {
        setConnectionState({
          status: 'error',
          walletId: selectedWallet.id,
          message: 'The wallet callback did not match the active signing challenge.',
        });
        return;
      }

      const isValidSignature = verifyWalletSignature(parsed.publicKey, parsed.challenge, parsed.signature);
      if (!isValidSignature) {
        setConnectionState({
          status: 'error',
          walletId: selectedWallet.id,
          challenge: parsed.challenge,
          publicKey: parsed.publicKey,
          signature: parsed.signature,
          message: 'The returned signature could not be verified. Retry the connection or choose a different wallet.',
        });
        return;
      }

      setConnectionState({
        status: 'connected',
        walletId: selectedWallet.id,
        challenge: parsed.challenge,
        publicKey: parsed.publicKey,
        signature: parsed.signature,
        message: `${selectedWallet.name} connected successfully. Signature verified for mobile wallet signing.`,
      });
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    }).catch(() => undefined);

    return () => subscription.remove();
  }, [selectedWallet.id]);

  const retryConnection = () => {
    beginConnect(selectedWallet);
  };

  const switchWallet = (wallet: WalletOption) => {
    pendingChallengeRef.current = null;
    setSelectedWallet(wallet);
    setConnectionState({
      status: 'idle',
      walletId: wallet.id,
      message: `Switching to ${wallet.name}. Choose connect again when ready.`,
    });
  };

  useEffect(() => {
    if (connectionState.status === 'connected') {
      Alert.alert('Wallet connected', `${selectedWallet.name} is ready to sign required Stellar messages and transactions.`);
    }
  }, [connectionState.status, selectedWallet.name]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Mobile Stellar wallet flow</Text>
        <Text style={styles.title}>Connect a wallet with mobile-friendly signing</Text>
        <Text style={styles.subtitle}>
          Vaultix uses native deep links for mobile wallet approval so users can sign required messages and transaction prompts from their installed wallet.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recommended path</Text>
        <Text style={styles.cardText}>Open the installed wallet app, approve the challenge, and return to Vaultix. This keeps wallet approval in the native app for mobile users.</Text>
        <View style={styles.supportList}>
          {WALLET_OPTIONS.map((wallet) => {
            const supported = supportsWalletOnPlatform(wallet);
            const selected = wallet.id === selectedWallet.id;
            return (
              <TouchableOpacity
                key={wallet.id}
                style={[styles.walletOption, selected && styles.walletOptionActive, !supported && styles.walletOptionDisabled]}
                onPress={() => switchWallet(wallet)}
                disabled={!supported}
              >
                <View>
                  <Text style={styles.walletName}>{wallet.name}</Text>
                  <Text style={styles.walletDescription}>{wallet.description}</Text>
                  <Text style={styles.walletPlatform}>{wallet.supportedPlatforms.join(' • ')} • deep link fallback</Text>
                </View>
                <Text style={styles.walletBadge}>{selected ? 'Selected' : 'Choose'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connection status</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{connectionState.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.statusMessage}>{connectionState.message}</Text>

        {connectionState.publicKey ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Wallet address</Text>
            <Text style={styles.detailValue}>{connectionState.publicKey.slice(0, 12)}…{connectionState.publicKey.slice(-8)}</Text>
          </View>
        ) : null}

        {connectionState.signature ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Signature</Text>
            <Text style={styles.detailValue}>{connectionState.signature.slice(0, 18)}…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => beginConnect(selectedWallet)}
        >
          <Text style={styles.actionButtonText}>Connect wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={retryConnection}
        >
          <Text style={styles.actionButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What happens now</Text>
        <Text style={styles.stepText}>1. Vaultix opens the wallet using the mobile deep link.</Text>
        <Text style={styles.stepText}>2. The wallet prompts you to approve the signing challenge.</Text>
        <Text style={styles.stepText}>3. The wallet returns to Vaultix with the signed challenge, which is verified locally.</Text>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
        <Text style={styles.backButtonText}>Back to home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#0f1021',
    minHeight: '100%',
  },
  headerBlock: {
    marginBottom: 20,
  },
  eyebrow: {
    color: '#6c63ff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#a9adbc',
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#1a1b2e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2b2d42',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardText: {
    color: '#b9bbcb',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  supportList: {
    gap: 10,
  },
  walletOption: {
    backgroundColor: '#111226',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c2f44',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletOptionActive: {
    borderColor: '#6c63ff',
    backgroundColor: '#171733',
  },
  walletOptionDisabled: {
    opacity: 0.35,
  },
  walletName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  walletDescription: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 3,
  },
  walletPlatform: {
    color: '#6c63ff',
    fontSize: 11,
    fontWeight: '600',
  },
  walletBadge: {
    color: '#9ad3ff',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#162c44',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#202238',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
  statusMessage: {
    color: '#f3f4fb',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailBlock: {
    marginBottom: 10,
  },
  detailLabel: {
    color: '#71768f',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 5,
    fontWeight: '700',
  },
  detailValue: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#6c63ff',
  },
  secondaryButton: {
    backgroundColor: '#2a2b3d',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  stepText: {
    color: '#cbcfe2',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  backButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1d1f34',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
