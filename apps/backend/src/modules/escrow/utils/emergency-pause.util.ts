/**
 * Emergency pause circuit breaker.
 * Tracks pause state in-memory and exposes helpers to pause, resume,
 * and check whether operations are currently allowed.
 */

let paused = false;
let pausedAt: Date | null = null;
let pausedBy: string | null = null;

export interface PauseState {
  paused: boolean;
  pausedAt: Date | null;
  pausedBy: string | null;
}

/** Activates the circuit breaker, blocking all guarded operations. */
export function activatePause(adminId: string): void {
  paused = true;
  pausedAt = new Date();
  pausedBy = adminId;
}

/** Deactivates the circuit breaker, resuming normal operations. */
export function deactivatePause(): void {
  paused = false;
  pausedAt = null;
  pausedBy = null;
}

/** Returns the current pause state. */
export function getPauseState(): PauseState {
  return { paused, pausedAt, pausedBy };
}

/**
 * Throws an error if the system is currently paused.
 * Use this guard at the start of any sensitive operation.
 */
export function assertNotPaused(): void {
  if (paused) {
    throw new Error(
      `System is paused (since ${pausedAt?.toISOString()}, by ${pausedBy})`,
    );
  }
}
