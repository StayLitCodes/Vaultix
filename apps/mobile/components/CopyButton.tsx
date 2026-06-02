/**
 * CopyButton – copies text to clipboard with visible toast feedback.
 * Uses expo-clipboard for cross-platform clipboard access.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { showToast } from './Toast';

interface CopyButtonProps {
  /** The text to copy to clipboard */
  value: string;
  /** Short label shown next to the icon, e.g. "Copy Address" */
  label?: string;
  /** Toast message shown after copy. Defaults to "Copied!" */
  toastMessage?: string;
  /** Compact mode – icon only, no label */
  compact?: boolean;
  /** Style variant */
  variant?: 'primary' | 'ghost';
}

export function CopyButton({
  value,
  label = 'Copy',
  toastMessage = 'Copied!',
  compact = false,
  variant = 'ghost',
}: CopyButtonProps) {
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(value);
      setJustCopied(true);
      showToast({ message: toastMessage, type: 'success' });
      setTimeout(() => setJustCopied(false), 1500);
    } catch {
      showToast({ message: 'Failed to copy', type: 'error' });
    }
  }, [value, toastMessage]);

  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        compact ? styles.compact : styles.regular,
        isPrimary && styles.primaryBtn,
      ]}
      onPress={handleCopy}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      activeOpacity={0.7}
    >
      <Text style={[styles.icon, justCopied && styles.iconCopied]}>
        {justCopied ? '✓' : '📋'}
      </Text>
      {!compact && (
        <Text style={[styles.label, isPrimary && styles.labelPrimary, justCopied && styles.labelCopied]}>
          {justCopied ? 'Copied' : label}
        </Text>
      )}
    </TouchableOpacity>
  );
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
  icon: { fontSize: 14 },
  iconCopied: { fontSize: 14 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '500' },
  labelPrimary: { color: '#fff' },
  labelCopied: { color: '#06d6a0' },
});
