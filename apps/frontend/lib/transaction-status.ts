/**
 * Canonical Stellar transaction status (issue #660).
 *
 * A transaction's finality can only be answered by the chain. Horizon's
 * `GET /transactions/{hash}` is that answer, but it answers in three different
 * ways that used to be conflated:
 *
 *  - `404` — Horizon has not indexed the hash *yet*. The transaction may well be
 *    in a ledger already, or still queued, so this is **pending**, not a failure.
 *  - a transport/HTTP error (`429`, `5xx`, DNS failure, offline, timeout) —
 *    the node could not answer. The on-chain state is **unknown**; treating it
 *    as a failure reports a failed payment for what was only a patchy network.
 *  - `200` with `successful: false` — a ledger closed with the transaction
 *    marked unsuccessful. This is the **only** confirmed chain failure.
 *
 * This module owns that classification plus the polling/backoff arithmetic and
 * the network-specific URLs, so the decision logic is pure and testable without
 * React (the component and the funding hook only render the resulting state).
 */

export type StellarNetwork = 'testnet' | 'public'

/**
 * `submitted` is the pre-flight state; `pending` means the chain has not
 * reported the transaction yet; `unknown` means the network could not be
 * reached; `confirmed` and `failed` are the two terminal, chain-derived states.
 */
export type TransactionStatus =
  | 'submitted'
  | 'pending'
  | 'unknown'
  | 'confirmed'
  | 'failed'

/** Horizon node per network — the canonical status source. */
export const HORIZON_URLS: Record<StellarNetwork, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  public: 'https://horizon.stellar.org',
}

/** Block explorer base per network. */
export const EXPLORER_TRANSACTION_URLS: Record<StellarNetwork, string> = {
  testnet: 'https://stellar.expert/explorer/testnet/tx',
  public: 'https://stellar.expert/explorer/public/tx',
}

export const DEFAULT_POLL_INTERVAL_MS = 3_000

/** Upper bound on the poll interval while the transport keeps failing. */
export const MAX_POLL_INTERVAL_MS = 30_000

/** Human-readable label per status. */
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  submitted: 'Submitted',
  pending: 'Pending',
  unknown: 'Network unavailable',
  confirmed: 'Confirmed',
  failed: 'Failed',
}

/** The canonical status URL for a transaction hash on a given network. */
export function horizonTransactionUrl(
  network: StellarNetwork,
  txHash: string,
): string {
  return `${HORIZON_URLS[network]}/transactions/${encodeURIComponent(txHash)}`
}

/** The explorer URL for a transaction hash on the network it ran on. */
export function explorerTransactionUrl(
  network: StellarNetwork,
  txHash: string,
): string {
  return `${EXPLORER_TRANSACTION_URLS[network]}/${encodeURIComponent(txHash)}`
}

export type TransactionOutcome =
  /** Horizon has not reported the transaction yet. Keep polling. */
  | { kind: 'pending'; detail: string }
  /** Transport could not reach the chain. **Not** a chain failure. */
  | { kind: 'unknown'; detail: string; cancelled?: boolean }
  | { kind: 'confirmed'; ledger: number | null }
  /** The only confirmed failure: a ledger closed with the tx unsuccessful. */
  | { kind: 'failed'; detail: string }

