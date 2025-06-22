/**
 * Retry utility with exponential backoff for handling transient failures
 * Provides configurable retry mechanisms for SDK operations
 */

import { SolConnectError } from '../../types/errors';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter?: boolean;
}

export interface RetryOptions {
  onRetry?: (error: Error, attemptNumber: number) => void;
  shouldRetry?: (error: Error, attemptNumber: number) => boolean;
}

export class RetryUtility {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      jitter: true,
      ...config
    };
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          break;
        }
        
        // Check if we should retry this error
        if (options.shouldRetry && !options.shouldRetry(lastError, attempt)) {
          break;
        }
        
        // Default retry logic for SolConnectError
        if (lastError instanceof SolConnectError && !lastError.shouldRetry(attempt, this.config.maxRetries)) {
          break;
        }
        
        // Call retry callback if provided
        if (options.onRetry) {
          options.onRetry(lastError, attempt);
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Calculate retry delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry utility with common network settings
   */
  static forNetworkOperations(): RetryUtility {
    return new RetryUtility({
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitter: true
    });
  }

  /**
   * Create a retry utility with common auth settings
   */
  static forAuthOperations(): RetryUtility {
    return new RetryUtility({
      maxRetries: 2,
      baseDelayMs: 2000,
      maxDelayMs: 5000,
      backoffMultiplier: 1.5,
      jitter: false
    });
  }

  /**
   * Create a retry utility with aggressive settings for critical operations
   */
  static forCriticalOperations(): RetryUtility {
    return new RetryUtility({
      maxRetries: 5,
      baseDelayMs: 500,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true
    });
  }
}