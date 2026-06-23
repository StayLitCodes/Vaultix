import { renderHook, waitFor } from '@testing-library/react';
import { useEscrow } from './useEscrow';

const mockFetch = (response: Partial<Response>) => {
  global.fetch = jest.fn().mockResolvedValue(response as Response);
};

describe('useEscrow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('successfully fetches an escrow', async () => {
    const mockEscrow = { id: 'test-123', title: 'Test Escrow' };
    mockFetch({
      ok: true,
      json: async () => mockEscrow,
    });

    const { result } = renderHook(() => useEscrow('test-123'));

    expect(result.current.loading).toBe(true);
    
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    expect(result.current.escrow).toEqual(mockEscrow);
    expect(result.current.error).toBe(null);
  });

  it('handles 404 error correctly', async () => {
    mockFetch({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: '404: Escrow not found' }),
    });

    const { result } = renderHook(() => useEscrow('not-found'));

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    expect(result.current.escrow).toBe(null);
    expect(result.current.error).toBe('Escrow not found');
  });

  it('handles server errors correctly', async () => {
    mockFetch({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'Failed to load escrow details' }),
    });

    const { result } = renderHook(() => useEscrow('error'));

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    expect(result.current.escrow).toBe(null);
    expect(result.current.error).toBe('Failed to load escrow details');
  });
});
