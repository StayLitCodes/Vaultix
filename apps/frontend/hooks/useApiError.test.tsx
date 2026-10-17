'use client';

import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/app/contexts/ToastProvider';
import { ApiError } from '@/lib/api-client';
import { useApiError } from './useApiError';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('useApiError', () => {
  it('shows friendly API feedback and retries transient failures from the toast', async () => {
    const request = jest.fn()
      .mockRejectedValueOnce(new ApiError(503, 'Upstream unavailable'))
      .mockResolvedValueOnce({ ok: true });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );
    const { result } = renderHook(() => useApiError(), { wrapper });

    await act(async () => {
      await result.current.wrapAsync(request);
    });

    expect(screen.getByText('A server error occurred. Please try again shortly.')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    act(() => retryButton.click());

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument());
  });

  it('keeps Retry available when the retried request fails again', async () => {
    const request = jest.fn().mockRejectedValue(new ApiError(503, 'Upstream unavailable'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );
    const { result } = renderHook(() => useApiError(), { wrapper });

    await act(async () => {
      await result.current.wrapAsync(request);
    });
    act(() => screen.getByRole('button', { name: 'Retry' }).click());

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1),
    );
  });
});