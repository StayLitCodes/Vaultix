import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_POLL_INTERVAL_MS,
  StellarNetwork,
  TRANSACTION_STATUS_LABELS,
  TransactionStatus,
  explorerTransactionUrl,
  fetchTransactionOutcome,
  isTerminalStatus,
  nextPollDelay,
  progressStatus,
} from '@/lib/transaction-status'

export type { TransactionStatus } from '@/lib/transaction-status'

type Props = {
  txHash: string
  network?: StellarNetwork
  pollInterval?: number
  onStatusChange?: (status: TransactionStatus) => void
}

export default function TransactionTracker({
  txHash,
  network = 'testnet',
  pollInterval = DEFAULT_POLL_INTERVAL_MS,
  onStatusChange,
}: Props) {
  const [status, setStatus] = useState<TransactionStatus>('submitted')
  const [error, setError] = useState<string | null>(null)
  const [transportFailures, setTransportFailures] = useState(0)
  const [retryToken, setRetryToken] = useState(0)

  // Held in a ref so a parent that passes an inline arrow does not restart
  // polling on every render.
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    if (!txHash) return

    // Reset for the transaction actually being tracked: a settled result from a
    // previous hash must not be shown for a new one.
    let current: TransactionStatus = 'submitted'
    setStatus('submitted')
    setError(null)
    setTransportFailures(0)

    const controller = new AbortController()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let failures = 0

    const commit = (next: TransactionStatus) => {
      if (next === current) return
      current = next
      setStatus(next)
      onStatusChangeRef.current?.(next)
    }

    const poll = async () => {
      const outcome = await fetchTransactionOutcome({
        txHash,
        network,
        signal: controller.signal,
      })
      if (cancelled) return
      // An aborted request is this effect tearing down, not a network fault.
      if (outcome.kind === 'unknown' && outcome.cancelled) return

      if (outcome.kind === 'unknown') {
        failures += 1
        setTransportFailures(failures)
        setError(outcome.detail)
      } else {
        failures = 0
        setTransportFailures(0)
        setError(outcome.kind === 'failed' ? outcome.detail : null)
      }

      commit(progressStatus(current, outcome))

      // A settled transaction is never polled again.
      if (isTerminalStatus(current)) return

      timer = setTimeout(poll, nextPollDelay(failures, pollInterval))
    }

    void poll()

    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [txHash, network, pollInterval, retryToken])

  const retry = useCallback(() => {
    setError(null)
    setTransportFailures(0)
    setRetryToken((token) => token + 1)
  }, [])

  const settled = isTerminalStatus(status)
  const explorerLink = explorerTransactionUrl(network, txHash)

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8, maxWidth: 480 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Transaction status</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <Step
          label="Submitted"
          active={status === 'submitted' || status === 'pending' || status === 'confirmed'}
        />
        <Arrow />
        <Step label="Pending" active={status === 'pending' || status === 'confirmed'} />
        <Arrow />
        <Step
          label={status === 'failed' ? 'Failed' : 'Confirmed'}
          active={status === 'confirmed' || status === 'failed'}
          failed={status === 'failed'}
        />
      </div>

      <div
        data-testid="transaction-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ marginBottom: 8 }}
      >
        <strong>Current:</strong> {status}
        <span className="sr-only"> — {TRANSACTION_STATUS_LABELS[status]}</span>
      </div>

      {status === 'unknown' && error ? (
        <div
          data-testid="transaction-transport-warning"
          role="status"
          aria-live="polite"
          style={{ color: '#b7791f', marginBottom: 8 }}
        >
          <div>Could not reach the Stellar network, so the transaction&apos;s status is unknown.</div>
          <div style={{ fontSize: 12 }}>{error}</div>
          <div style={{ fontSize: 12 }}>
            This is a connectivity problem, not a failed transaction — it is still being tracked.
            {transportFailures > 1 ? ` (${transportFailures} attempts so far)` : ''}
          </div>
          <button
            type="button"
            data-testid="transaction-retry"
            onClick={retry}
            style={{
              marginTop: 4,
              padding: '4px 10px',
              border: '1px solid #b7791f',
              borderRadius: 6,
              background: 'transparent',
              color: '#b7791f',
              cursor: 'pointer',
            }}
          >
            Retry now
          </button>
        </div>
      ) : null}

      {status === 'failed' && error ? (
        <div data-testid="transaction-failure" role="alert" style={{ color: '#e74c3c', marginBottom: 8 }}>
          {error}
        </div>
      ) : null}

      {!settled ? (
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            data-testid="transaction-resume"
            onClick={retry}
            style={{
              padding: '4px 10px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              background: 'transparent',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Check again
          </button>
        </div>
      ) : null}

      <div>
        <a href={explorerLink} target="_blank" rel="noreferrer">
          View on Stellar explorer
        </a>
      </div>
    </div>
  )
}

function Step({ label, active, failed }: { label: string; active?: boolean; failed?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: failed ? '#e74c3c' : active ? '#2ecc71' : '#bdc3c7',
        }}
      />
      <div style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Arrow() {
  return <div style={{ width: 16, textAlign: 'center', color: '#888' }}>→</div>
}
