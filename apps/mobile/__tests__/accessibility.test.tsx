/**
 * #710 — every actionable control on the lock screen, force-update screen and
 * QR scanner must be announced by a screen reader with a meaningful label, and
 * toast feedback must be announced when it appears.
 */
import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

type ReactTestInstance = typeof screen.UNSAFE_root;

const mockRequestPermissions = jest.fn();
jest.mock('expo-barcode-scanner', () => {
  const { View } = jest.requireActual('react-native');
  const BarCodeScanner = (props: object) => <View {...props} />;
  BarCodeScanner.requestPermissionsAsync = (...args: unknown[]) => mockRequestPermissions(...args);
  return { BarCodeScanner };
});

import { MobileLockScreen } from '../components/MobileLockScreen';
import { UpdatePromptModal } from '../components/UpdatePromptModal';
import QRScannerModal from '../components/QRScannerModal';
import { showToast, ToastProvider } from '../components/Toast';

/** Host nodes a screen reader focuses as a single actionable element. */
function actionableNodes(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (node: ReactTestInstance) => typeof node.type === 'string' && node.props.accessible === true && typeof node.props.onClick === 'function',
  );
}

function expectAllLabelled(root: ReactTestInstance) {
  const nodes = actionableNodes(root);
  expect(nodes.length).toBeGreaterThan(0);
  for (const node of nodes) {
    expect(node.props.accessibilityRole).toBeTruthy();
    expect(typeof node.props.accessibilityLabel).toBe('string');
    expect(node.props.accessibilityLabel.trim().length).toBeGreaterThan(2);
  }
}

describe('MobileLockScreen', () => {
  it('labels both unlock and disable controls', () => {
    render(<MobileLockScreen onUnlock={jest.fn()} onDisableFallback={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Unlock with biometrics' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Disable biometric lock' })).toBeTruthy();
    expectAllLabelled(screen.UNSAFE_root);
  });
});

describe('UpdatePromptModal', () => {
  it('labels the only way forward on a forced update', () => {
    render(
      <UpdatePromptModal visible forceUpdate latestVersion="2.0.0" updateUrl="https://example.com" onDismiss={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Update Vaultix to version 2.0.0' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update later' })).toBeNull();
    expectAllLabelled(screen.UNSAFE_root);
  });

  it('labels Update Now and Later on an optional update', () => {
    render(
      <UpdatePromptModal
        visible
        forceUpdate={false}
        latestVersion="2.0.0"
        updateUrl="https://example.com"
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Update later' })).toBeTruthy();
    expectAllLabelled(screen.UNSAFE_root);
  });
});

describe('QRScannerModal', () => {
  it('labels the Close button when camera permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });
    render(<QRScannerModal visible onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close QR scanner' })).toBeTruthy());
    expectAllLabelled(screen.UNSAFE_root);
  });

  it('labels the Cancel button on the live scanner', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    render(<QRScannerModal visible onClose={jest.fn()} />);

    await waitFor(() => expect(mockRequestPermissions).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Cancel scanning' })).toBeTruthy();
    expectAllLabelled(screen.UNSAFE_root);
  });
});

describe('Toast', () => {
  it('is a polite live region and announces its message on iOS', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });

    try {
      render(<ToastProvider>{null}</ToastProvider>);
      act(() => showToast({ message: 'Address copied' }));

      expect(announce).toHaveBeenCalledWith('Address copied');
      const liveRegion = screen.UNSAFE_root.findAll(
        (node: ReactTestInstance) => typeof node.type === 'string' && node.props.accessibilityLiveRegion === 'polite',
      );
      expect(liveRegion.length).toBeGreaterThan(0);
      expect(liveRegion[0].props.accessibilityRole).toBe('alert');
      expect(screen.getByRole('button', { name: 'Address copied' })).toBeTruthy();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
      announce.mockRestore();
    }
  });
});
