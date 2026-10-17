/**
 * OfflineBanner – shown at top of screens when network is unavailable.
 * Reuses the app's dark theme palette.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>🏡</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>You're offline</Text>
        <Text style={styles.subtitle}>Check your connection +¼ some features won't be available</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  icon: { fontSize: 18 },
  textContainer: { flex: 1 },
  title: { color: colors.surface, fontWeight: '700', fontSize: 13 },
  subtitle: { color: colors.surface, fontSize: 11, marginTop: 1, opacity: 0.85 },
});
