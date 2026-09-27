import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
  stale: boolean;
};

export default function StaleDataBadge({
  stale,
}: Props) {
  if (!stale) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.label}>
        Stale Data
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
