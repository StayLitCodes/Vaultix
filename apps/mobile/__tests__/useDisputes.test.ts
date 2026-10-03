import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDisputes } from '../hooks/useDisputes';
import { disputeApi } from '../services/api';

jest.mock('../services/api', () => ({
  disputeApi: {
    file: jest.fn(),
    get: jest.fn(),
  },
}));

const mockedDisputeApi = disputeApi as jest.Mocked<typeof disputeApi>;

describe('useDisputes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('raises a dispute via the API and uses the server response', async () => {
    mockedDisputeApi.file.mockResolvedValue({
      id: 'server-dispute-1',
      escrowId: 'escrow-1',
      reason: 'Reason\n\nDescription',
      status: 'open',
      evidence: ['cid-1'],
    });

    const { result } = renderHook(() => useDisputes());

    let res: Awaited<ReturnType<typeof result.current.raiseDispute>> | undefined;
    await act(async () => {
      res = await result.current.raiseDispute('escrow-1', 'Reason', 'Description', ['cid-1']);
    });

    expect(mockedDisputeApi.file).toHaveBeenCalledWith('escrow-1', {
      reason: 'Reason\n\nDescription',
      evidence: ['cid-1'],
    });
    expect(res?.success).toBe(true);
    expect(result.current.hasActiveDispute).toBe(true);
    expect(result.current.dispute).toMatchObject({
      id: 'server-dispute-1',
      reason: 'Reason',
      description: 'Description',
      status: 'OPEN',
      evidence: ['cid-1'],
    });
  });

  it('rolls back optimistic state and returns a friendly error on failure', async () => {
    mockedDisputeApi.file.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderHook(() => useDisputes());

    let res: Awaited<ReturnType<typeof result.current.raiseDispute>> | undefined;
    await act(async () => {
      res = await result.current.raiseDispute('escrow-1', 'Reason', 'Description');
    });

    expect(res?.success).toBe(false);
    expect(res && !res.success && res.error.title).toBeTruthy();
    expect(result.current.dispute).toBeUndefined();
    expect(result.current.hasActiveDispute).toBe(false);
  });

  it('fetches the existing dispute status from the backend', async () => {
    mockedDisputeApi.get.mockResolvedValue({
      id: 'server-dispute-2',
      escrowId: 'escrow-2',
      reason: 'Late delivery',
      status: 'under_review',
    });

    const { result } = renderHook(() => useDisputes('escrow-2'));

    await waitFor(() => expect(result.current.dispute?.status).toBe('UNDER_REVIEW'));
    expect(mockedDisputeApi.get).toHaveBeenCalledWith('escrow-2');
  });
});