/** The minimal response surface this module needs. */
export interface StatusResponseLike {
  ok: boolean
  status: number
  json?: () => Promise<unknown>
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Classifies a Horizon response. Never throws: an unreadable body is reported
 * as `unknown`, because an unparseable answer is not evidence of chain failure.
 */
export async function resolveTransactionOutcome(
  response: StatusResponseLike,
): Promise<TransactionOutcome> {
  if (response.status === 404) {
    return {
      kind: 'pending',
      detail: 'The network has not reported this transaction yet.',
    }
  }

  if (!response.ok) {
    return {
      kind: 'unknown',
      detail: `The status node returned HTTP ${response.status}.`,
    }
  }

  let body: unknown
  try {
    body = await response.json?.()
  } catch {
    return { kind: 'unknown', detail: 'The status node returned an unreadable response.' }
  }

  const record = readRecord(body)
  if (!record || typeof record.successful !== 'boolean') {
    return { kind: 'unknown', detail: 'The status node returned an unexpected response.' }
  }

  if (record.successful) {
    const ledger = typeof record.ledger === 'number' ? record.ledger : null
    return { kind: 'confirmed', ledger }
  }

  return {
    kind: 'failed',
    detail:
      record.result_xdr || record.resultXdr
        ? 'The transaction failed on-chain.'
        : 'The transaction was included in a ledger but was not successful.',
  }
}

export interface FetchOutcomeOptions {
  txHash: string
  network: StellarNetwork
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

/**
 * Reads the canonical status for a hash. A thrown transport error becomes an
 * `unknown` outcome rather than an exception, so callers cannot accidentally
 * treat "the request failed" as "the transaction failed".
 */
export async function fetchTransactionOutcome(
  options: FetchOutcomeOptions,
): Promise<TransactionOutcome> {
  const doFetch = options.fetchImpl ?? fetch

  try {
    const response = await doFetch(horizonTransactionUrl(options.network, options.txHash), {
      signal: options.signal,
    })
    return await resolveTransactionOutcome(response as StatusResponseLike)
  } catch (error) {
    if (options.signal?.aborted) {
      return { kind: 'unknown', detail: 'Status request cancelled.', cancelled: true }
    }
    return {
      kind: 'unknown',
      detail:
        error instanceof Error
          ? error.message || 'The status node could not be reached.'
          : 'The status node could not be reached.',
    }
  }
}

/** The two states a transaction settles into. */
export function isTerminalStatus(status: TransactionStatus): boolean {
  return status === 'confirmed' || status === 'failed'
}

/** Whether the outcome is worth another poll. */
export function isRetryableOutcome(outcome: TransactionOutcome): boolean {
  return outcome.kind === 'pending' || outcome.kind === 'unknown'
}

/** The status an outcome maps onto. */
export function statusForOutcome(outcome: TransactionOutcome): TransactionStatus {
  switch (outcome.kind) {
    case 'pending':
      return 'pending'
    case 'unknown':
      return 'unknown'
    case 'confirmed':
      return 'confirmed'
    case 'failed':
      return 'failed'
  }
}

/**
 * Advances the status for a new outcome. A settled transaction is sticky: once
 * the chain has confirmed or failed it, a later transport hiccup must not
 * downgrade the displayed result.
 */
export function progressStatus(
  current: TransactionStatus,
  outcome: TransactionOutcome,
): TransactionStatus {
  if (isTerminalStatus(current)) return current
  return statusForOutcome(outcome)
}

/**
 * Next poll delay. Repeated transport failures back off exponentially up to
 * `maxInterval`, so a node that is down is not hammered and the UI does not
 * pretend the transaction is still being actively watched.
 */
export function nextPollDelay(
  consecutiveTransportFailures: number,
  baseInterval: number = DEFAULT_POLL_INTERVAL_MS,
  maxInterval: number = MAX_POLL_INTERVAL_MS,
): number {
  const base = Math.max(1, baseInterval)
  const ceiling = Math.max(base, maxInterval)
  if (consecutiveTransportFailures <= 0) return base

  const exponent = Math.min(consecutiveTransportFailures, 8)
  return Math.min(base * 2 ** exponent, ceiling)
}

export interface ConfirmationOptions {
  txHash: string
  network: StellarNetwork
  /** Give up waiting after this many ms and report `unconfirmed`. */
  timeoutMs?: number
  pollInterval?: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  /** Injectable clock/scheduler, so the sequence is deterministic in tests. */
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export type ConfirmationResult =
  | { kind: 'confirmed'; ledger: number | null }
  | { kind: 'failed'; detail: string }
  /** Still pending or unreachable when the window closed — resumable. */
  | { kind: 'unconfirmed'; detail: string }

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Waits for a submitted transaction to reach a terminal chain state.
 *
 * A transport failure does **not** end the wait: the deadline is what ends it,
 * and the result is then `unconfirmed` (resumable) rather than failed.
 */
export async function awaitConfirmation(
  options: ConfirmationOptions,
): Promise<ConfirmationResult> {
  const timeoutMs = options.timeoutMs ?? 60_000
  const baseInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL_MS
  const now = options.now ?? (() => Date.now())
  const sleep = options.sleep ?? defaultSleep
  const deadline = now() + timeoutMs

  let failures = 0
  let lastDetail = 'The network has not reported this transaction yet.'

  for (;;) {
    if (options.signal?.aborted) {
      return { kind: 'unconfirmed', detail: 'Status polling was cancelled.' }
    }

    const outcome = await fetchTransactionOutcome({
      txHash: options.txHash,
      network: options.network,
      signal: options.signal,
      fetchImpl: options.fetchImpl,
    })

    if (outcome.kind === 'confirmed') return { kind: 'confirmed', ledger: outcome.ledger }
    if (outcome.kind === 'failed') return { kind: 'failed', detail: outcome.detail }
    if (outcome.kind === 'unknown' && outcome.cancelled) {
      return { kind: 'unconfirmed', detail: outcome.detail }
    }

    lastDetail = outcome.detail
    failures = outcome.kind === 'unknown' ? failures + 1 : 0

    const delay = nextPollDelay(failures, baseInterval)
    if (now() + delay > deadline) {
      return { kind: 'unconfirmed', detail: lastDetail }
    }

    await sleep(delay)
  }
}
