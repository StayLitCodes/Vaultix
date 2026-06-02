import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TransactionTracker from './TransactionTracker';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';

describe('TransactionTracker', () => {
  it('shows pending then confirmed when horizon returns 404 then success', async () => {
    let call = 0;
    
    server.use(
      http.get('https://horizon-testnet.stellar.org/transactions/SOME_HASH', () => {
        call += 1;
        if (call === 1) {
          return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({ successful: true });
      })
    );

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={50} />);

    // initial check -> 404 => pending
    await waitFor(() => expect(screen.getByText(/Current:/)).toHaveTextContent('pending'), { timeout: 1000 });

    // With MSW, we don't necessarily need fake timers for this test since we're using real async wait for status change
    // But pollInterval is only 50ms, so it should be fast.
    
    await waitFor(() => expect(screen.getByText(/Current:/)).toHaveTextContent('confirmed'), { timeout: 2000 });
  });

  it('shows failed when horizon returns error', async () => {
    server.use(
      http.get('https://horizon-testnet.stellar.org/transactions/BAD_HASH', () => {
        return new HttpResponse('server error', { status: 500 });
      })
    );

    render(<TransactionTracker txHash="BAD_HASH" pollInterval={50} />);

    await waitFor(() => expect(screen.getByText(/Current:/)).toHaveTextContent('failed'), { timeout: 1000 });
    expect(screen.getByText(/server error/)).toBeInTheDocument();
  });
});
