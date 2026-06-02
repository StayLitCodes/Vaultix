import { renderHook, waitFor } from '@testing-library/react';
import { useEscrow } from './useEscrow';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

describe('useEscrow', () => {
  it('successfully fetches an escrow', async () => {
    const mockEscrow = { id: 'test-123', title: 'Test Escrow' };
    
    server.use(
      http.get('/api/escrows/test-123', () => {
        return HttpResponse.json(mockEscrow);
      })
    );

    const { result } = renderHook(() => useEscrow('test-123'));

    expect(result.current.loading).toBe(true);
    
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    expect(result.current.escrow).toEqual(mockEscrow);
    expect(result.current.error).toBe(null);
  });

  it('handles 404 error correctly', async () => {
    server.use(
      http.get('/api/escrows/not-found', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const { result } = renderHook(() => useEscrow('not-found'));

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    expect(result.current.escrow).toBe(null);
    expect(result.current.error).toBe('Escrow not found');
  });

  it('handles server errors correctly', async () => {
    server.use(
      http.get('/api/escrows/error', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useEscrow('error'));

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });

    expect(result.current.escrow).toBe(null);
    expect(result.current.error).toBe('Failed to load escrow details');
  });
});
