import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import * as StellarSdk from "@stellar/stellar-sdk";

import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import { processScannedQRCode } from "../services/qrScanner";
import ScanResultBanner from "./ScanResultBanner";
import { colors } from '../theme';

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

  const [permission, requestPermission] = useCameraPermissions();

  const [hasScanned, setHasScanned] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (visible && permission?.status === "undetermined") {
      void requestPermission();
    }
  }, [visible, permission?.status, requestPermission]);

  const handleScan = ({
    data,
  }: BarcodeScanningResult) => {

    if (hasScanned) return;

    setHasScanned(true);

    const result = processScannedQRCode(data);

    if (result.type === "stellar_address") {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(result.value)) {
        setErrorMessage("Invalid Stellar address format.");
        setTimeout(() => {
          setHasScanned(false);
          setErrorMessage(null);
        }, 2000);
        return;
      }
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

  if (permission && !permission.granted) {
    return (
      <Modal visible={visible} transparent onRequestClose={onClose}>
        <View style={styles.permissionBackdrop}>
          <View style={styles.permissionCard} accessibilityViewIsModal>
            <Text style={styles.permissionTitle} accessibilityRole="header">
              Camera access denied
            </Text>

            <TouchableOpacity
              onPress={onClose}
              style={styles.permissionButton}
              accessibilityRole="button"
              accessibilityLabel="Close QR scanner"
              accessibilityHint="Camera access was denied. Closes the scanner and returns to the previous screen"
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.scannerContainer} accessibilityViewIsModal>

        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={hasScanned ? undefined : handleScan}
          accessibilityLabel="Camera viewfinder. Point it at a Stellar address or escrow QR code"
        />

        <View style={styles.header}>
          <Text style={styles.headerText} accessibilityRole="header">
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
            accessibilityRole="button"
            accessibilityLabel="Cancel scanning"
            accessibilityHint="Closes the QR scanner without scanning a code"
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
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    width: "100%",
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  permissionButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: colors.onAccent,
    textAlign: "center",
  },
  scannerContainer: {
    backgroundColor: colors.scrim,
    flex: 1,
  },
  camera: {
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
    color: colors.text,
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
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: "600",
    textAlign: "center",
  },
});
