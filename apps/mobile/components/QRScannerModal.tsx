import React, { useEffect, useState } from "react";
import {
  Modal,
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
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-base font-semibold">
              Camera access denied
            </Text>

            <TouchableOpacity
              onPress={onClose}
              className="mt-4 bg-black rounded-xl px-4 py-3"
            >
              <Text className="text-white text-center">
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
      <View className="flex-1 bg-black">

        <BarCodeScanner
          onBarCodeScanned={handleScan}
          style={{ flex: 1 }}
        />

        <View className="absolute top-16 left-0 right-0 px-5">
          <Text className="text-white text-center text-lg font-semibold">
            Scan Stellar Address or Escrow ID
          </Text>

          {errorMessage && (
            <ScanResultBanner
              message={errorMessage}
              error
            />
          )}
        </View>

        <View className="absolute bottom-10 left-0 right-0 px-6">
          <TouchableOpacity
            onPress={onClose}
            className="bg-white rounded-2xl py-4"
          >
            <Text className="text-center font-semibold">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}