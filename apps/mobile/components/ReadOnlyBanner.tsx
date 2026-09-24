/**
 * #550 — persistent read-only notice for the "Explore without wallet" path.
 * Rendered above the tab navigator so every tab makes the unauthenticated
 * state obvious, with a one-tap route back to the connect screen.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function ReadOnlyBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.icon}>👁</Text>
      <Text style={styles.text} numberOfLines={2}>
        Read-only preview — connect a wallet to create, fund or release escrows.
      </Text>
      <TouchableOpacity
        onPress={onConnect}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel="Connect a wallet to leave read-only mode"
      >
        <Text style={styles.actionText}>Connect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3d2f00',
    borderBottomWidth: 1,
    borderBottomColor: '#5c4700',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  icon: { fontSize: 14 },
  text: { color: '#ffd166', flex: 1, fontSize: 12, lineHeight: 16 },
  action: {
    backgroundColor: '#ffd166',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { color: '#3d2f00', fontSize: 12, fontWeight: '700' },
});
