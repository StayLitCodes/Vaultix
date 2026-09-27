import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import ReleaseMilestoneScreen from '../app/escrow/release';
import { escrowApi } from '../services/api';
import { requireAuth } from '../services/auth';

jest.mock('expo-router', () => {
  const router = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
  return {
    useLocalSearchParams: jest.fn(),
    useRouter: () => router,
  };
});

jest.mock('../services/api', () => ({
  escrowApi: {
    releaseMilestone: jest.fn(),
    getTxStatus: jest.fn(),
  },
}));

jest.mock('../services/auth', () => ({
  requireAuth: jest.fn(),
}));

const mockedParams = useLocalSearchParams as jest.Mock;
const mockedEscrowApi = escrowApi as jest.Mocked<typeof escrowApi>;
const VALID_PARAMS = { escrowId: 'escrow-1', milestoneId: 'milestone-1' };

function expectReleaseUi() {
  expect(screen.getByText('Release Milestone')).toBeTruthy();
  expect(screen.getByText('Escrow: escrow-1')).toBeTruthy();
  expect(screen.getByText('Milestone: milestone-1')).toBeTruthy();
  expect(screen.getByLabelText('Confirm release milestone')).toBeTruthy();
}

function expectInvalidLinkUi() {
  expect(screen.getByText('Invalid Release Link')).toBeTruthy();
  expect(screen.getByText('This milestone release link is missing required information.')).toBeTruthy();
  expect(screen.queryByLabelText('Confirm release milestone')).toBeNull();
}

describe('ReleaseMilestoneScreen', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('keeps hook order stable when params arrive after the first render', () => {
    mockedParams.mockReturnValue({});
    const { rerender } = render(<ReleaseMilestoneScreen />);
    expectInvalidLinkUi();

    mockedParams.mockReturnValue(VALID_PARAMS);
    expect(() => rerender(<ReleaseMilestoneScreen />)).not.toThrow();

    expectReleaseUi();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('keeps hook order stable when params disappear on a later render', () => {
    mockedParams.mockReturnValue(VALID_PARAMS);
    const { rerender } = render(<ReleaseMilestoneScreen />);
    expectReleaseUi();

    mockedParams.mockReturnValue({});
    expect(() => rerender(<ReleaseMilestoneScreen />)).not.toThrow();

    expectInvalidLinkUi();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never reaches the release API or auth redirect while params are undefined', () => {
    mockedParams.mockReturnValue({});
    render(<ReleaseMilestoneScreen />);

    // The invalid-link view offers no release action, so the handler cannot fire
    expectInvalidLinkUi();
    expect(mockedEscrowApi.releaseMilestone).not.toHaveBeenCalled();
    expect(mockedEscrowApi.getTxStatus).not.toHaveBeenCalled();
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it('releases the milestone with the resolved params once they arrive', async () => {
    mockedEscrowApi.releaseMilestone.mockResolvedValue({ txHash: 'tx-1' });
    mockedEscrowApi.getTxStatus.mockResolvedValue({ status: 'confirmed', confirmed: true });

    mockedParams.mockReturnValue({});
    const { rerender } = render(<ReleaseMilestoneScreen />);
    mockedParams.mockReturnValue(VALID_PARAMS);
    rerender(<ReleaseMilestoneScreen />);

    fireEvent.press(screen.getByLabelText('Confirm release milestone'));

    await waitFor(() => expect(screen.getByText('✅ Milestone released successfully!')).toBeTruthy());
    expect(mockedEscrowApi.releaseMilestone).toHaveBeenCalledTimes(1);
    expect(mockedEscrowApi.releaseMilestone).toHaveBeenCalledWith(VALID_PARAMS);
    expect(mockedEscrowApi.getTxStatus).toHaveBeenCalledWith('tx-1');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
