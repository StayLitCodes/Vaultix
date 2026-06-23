/**
 * ShareButton – opens native share sheet (iOS/Android) for escrow links & invites.
 * Uses React Native's built-in Share API for cross-platform sharing.
 */
import React, { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { showToast } from './Toast';

interface ShareButtonProps {
  /** The URL to share, e.g. escrow link */
  url: string;
  /** Title shown in the share sheet */
  title?: string;
  /** Message body in the share sheet */
  message?: string;
  /** Button label text */
  label?: string;
  /** Compact mode – icon only */
  compact?: boolean;
  /** Style variant */
  variant?: 'primary' | 'ghost';
}

export function ShareButton({
  url,
  title = 'Vaultix Escrow',
  message,
  label = 'Share',
  compact = false,
  variant = 'ghost',
}: ShareButtonProps) {
  const [justShared, setJustShared] = useState(false);

  const defaultMessage = message ?? `Check out this escrow on Vaultix: ${url}`;

  const handleShare = useCallback(async () => {
    try {
      const result = await Share.share({
        title,
        message: defaultMessage,
        url,
      });

      if (result.action === Share.sharedAction) {
        setJustShared(true);
        showToast({ message: 'Shared successfully!', type: 'success' });
        setTimeout(() => setJustShared(false), 1500);
      }
      // Share.dismissedAction – user cancelled, no feedback needed
    } catch {
      showToast({ message: 'Sharing failed', type: 'error' });
    }
  }, [url, title, defaultMessage]);

  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        compact ? styles.compact : styles.regular,
        isPrimary && styles.primaryBtn,
      ]}
      onPress={handleShare}
      accessibilityRole="button"
      accessibilityLabel={`Share escrow ${label}`}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{justShared ? '✓' : '↗'}</Text>
      {!compact && (
        <Text style={[styles.label, isPrimary && styles.labelPrimary, justShared && styles.labelCopied]}>
          {justShared ? 'Shared' : label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * buildEscrowShareUrl – generates a deep link for a given escrow ID.
 * Uses the app's web base URL as fallback when no custom domain is set.
 */
export function buildEscrowShareUrl(escrowId: string): string {
  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://vaultix.app';
  return `${webBaseUrl}/escrow/${escrowId}`;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  regular: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#2d2d44',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: '#2d2d4466',
  },
  primaryBtn: {
    backgroundColor: '#6c63ff',
  },
  icon: { fontSize: 16, fontWeight: '700', color: '#aaa' },
  label: { color: '#aaa', fontSize: 12, fontWeight: '500' },
  labelPrimary: { color: '#fff' },
  labelCopied: { color: '#06d6a0' },
});