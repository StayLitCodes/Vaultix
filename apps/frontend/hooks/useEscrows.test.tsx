import { renderHook, waitFor } from '@testing-library/react';
import { useEscrows } from './useEscrows';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { EscrowService } from '@/services/escrow';
import { CanonicalEscrowStatus } from "@/utils/escrowStatus";

jest.mock('@/services/escrow', () => ({
  EscrowService: { getEscrows: jest.fn() },
}));

const escrow = {
  id: 'escrow-1',
  title: 'Website Development Project',
  status: CanonicalEscrowStatus.COMPLETED,
  amount: '100',
  asset: 'XLM',
  creatorAddress: 'buyer',
  counterpartyAddress: 'seller',
  deadline: '2030-01-01',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEscrows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (EscrowService.getEscrows as jest.Mock).mockResolvedValue({
      escrows: [escrow],
      hasNextPage: false,
    });
  });

  it('fetches escrows initially', async () => {
    const { result } = renderHook(() => useEscrows(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    expect(result.current.data?.pages[0].escrows.length).toBeGreaterThan(0);
    expect(result.current.data?.pages[0].escrows[0].title).toBe('Website Development Project');
  });

  it('filters escrows by status', async () => {
    const { result } = renderHook(() => useEscrows({ status: 'completed' }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    const escrows = result.current.data?.pages[0].escrows;
    expect(escrows?.every(e => e.status === CanonicalEscrowStatus.COMPLETED)).toBe(true);
  });
});
