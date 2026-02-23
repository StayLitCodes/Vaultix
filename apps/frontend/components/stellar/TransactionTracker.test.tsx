import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import TransactionTracker from './TransactionTracker'

describe('TransactionTracker', () => {
  const OLD_FETCH = global.fetch

  afterEach(() => {
    global.fetch = OLD_FETCH
    jest.useRealTimers()
  })

  test('shows pending then confirmed when horizon returns 404 then success', async () => {
    jest.useFakeTimers()

    let call = 0
    // first call -> 404, second call -> successful
    global.fetch = jest.fn().mockImplementation(() => {
      call += 1
      if (call === 1) {
        return Promise.resolve({ status: 404, ok: false, text: async () => '' })
      }
      return Promise.resolve({ status: 200, ok: true, json: async () => ({ successful: true }) })
    })

    render(<TransactionTracker txHash="SOME_HASH" pollInterval={50} />)

    // initial check -> 404 => pending
    await waitFor(() => expect(screen.getByText(/Current:/)).toHaveTextContent('pending'), { timeout: 500 })

    // advance timers so the next poll runs
    jest.advanceTimersByTime(60)

    await waitFor(() => expect(screen.getByText(/Current:/)).toHaveTextContent('confirmed'), { timeout: 1000 })
  })

  test('shows failed when horizon returns error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 500, ok: false, text: async () => 'server error' })

    render(<TransactionTracker txHash="BAD_HASH" pollInterval={50} />)

    await waitFor(() => expect(screen.getByText(/Current:/)).toHaveTextContent('failed'), { timeout: 1000 })
    expect(screen.getByText(/server error/)).toBeInTheDocument()
  })
})
