import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { colors } from '../theme';

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
    backgroundColor: colors.danger,
  },
  successContainer: {
    backgroundColor: colors.success,
  },
  message: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
});
