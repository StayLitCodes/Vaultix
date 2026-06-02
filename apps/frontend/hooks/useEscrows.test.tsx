import { renderHook, waitFor } from '@testing-library/react';
import { useEscrows } from './useEscrows';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useEscrows', () => {
  it('fetches escrows initially', async () => {
    const { result } = renderHook(() => useEscrows(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    expect(result.current.data?.pages[0].escrows.length).toBeGreaterThan(0);
    expect(result.current.data?.pages[0].escrows[0].title).toBe('Website Development Project');
  });

  it('filters escrows by status', async () => {
    const { result } = renderHook(() => useEscrows({ status: 'completed' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    const escrows = result.current.data?.pages[0].escrows;
    expect(escrows?.every(e => e.status === 'completed')).toBe(true);
  });
});
