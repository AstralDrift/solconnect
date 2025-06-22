/**
 * Circuit breaker implementation to prevent repeated failures from cascading
 * Implements the circuit breaker pattern for resilient error handling
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringWindowMs: number;
  successThreshold?: number;
}

export interface CircuitBreakerStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  state: CircuitState;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private requestCount = 0;
  private monitoringWindowStart = Date.now();

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      successThreshold: 2,
      ...config
    };
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.shouldRejectRequest()) {
      throw new Error(`Circuit breaker is OPEN. Last failure: ${this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : 'unknown'}`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.updateState();
    return {
      totalRequests: this.requestCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.monitoringWindowStart = Date.now();
  }

  /**
   * Check if the request should be rejected based on current state
   */
  private shouldRejectRequest(): boolean {
    this.updateState();
    
    if (this.state === 'open') {
      return true;
    }
    
    if (this.state === 'half-open') {
      // Allow limited requests in half-open state
      return this.successCount >= this.config.successThreshold;
    }
    
    return false;
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.requestCount++;
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'half-open') {
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
      }
    }

    this.resetMonitoringWindowIfNeeded();
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.requestCount++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }

    this.resetMonitoringWindowIfNeeded();
  }

  /**
   * Update circuit state based on time and conditions
   */
  private updateState(): void {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure >= this.config.recoveryTimeoutMs) {
        this.state = 'half-open';
        this.successCount = 0;
      }
    }
  }

  /**
   * Reset monitoring window if it has expired
   */
  private resetMonitoringWindowIfNeeded(): void {
    const timeSinceWindowStart = Date.now() - this.monitoringWindowStart;
    if (timeSinceWindowStart >= this.config.monitoringWindowMs) {
      this.monitoringWindowStart = Date.now();
      this.requestCount = 0;
      if (this.state === 'closed') {
        this.failureCount = 0;
        this.successCount = 0;
      }
    }
  }

  /**
   * Create a circuit breaker with network operation defaults
   */
  static forNetworkOperations(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeoutMs: 60000, // 1 minute
      monitoringWindowMs: 10000, // 10 seconds
      successThreshold: 3
    });
  }

  /**
   * Create a circuit breaker with auth operation defaults
   */
  static forAuthOperations(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeoutMs: 30000, // 30 seconds
      monitoringWindowMs: 60000, // 1 minute
      successThreshold: 2
    });
  }

  /**
   * Create a circuit breaker with critical operation defaults
   */
  static forCriticalOperations(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 10,
      recoveryTimeoutMs: 120000, // 2 minutes
      monitoringWindowMs: 30000, // 30 seconds
      successThreshold: 5
    });
  }
}