/**
 * #762 — biometric re-authentication before value-moving actions.
 *
 * The app lock only covered launch and foreground resume, so an already
 * unlocked phone could release a milestone or create an escrow with a plain
 * button tap. These tests cover the hook's contract and both call sites.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';

const mockStore = new Map<string, string>();

jest.mock('../utils/secureStore', () => ({
  saveSecureItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  getSecureItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteSecureItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

jest.mock('expo-local-authentication');

jest.mock('expo-router', () => {
  const router = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
  return {
    useLocalSearchParams: jest.fn(),
    useRouter: () => router,
  };
});

jest.mock('../services/auth', () => ({ requireAuth: jest.fn() }));

jest.mock('../services/api', () => ({
  escrowApi: {
    getById: jest.fn(),
    releaseMilestone: jest.fn(),
    getTxStatus: jest.fn(),
    create: jest.fn(),
  },
}));

import ReleaseMilestoneScreen from '../app/escrow/release';
import CreateEscrowScreen from '../app/escrow/create';
import { useBiometricLock } from '../hooks/useBiometricLock';
import { escrowApi } from '../services/api';

const mockedParams = useLocalSearchParams as jest.Mock;
const mockedEscrowApi = escrowApi as jest.Mocked<typeof escrowApi>;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** Renders `useBiometricLock` against a SecureStore preloaded with `entries`. */
async function lockWith(entries: Record<string, string>) {
  mockStore.clear();
  for (const [k, v] of Object.entries(entries)) mockStore.set(k, v);
  const view = renderHook(() => useBiometricLock());
  await flush();
  return view;
}

describe('useBiometricLock re-authentication (#762)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  });

  it('defaults re-auth to on when the biometric lock is enabled', async () => {
    const { result } = await lockWith({ biometric_enabled: 'true' });
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.reauthRequired).toBe(true);
    // The default is persisted so Settings shows the real state.
    expect(mockStore.get('biometric_reauth_enabled')).toBe('true');
  });

  it('defaults re-auth to off when the app lock is off', async () => {
    const { result } = await lockWith({ biometric_enabled: 'false' });
    expect(result.current.reauthRequired).toBe(false);
  });

  it('honours an explicit "off" choice made while the lock was on', async () => {
    const { result } = await lockWith({
      biometric_enabled: 'true',
      biometric_reauth_enabled: 'false',
    });
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.reauthRequired).toBe(false);
  });

  it('is not required when the app lock is off, so the action just proceeds', async () => {
    const { result } = await lockWith({ biometric_enabled: 'false' });

    let outcome: Awaited<ReturnType<typeof result.current.reauthenticate>> | undefined;
    await act(async () => {
      outcome = await result.current.reauthenticate({
        promptMessage: 'Confirm milestone release',
        subtitle: 'Releasing 10 XLM',
      });
    });

    expect(outcome).toEqual({ required: false, success: true });
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  it('prompts with the action and the amount, then allows it through', async () => {
    const { result } = await lockWith({ biometric_enabled: 'true' });

    let outcome: Awaited<ReturnType<typeof result.current.reauthenticate>> | undefined;
    await act(async () => {
      outcome = await result.current.reauthenticate({
        promptMessage: 'Confirm milestone release',
        subtitle: 'Releasing 10 XLM — this cannot be undone.',
      });
    });

    expect(outcome).toEqual({ required: true, success: true });
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Confirm milestone release',
        subtitle: 'Releasing 10 XLM — this cannot be undone.',
      }),
    );
  });

  it('fails closed when the prompt is cancelled', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    const { result } = await lockWith({ biometric_enabled: 'true' });

    let outcome: Awaited<ReturnType<typeof result.current.reauthenticate>> | undefined;
    await act(async () => {
      outcome = await result.current.reauthenticate({
        promptMessage: 'Confirm escrow creation',
        subtitle: 'Locking 100 XLM',
      });
    });

    expect(outcome).toEqual({ required: true, success: false, reason: 'cancelled' });
  });

  it('fails closed when biometrics are unavailable', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    const { result } = await lockWith({ biometric_enabled: 'true' });

    let outcome: Awaited<ReturnType<typeof result.current.reauthenticate>> | undefined;
    await act(async () => {
      outcome = await result.current.reauthenticate({
        promptMessage: 'Confirm escrow creation',
        subtitle: 'Locking 100 XLM',
      });
    });

    expect(outcome).toEqual({ required: true, success: false, reason: 'unavailable' });
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  it('cannot be switched on while the app lock is off', async () => {
    const { result } = await lockWith({ biometric_enabled: 'false' });

    let applied = true;
    await act(async () => {
      applied = await result.current.setReauthRequired(true);
    });

    expect(applied).toBe(false);
    expect(mockStore.has('biometric_reauth_enabled')).toBe(false);
  });

  it('persists the Settings toggle', async () => {
    const { result } = await lockWith({ biometric_enabled: 'true' });

    await act(async () => {
      await result.current.setReauthRequired(false);
    });

    expect(result.current.reauthRequired).toBe(false);
    expect(mockStore.get('biometric_reauth_enabled')).toBe('false');
  });
});

