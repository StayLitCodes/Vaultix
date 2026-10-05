import { renderHook, waitFor } from '@testing-library/react';
import { useEvents } from './useEvents';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { EscrowService } from '@/services/escrow';

jest.mock('@/services/escrow', () => ({
  EscrowService: { getEvents: jest.fn() },
}));

const event = { id: 'event-1', eventType: 'COMPLETED', createdAt: '2025-01-01' };

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (EscrowService.getEvents as jest.Mock).mockResolvedValue({
      events: [event],
      hasNextPage: false,
    });
  });

  it('fetches events on mount', async () => {
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    expect(result.current.data?.pages[0].events.length).toBeGreaterThan(0);
    expect(result.current.data?.pages[0].events[0].eventType).toBeDefined();
  });

  it('filters events by type', async () => {
    const { result } = renderHook(() => useEvents({ eventType: 'COMPLETED' }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    const events = result.current.data?.pages[0].events;
    expect(events?.every(e => e.eventType === 'COMPLETED')).toBe(true);
  });
});
