<<<<<<< HEAD
/**
 * OfflineBanner – shown at top of screens when network is unavailable.
 * Reuses the app's dark theme palette.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>📡</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>You're offline</Text>
        <Text style={styles.subtitle}>Check your connection — some features won't be available</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f77f00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  icon: { fontSize: 18 },
  textContainer: { flex: 1 },
  title: { color: '#1a1a2e', fontWeight: '700', fontSize: 13 },
  subtitle: { color: '#1a1a2e', fontSize: 11, marginTop: 1, opacity: 0.85 },
});
=======
import React from "react";
import { View, Text } from "react-native";

type Props = {
  visible: boolean;
};

export default function OfflineBanner({
  visible,
}: Props) {

  if (!visible) return null;

  return (
    <View className="bg-yellow-500 px-4 py-3">
      <Text className="text-black text-sm font-medium text-center">
        Offline mode — showing cached data
      </Text>
    </View>
  );
}
>>>>>>> d431ba40ce53cfcf510d9b702e2540ee53b1f9f1
