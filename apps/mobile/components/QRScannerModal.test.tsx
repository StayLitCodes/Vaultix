import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import QRScannerModal from "./QRScannerModal";

jest.mock("expo-barcode-scanner", () => ({
  BarCodeScanner: Object.assign(
    jest.fn(() => null),
    {
      requestPermissionsAsync: jest.fn().mockResolvedValue({
        status: "granted",
      }),
    }
  ),
}));

jest.mock("./ScanResultBanner", () => () => null);

describe("QRScannerModal escrow flow", () => {
  it("routes an app-generated escrow share URL to onEscrowScanned with the escrow ID", async () => {
    const mockScanner = BarCodeScanner as unknown as jest.Mock;

    const onEscrowScanned = jest.fn();
    const onClose = jest.fn();

    const escrowId = "550e8400-e29b-41d4-a716-446655440000";

    let scanCallback:
      | ((result: { data: string }) => void)
      | undefined;

    mockScanner.mockImplementation(
      (props: {
        onBarCodeScanned: (result: { data: string }) => void;
      }) => {
        scanCallback = props.onBarCodeScanned;
        return null;
      }
    );

    render(
      <QRScannerModal
        visible
        onClose={onClose}
        onEscrowScanned={onEscrowScanned}
      />
    );

    await act(async () => {
      scanCallback?.({
        data: `https://vaultix.app/escrow/${escrowId}`,
      });
    });

    await waitFor(() => {
      expect(onEscrowScanned).toHaveBeenCalledWith(escrowId);
      expect(onClose).toHaveBeenCalled();
    });
  });
});