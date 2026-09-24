import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useEscrow } from './useEscrow';
import { useNotifications } from './useNotifications';
import { WebSocketProvider } from '@/app/contexts/WebSocketContext';

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

const mockFetch = (response: Partial<Response>) => {
  global.fetch = jest.fn().mockResolvedValue(response as Response);
};

describe('useEscrow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shares one socket instance between escrow and notification hooks', async () => {
    const { io } = jest.requireMock('socket.io-client') as { io: jest.Mock };
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(WebSocketProvider, null, children);

    mockFetch({ ok: true, json: async () => ({ id: 'test-123' }) });
    renderHook(() => {
      useEscrow('test-123');
      useNotifications();
    }, { wrapper });

    await waitFor(() => expect(io).toHaveBeenCalledTimes(1));
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
