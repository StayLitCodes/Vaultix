import { renderHook, act } from '@testing-library/react-native';
import { useDashboardCache } from '../hooks/useDashboardCache';
import * as dashboardCache from '../services/cache/dashboardCache';
import { isOnline } from '../utils/network';

jest.mock('../utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../services/cache/dashboardCache', () => ({
  cacheDashboardData: jest.fn(() => Promise.resolve()),
  getCachedDashboardData: jest.fn(() => Promise.resolve(null)),
}));

describe('useDashboardCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isOnline as jest.Mock).mockResolvedValue(true);
    (dashboardCache.getCachedDashboardData as jest.Mock).mockResolvedValue(null);
  });

  it('fetches and caches fresh data when online', async () => {
    const freshData = { items: [1, 2, 3] };
    const fetcher = jest.fn().mockResolvedValue(freshData);

    const { result } = renderHook(() => useDashboardCache(fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(dashboardCache.cacheDashboardData).toHaveBeenCalledWith(freshData);
    expect(result.current.data).toEqual(freshData);
    expect(result.current.loading).toBe(false);
    expect(result.current.offline).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('falls back to cached data when fetcher rejects', async () => {
    const cachedPayload = {
      updatedAt: Date.now() - 1000,
      data: { items: ['cached'] },
    };
    (dashboardCache.getCachedDashboardData as jest.Mock).mockResolvedValue(cachedPayload);

    const fetchError = new Error('Network request failed');
    const fetcher = jest.fn().mockRejectedValue(fetchError);

    const { result } = renderHook(() => useDashboardCache(fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(fetchError);
    expect(result.current.offline).toBe(true);
    expect(result.current.data).toEqual(cachedPayload.data);
  });

  it('falls back to cached data when fetcher rejects even without cached data', async () => {
    (dashboardCache.getCachedDashboardData as jest.Mock).mockResolvedValue(null);

    const fetchError = new Error('500 Internal Server Error');
    const fetcher = jest.fn().mockRejectedValue(fetchError);

    const { result } = renderHook(() => useDashboardCache(fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(fetchError);
    expect(result.current.data).toBeNull();
  });

  it('uses cached data when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);

    const cachedPayload = {
      updatedAt: Date.now() - 1000,
      data: { items: ['offline-cached'] },
    };
    (dashboardCache.getCachedDashboardData as jest.Mock).mockResolvedValue(cachedPayload);

    const fetcher = jest.fn();

    const { result } = renderHook(() => useDashboardCache(fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.offline).toBe(true);
    expect(result.current.data).toEqual(cachedPayload.data);
    expect(result.current.loading).toBe(false);
  });

  it('never leaves loading true when fetcher rejects', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useDashboardCache(fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
  });

  it('ignores a superseded load when refresh() is called before it resolves', async () => {
    let resolveFirst!: (v: unknown) => void;
    const slowFirst = new Promise((resolve) => { resolveFirst = resolve; });
    const firstData = { items: ['first'] };
    const secondData = { items: ['second'] };

    const fetcher = jest
      .fn()
      .mockReturnValueOnce(slowFirst)
      .mockResolvedValueOnce(secondData);

    const { result } = renderHook(() => useDashboardCache(fetcher));

    // Let the initial load reach the (slow) fetcher.
    await act(async () => {
      await Promise.resolve();
    });

    // Second, fast call supersedes the first.
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toEqual(secondData);

    // First call resolves late and must not overwrite the second.
    await act(async () => {
      resolveFirst(firstData);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(secondData);
    expect(result.current.loading).toBe(false);
    expect(dashboardCache.cacheDashboardData).not.toHaveBeenCalledWith(firstData);
  });

  it('does not update state after unmount mid-fetch', async () => {
    let resolveFetch!: (v: unknown) => void;
    const pending = new Promise((resolve) => { resolveFetch = resolve; });
    const fetcher = jest.fn(() => pending);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useDashboardCache(fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    unmount();

    await act(async () => {
      resolveFetch({ items: [] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dashboardCache.cacheDashboardData).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
