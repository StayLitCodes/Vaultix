import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";

import {
  BarCodeScanner,
  BarCodeScannerResult,
} from "expo-barcode-scanner";

import { processScannedQRCode } from "../services/qrScanner";
import ScanResultBanner from "./ScanResultBanner";

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddressScanned?: (value: string) => void;
  onEscrowScanned?: (value: string) => void;
};

export default function QRScannerModal({
  visible,
  onClose,
  onAddressScanned,
  onEscrowScanned,
}: Props) {

  const [permission, setPermission] =
    useState<boolean | null>(null);

  const [hasScanned, setHasScanned] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } =
        await BarCodeScanner.requestPermissionsAsync();

      setPermission(status === "granted");
    })();
  }, []);

  const handleScan = ({
    data,
  }: BarCodeScannerResult) => {

    if (hasScanned) return;

    setHasScanned(true);

    const result = processScannedQRCode(data);

    if (result.type === "stellar_address") {
      onAddressScanned?.(result.value);
      onClose();
      return;
    }

    if (result.type === "escrow_id") {
      onEscrowScanned?.(result.value);
      onClose();
      return;
    }

    setErrorMessage(
      "Invalid Stellar address or escrow ID."
    );

    setTimeout(() => {
      setHasScanned(false);
      setErrorMessage(null);
    }, 2000);
  };

  if (permission === false) {
    return (
      <Modal visible={visible} transparent>
        <View style={styles.permissionBackdrop}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>
              Camera access denied
            </Text>

            <TouchableOpacity
              onPress={onClose}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.scannerContainer}>

        <BarCodeScanner
          onBarCodeScanned={handleScan}
          style={{ flex: 1 }}
        />

        <View style={styles.header}>
          <Text style={styles.headerText}>
            Scan Stellar Address or Escrow ID
          </Text>

          {errorMessage && (
            <ScanResultBanner
              message={errorMessage}
              error
            />
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  permissionBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  permissionButton: {
    backgroundColor: "#000",
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: "#fff",
    textAlign: "center",
  },
  scannerContainer: {
    backgroundColor: "#000",
    flex: 1,
  },
  header: {
    left: 0,
    paddingHorizontal: 20,
    position: "absolute",
    right: 0,
    top: 64,
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    bottom: 40,
    left: 0,
    paddingHorizontal: 24,
    position: "absolute",
    right: 0,
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontWeight: "600",
    textAlign: "center",
  },
});
