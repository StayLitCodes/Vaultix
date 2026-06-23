import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TransactionTracker from './TransactionTracker';

describe('TransactionTracker', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows pending when horizon has not indexed the transaction yet', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    } as Response);

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={1000} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('pending')
    );
  });

  it('shows confirmed when horizon returns a successful transaction', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ successful: true }),
    } as Response);

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={1000} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );
  });

  it('can move from pending to confirmed as polling catches up', async () => {
    let call = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      call += 1;
      return {
        ok: call > 1,
        status: call === 1 ? 404 : 200,
        text: async () => '',
        json: async () => ({ successful: true }),
      } as Response;
    });

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={10} />);
    
    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('confirmed')
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('shows failed when horizon returns error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    } as Response);

    render(<TransactionTracker txHash="BAD_HASH" pollInterval={50} />);

    await waitFor(() =>
      expect(screen.getByTestId('transaction-status')).toHaveTextContent('failed')
    );
    expect(screen.getByText(/server error/)).toBeInTheDocument();
  });
});