describe('milestone release is gated by re-auth (#762)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    mockStore.set('biometric_enabled', 'true');
    mockStore.set('biometric_reauth_enabled', 'true');
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    mockedEscrowApi.getById.mockResolvedValue({
      id: 'escrow-1',
      asset: 'XLM',
      milestones: [{ id: 'milestone-1', title: 'Final delivery', amount: '250', status: 'pending' }],
    });
  });

  function renderRelease() {
    mockedParams.mockReturnValue({ escrowId: 'escrow-1', milestoneId: 'milestone-1' });
    render(<ReleaseMilestoneScreen />);
  }

  it('prompts with the amount before submitting the release', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    mockedEscrowApi.releaseMilestone.mockResolvedValue({ txHash: 'tx-1' });
    mockedEscrowApi.getTxStatus.mockResolvedValue({ status: 'confirmed', confirmed: true });

    renderRelease();
    await waitFor(() => expect(screen.getByText('Final delivery — 250 XLM')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Confirm release milestone'));

    await waitFor(() => expect(mockedEscrowApi.releaseMilestone).toHaveBeenCalled());
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Confirm milestone release',
        subtitle: expect.stringContaining('250 XLM'),
      }),
    );
  });

  it('aborts without any partial state change when the prompt is cancelled', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    renderRelease();
    await waitFor(() => expect(screen.getByText('Final delivery — 250 XLM')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Confirm release milestone'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Release cancelled',
      expect.stringContaining('not submitted'),
      expect.anything(),
    ));

    // No transaction, and the UI is still in the pre-submit state.
    expect(mockedEscrowApi.releaseMilestone).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Confirm release milestone')).toBeTruthy();
    expect(screen.queryByText('✅ Milestone released successfully!')).toBeNull();
    expect(screen.getByText('Ready')).toBeTruthy();

    alertSpy.mockRestore();
  });
});

describe('escrow creation is gated by re-auth (#762)', () => {
  const VALID_ADDRESS = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    mockStore.set('biometric_enabled', 'true');
    mockStore.set('biometric_reauth_enabled', 'true');
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  });

  /** Walks the 4-step form to the review step so the submit button exists. */
  async function fillFormToReviewStep() {
    render(<CreateEscrowScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. Website Development'), 'Website build');
    fireEvent.changeText(screen.getByPlaceholderText('G...'), VALID_ADDRESS);
    fireEvent.changeText(screen.getAllByPlaceholderText('0.00')[0], '100');
    fireEvent.press(screen.getByText('Next →'));

    await waitFor(() => expect(screen.getByText('Milestone title')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Milestone title'), 'Final delivery');
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '100');
    fireEvent.press(screen.getByText('Next →'));

    await waitFor(() => expect(screen.getByPlaceholderText('2026-12-31')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('2026-12-31'), '2030-12-31');
    fireEvent.press(screen.getByText('Next →'));

    await waitFor(() => expect(screen.getByLabelText('Create escrow')).toBeTruthy());
  }

  it('prompts with the locked amount before creating the escrow', async () => {
    mockedEscrowApi.create.mockResolvedValue({ id: 'new-escrow' });

    await fillFormToReviewStep();
    fireEvent.press(screen.getByLabelText('Create escrow'));

    await waitFor(() => expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled());
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Confirm escrow creation',
        subtitle: expect.stringContaining('100 XLM'),
      }),
    );
    await waitFor(() => expect(mockedEscrowApi.create).toHaveBeenCalled());
  });

  it('does not create the escrow when the prompt is cancelled', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await fillFormToReviewStep();
    fireEvent.press(screen.getByLabelText('Create escrow'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Escrow not created',
      expect.stringContaining('not created'),
      expect.anything(),
    ));

    // No escrow, and the form is left exactly as it was — still on review.
    expect(mockedEscrowApi.create).not.toHaveBeenCalled();
    expect(screen.getByText('Step 4 of 4')).toBeTruthy();
    expect(screen.getByLabelText('Create escrow')).toBeTruthy();

    alertSpy.mockRestore();
  });
});
