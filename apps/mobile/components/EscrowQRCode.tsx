import React from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { buildEscrowShareUrl } from "./ShareButton";

type Props = {
  escrowId: string;
};

export function EscrowQRCode({ escrowId }: Props) {
  const payload = buildEscrowShareUrl(escrowId);

  return (
    <View style={styles.container} accessible accessibilityLabel="Escrow QR code">
      <QRCode value={payload} size={220} backgroundColor="#ffffff" color="#000000" />
      <Text style={styles.caption}>Scan to open this escrow in Vaultix</Text>
      <Text style={styles.payload} numberOfLines={2}>
        {payload}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
  },
  caption: {
    color: "#222",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
  },
  payload: {
    color: "#666",
    fontSize: 11,
    marginTop: 8,
    textAlign: "center",
  },
});
