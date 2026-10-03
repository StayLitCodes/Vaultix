import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TransactionTracker from './TransactionTracker';

const ok = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Response;

const status = (code: number) =>
  ({
    ok: false,
    status: code,
    json: async () => ({}),
  }) as Response;

const tick = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe('TransactionTracker', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows pending when horizon has not indexed the transaction yet', async () => {
    global.fetch = jest.fn().mockResolvedValue(status(404));

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={1000} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('pending')
    );
  });

  it('shows confirmed when horizon returns a successful transaction', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ successful: true, ledger: 42 }));

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={1000} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );
  });

  it('can move from pending to confirmed as polling catches up', async () => {
    let call = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      call += 1;
      return call === 1 ? status(404) : ok({ successful: true });
    });

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('treats an HTTP error as unknown transport state, not a chain failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(status(500));

    render(<TransactionTracker txHash="BAD_HASH" pollInterval={50} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('unknown')
    );
    expect(screen.queryByTestId('transaction-failure')).not.toBeInTheDocument();
    expect(screen.getByTestId('transaction-transport-warning')).toHaveTextContent(
      /not a failed transaction/
    );
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
  });

  it('never reports a failure for a transient outage and recovers to confirmed', async () => {
    let call = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      call += 1;
      // 503, then a dropped connection, then the ledger answer.
      if (call === 1) return status(503);
      if (call === 2) throw new TypeError('Failed to fetch');
      return ok({ successful: true, ledger: 7 });
    });

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('unknown')
    );
    expect(screen.queryByTestId('transaction-failure')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );
    expect(screen.queryByTestId('transaction-failure')).not.toBeInTheDocument();
  });

  it('reports failed only for a transaction a ledger marked unsuccessful', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ successful: false }));

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('failed')
    );
    expect(screen.getByTestId('transaction-failure')).toBeInTheDocument();
  });

  it('stops polling once the transaction is terminal', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ successful: true }));

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );

    await tick(80);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('backs off instead of hammering a node that keeps failing', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue(status(503));

    try {
      render(<TransactionTracker txHash="SOME_HASH" pollInterval={100} />);

      // first poll runs immediately
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // backoff 1 -> 200ms: the 100ms base interval must not fire on its own
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(120);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('resets the status when the transaction hash changes', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ successful: true }));

    const { rerender } = render(<TransactionTracker txHash="FIRST_HASH" pollInterval={10} />);
    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );

    // The next transaction is not yet indexed: the previous "confirmed" must not
    // carry over.
    global.fetch = jest.fn().mockResolvedValue(status(404));
    rerender(<TransactionTracker txHash="SECOND_HASH" pollInterval={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('pending')
    );
  });

  it('aborts the in-flight request and stops polling on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          capturedSignal = init?.signal ?? undefined;
          capturedSignal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })
    );

    const { unmount } = render(<TransactionTracker txHash="SOME_HASH" pollInterval={10} />);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
    await tick(50);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('lets the user retry immediately after an outage', async () => {
    let call = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      call += 1;
      return call === 1 ? status(503) : ok({ successful: true, ledger: 9 });
    });

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={60_000} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('unknown')
    );

    fireEvent.click(screen.getByTestId('transaction-retry'));

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );
  });

  it('links to the explorer for the network the transaction ran on', async () => {
    global.fetch = jest.fn().mockResolvedValue(status(404));

    const { rerender } = render(
      <TransactionTracker txHash="HASH_1" network="testnet" pollInterval={1000} />
    );
    expect(screen.getByRole('link', { name: /Stellar explorer/i })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/testnet/tx/HASH_1'
    );

    rerender(<TransactionTracker txHash="HASH_1" network="public" pollInterval={1000} />);
    expect(screen.getByRole('link', { name: /Stellar explorer/i })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/tx/HASH_1'
    );
  });

  it('announces status changes to assistive technology', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ successful: true }));

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={10} />);

    const region = await screen.findByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(region).toHaveTextContent(/Confirmed/));
  });
});
