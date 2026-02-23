import React, { useEffect, useState } from 'react'

type Network = 'testnet' | 'public'

type Props = {
  txHash: string
  network?: Network
  pollInterval?: number
  onStatusChange?: (status: TransactionStatus) => void
}

export type TransactionStatus = 'submitted' | 'pending' | 'confirmed' | 'failed'

const HORIZON = {
  testnet: 'https://horizon-testnet.stellar.org',
  public: 'https://horizon.stellar.org',
}

export default function TransactionTracker({
  txHash,
  network = 'testnet',
  pollInterval = 3000,
  onStatusChange,
}: Props) {
  const [status, setStatus] = useState<TransactionStatus>('submitted')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!txHash) return

    let mounted = true
    let intervalId: any = null

    async function check() {
      try {
        const url = `${HORIZON[network]}/transactions/${txHash}`
        const res = await fetch(url)

        if (!mounted) return

        if (res.status === 404) {
          // transaction not found yet -> pending
          setStatus((s) => (s === 'submitted' ? 'pending' : s))
          onStatusChange?.('pending')
          return
        }

        if (!res.ok) {
          const text = await res.text()
          setError(`Horizon error: ${res.status} ${text}`)
          setStatus('failed')
          onStatusChange?.('failed')
          return
        }

        const body = await res.json()

        // Horizon transaction object includes `successful` boolean
        if (body && typeof body.successful === 'boolean') {
          if (body.successful) {
            setStatus('confirmed')
            onStatusChange?.('confirmed')
          } else {
            setStatus('failed')
            onStatusChange?.('failed')
            setError('Transaction failed on-chain')
          }
        } else {
          // Unexpected, but treat as pending
          setStatus('pending')
          onStatusChange?.('pending')
        }
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message || String(err))
        setStatus('failed')
        onStatusChange?.('failed')
      }
    }

    // initial quick check
    check()
    intervalId = setInterval(check, pollInterval)

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [txHash, network, pollInterval, onStatusChange])

  const explorerBase = network === 'testnet' ? 'https://stellar.expert/explorer/testnet/tx' : 'https://stellar.expert/explorer/public/tx'
  const explorerLink = `${explorerBase}/${txHash}`

  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8, maxWidth: 480 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Transaction status</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <Step label="Submitted" active={status === 'submitted' || status === 'pending' || status === 'confirmed'} />
        <Arrow />
        <Step label="Pending" active={status === 'pending' || status === 'confirmed'} />
        <Arrow />
        <Step label={status === 'failed' ? 'Failed' : 'Confirmed'} active={status === 'confirmed' || status === 'failed'} failed={status === 'failed'} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Current:</strong> {status}
      </div>

      {error ? <div style={{ color: 'red', marginBottom: 8 }}>{error}</div> : null}

      <div>
        <a href={explorerLink} target="_blank" rel="noreferrer">View on Stellar explorer</a>
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
