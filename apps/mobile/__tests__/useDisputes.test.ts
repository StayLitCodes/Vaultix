import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDisputes } from '../hooks/useDisputes';
import { api, disputeApi } from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  api: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() } },
  },
  disputeApi: {
    uploadEvidence: jest.fn(),
  },
}));

describe('useDisputes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('raises a dispute correctly', async () => {
    const mockedPost = jest.mocked(api.post);
    mockedPost.mockResolvedValueOnce({
      data: {
        id: 'dispute-1',
        escrow_id: 'escrow-1',
        reason: 'Reason',
        status: 'open',
      },
    });

    const { result } = renderHook(() => useDisputes());

    let res: Awaited<ReturnType<typeof result.current.raiseDispute>> | undefined;
    await act(async () => {
      res = await result.current.raiseDispute('escrow-1', 'Reason', 'Description');
    });

    expect(res?.success).toBe(true);
    expect(result.current.hasActiveDispute).toBe(true);
    expect(result.current.dispute?.status).toBe('OPEN');
  });

  it('surfaces upload evidence URLs when evidence files are provided', async () => {
    const mockedUploadEvidence = jest.mocked(disputeApi.uploadEvidence);
    mockedUploadEvidence.mockResolvedValueOnce({ cid: 'cid-1', url: 'https://example.com/evidence' });

    const mockedPost = jest.mocked(api.post);
    mockedPost.mockResolvedValueOnce({
      data: {
        id: 'dispute-2',
        escrow_id: 'escrow-1',
        reason: 'Reason',
        status: 'open',
      },
    });

    const { result } = renderHook(() => useDisputes());

    await act(async () => {
      await result.current.raiseDispute('escrow-1', 'Reason', 'Description', [
        { uri: 'file://evidence.jpg', name: 'evidence.jpg', type: 'image/jpeg' },
      ]);
    });

    expect(mockedUploadEvidence).toHaveBeenCalledWith(
      'escrow-1',
      'file://evidence.jpg',
      'evidence.jpg',
      'image/jpeg',
    );
  });

  it('returns friendly error when raising a dispute fails', async () => {
    const mockedPost = jest.mocked(api.post);
    mockedPost.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDisputes());

    let res: Awaited<ReturnType<typeof result.current.raiseDispute>> | undefined;
    await act(async () => {
      res = await result.current.raiseDispute('escrow-1', 'Reason', 'Description');
    });

    expect(res?.success).toBe(false);
    expect(res?.error).toBeDefined();
    expect(result.current.dispute).toBeUndefined();
  });

  it('refreshes dispute status from the backend', async () => {
    const mockedGet = jest.mocked(api.get);
    mockedGet.mockResolvedValueOnce({
      data: {
        id: 'dispute-3',
        escrow_id: 'escrow-1',
        reason: 'Reason',
        status: 'resolved',
        outcome: 'split',
        seller_percent: 50,
        buyer_percent: 50,
      },
    });

    const { result } = renderHook(() => useDisputes());

    let refreshed:
      | Awaited<ReturnType<typeof result.current.refreshDispute>>
      | undefined;
    await act(async () => {
      refreshed = await result.current.refreshDispute('escrow-1');
    });

    expect(refreshed?.status).toBe('RESOLVED');
    expect(refreshed?.winner).toBe('SPLIT');
  });
});
