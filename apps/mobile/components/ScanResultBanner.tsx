import React from "react";
import { StyleSheet, View, Text } from "react-native";

type Props = {
  message: string;
  error?: boolean;
};

export default function ScanResultBanner({
  message,
  error = false,
}: Props) {
  return (
    <View
      style={[
        styles.container,
        error ? styles.errorContainer : styles.successContainer,
      ]}
    >
      <Text style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorContainer: {
    backgroundColor: "#ef4444",
  },
  successContainer: {
    backgroundColor: "#16a34a",
  },
  message: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
