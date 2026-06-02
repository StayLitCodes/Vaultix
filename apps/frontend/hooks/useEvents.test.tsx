import { renderHook, waitFor } from '@testing-library/react';
import { useEvents } from './useEvents';
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

describe('useEvents', () => {
  it('fetches events on mount', async () => {
    const { result } = renderHook(() => useEvents(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    expect(result.current.data?.pages[0].events.length).toBeGreaterThan(0);
    expect(result.current.data?.pages[0].events[0].eventType).toBeDefined();
  });

  it('filters events by type', async () => {
    const { result } = renderHook(() => useEvents({ eventType: 'COMPLETED' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    const events = result.current.data?.pages[0].events;
    expect(events?.every(e => e.eventType === 'COMPLETED')).toBe(true);
  });
});
