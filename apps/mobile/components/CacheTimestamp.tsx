import React from "react";
import { Text, StyleSheet } from "react-native";

type Props = {
  timestamp?: number;
};

export default function CacheTimestamp({
  timestamp,
}: Props) {
  if (!timestamp) return null;

  const formatted = new Date(timestamp).toLocaleString();

  return (
    <Text style={styles.text}>
      Last updated: {formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 8,
  },
});
