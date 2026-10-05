import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from '../theme';

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
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
