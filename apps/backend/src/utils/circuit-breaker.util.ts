export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0,
  };

  isOpen(config: CircuitBreakerConfig): boolean {
    if (!this.state.isOpen) return false;
    
    const now = Date.now();
    if (now < this.state.nextAttemptTime) return true;
    
    this.reset();
    return false;
  }

  recordFailure(config: CircuitBreakerConfig): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    
    if (this.state.failureCount >= config.maxFailures) {
      this.state.isOpen = true;
      this.state.nextAttemptTime = Date.now() + config.resetTimeout;
    }
  }

  recordSuccess(): void {
    if (this.state.isOpen) {
      this.reset();
    }
  }

  reset(): void {
    this.state = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    };
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

export interface CircuitBreakerConfig {
  maxFailures: number;
  resetTimeout: number;
}
