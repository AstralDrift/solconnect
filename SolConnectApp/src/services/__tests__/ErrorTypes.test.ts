/**
 * Tests for enhanced error types and utilities
 * Validates error handling infrastructure
 */

import { 
  ErrorCode, 
  ErrorCategory, 
  SolConnectError, 
  ErrorFactory 
} from '../../types/errors';
import { RetryUtility } from '../utils/RetryUtility';
import { CircuitBreaker } from '../utils/CircuitBreaker';

describe('Error Types and Utilities', () => {
  describe('ErrorFactory Methods', () => {
    test('creates SDK not initialized error with context', () => {
      const error = ErrorFactory.sdkNotInitialized('startSession', {
        operation: 'startSession',
        currentState: 'uninitialized'
      });

      expect(error).toBeInstanceOf(SolConnectError);
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.code).toBe(ErrorCode.SDK_NOT_INITIALIZED);
      expect(error.message).toContain('startSession');
      expect(error.userMessage).toContain('initialize');
      expect(error.recoverable).toBe(true);
      expect(error.context?.operation).toBe('startSession');
      expect(error.context?.currentState).toBe('uninitialized');
    });

    test('creates wallet connection error with original error', () => {
      const originalError = new Error('Wallet extension not found');
      const error = ErrorFactory.walletConnectionFailed(
        'Extension not available',
        originalError,
        { walletType: 'phantom' }
      );

      expect(error).toBeInstanceOf(SolConnectError);
      expect(error.category).toBe(ErrorCategory.AUTH);
      expect(error.code).toBe(ErrorCode.WALLET_CONNECTION_FAILED);
      expect(error.originalError).toBe(originalError);
      expect(error.context?.walletType).toBe('phantom');
      expect(error.recoverable).toBe(true);
    });

    test('creates session creation error with context', () => {
      const originalError = new Error('Key derivation failed');
      const error = ErrorFactory.sessionCreationFailed(originalError, {
        sessionId: 'test-session-123',
        peerWallet: 'peer-wallet-address',
        currentState: 'connecting'
      });

      expect(error).toBeInstanceOf(SolConnectError);
      expect(error.category).toBe(ErrorCategory.CRYPTO);
      expect(error.code).toBe(ErrorCode.SESSION_CREATION_FAILED);
      expect(error.originalError).toBe(originalError);
      expect(error.context?.sessionId).toBe('test-session-123');
      expect(error.context?.peerWallet).toBe('peer-wallet-address');
      expect(error.recoverable).toBe(false);
    });

    test('creates message delivery error with retry info', () => {
      const originalError = new Error('Network unreachable');
      const error = ErrorFactory.messageDeliveryFailed(
        'msg-123',
        originalError,
        { 
          retryCount: 3,
          maxRetries: 5,
          lastAttemptTime: Date.now()
        }
      );

      expect(error).toBeInstanceOf(SolConnectError);
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.code).toBe(ErrorCode.MESSAGE_DELIVERY_FAILED);
      expect(error.originalError).toBe(originalError);
      expect(error.context?.retryCount).toBe(3);
      expect(error.recoverable).toBe(true);
    });

    test('creates network timeout error', () => {
      const error = ErrorFactory.networkTimeout('connectWallet', 5000, {
        operation: 'connectWallet',
        startTime: Date.now() - 5000
      });

      expect(error).toBeInstanceOf(SolConnectError);
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(error.message).toContain('connectWallet');
      expect(error.message).toContain('5000');
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Error Chaining', () => {
    test('preserves error context through multiple layers', () => {
      const originalError = new Error('Low-level network error');
      const networkError = ErrorFactory.messageDeliveryFailed('msg-123', originalError, {
        level: 'transport'
      });
      
      const sdkError = ErrorFactory.sessionCreationFailed(networkError, {
        level: 'sdk',
        sessionId: 'session-456'
      });

      expect(sdkError.originalError).toBe(networkError);
      expect(sdkError.context?.level).toBe('sdk');
      expect(sdkError.context?.sessionId).toBe('session-456');
      
      const chainedError = sdkError.originalError as SolConnectError;
      expect(chainedError.originalError).toBe(originalError);
      expect(chainedError.context?.level).toBe('transport');
    });

    test('provides error chain analysis', () => {
      const error = new SolConnectError(
        ErrorCategory.NETWORK,
        ErrorCode.CONNECTION_FAILED,
        'Connection failed',
        'Unable to connect',
        true
      );

      expect(typeof error.getErrorChain).toBe('function');
      const chain = error.getErrorChain();
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBe(1);
      expect(chain[0]).toBe(error);
    });

    test('handles nested error chains', () => {
      const baseError = new Error('Base error');
      const level1Error = new SolConnectError(
        ErrorCategory.NETWORK,
        ErrorCode.CONNECTION_FAILED,
        'Level 1 error',
        'Connection failed',
        true,
        { level: 1 },
        baseError
      );
      const level2Error = new SolConnectError(
        ErrorCategory.SYSTEM,
        ErrorCode.UNKNOWN_ERROR,
        'Level 2 error',
        'System error',
        false,
        { level: 2 },
        level1Error
      );

      const chain = level2Error.getErrorChain();
      expect(chain.length).toBe(2);
      expect(chain[0]).toBe(level2Error);
      expect(chain[1]).toBe(level1Error);
    });
  });

  describe('Recovery Strategies', () => {
    test('determines recovery strategy by error type', () => {
      const networkError = SolConnectError.network(
        ErrorCode.TIMEOUT,
        'Network timeout',
        'Connection timed out'
      );
      expect(networkError.getRecoveryStrategy()).toBe('retry');
      expect(networkError.shouldRetry(0)).toBe(true);

      const validationError = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid format',
        'Please check your input'
      );
      expect(validationError.getRecoveryStrategy()).toBe('manual');
      expect(validationError.shouldRetry(0)).toBe(false);

      const cryptoError = SolConnectError.crypto(
        ErrorCode.ENCRYPTION_FAILED,
        'Encryption failed',
        'Unable to encrypt message'
      );
      expect(cryptoError.getRecoveryStrategy()).toBe('none');
      expect(cryptoError.shouldRetry(0)).toBe(false);
    });

    test('calculates retry delays with exponential backoff', () => {
      const error = SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        'Connection failed',
        'Unable to connect'
      );

      const delay0 = error.getRetryDelayMs(0);
      const delay1 = error.getRetryDelayMs(1);
      const delay2 = error.getRetryDelayMs(2);

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);

      const delayMax = error.getRetryDelayMs(10);
      expect(delayMax).toBeLessThanOrEqual(30000);
    });
  });

  describe('Utility Classes', () => {
    test('creates retry utilities', () => {
      const retryUtility = new RetryUtility({
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2
      });

      expect(retryUtility).toBeDefined();
      expect(typeof retryUtility.execute).toBe('function');
    });

    test('creates circuit breakers', () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
        monitoringWindowMs: 10000
      });

      expect(circuitBreaker).toBeDefined();
      expect(typeof circuitBreaker.execute).toBe('function');
      expect(typeof circuitBreaker.getState).toBe('function');
    });

    test('provides specialized utilities', () => {
      const networkRetry = RetryUtility.forNetworkOperations();
      const authRetry = RetryUtility.forAuthOperations();
      const criticalRetry = RetryUtility.forCriticalOperations();

      expect(networkRetry).toBeInstanceOf(RetryUtility);
      expect(authRetry).toBeInstanceOf(RetryUtility);
      expect(criticalRetry).toBeInstanceOf(RetryUtility);

      const networkBreaker = CircuitBreaker.forNetworkOperations();
      const authBreaker = CircuitBreaker.forAuthOperations();
      const criticalBreaker = CircuitBreaker.forCriticalOperations();

      expect(networkBreaker).toBeInstanceOf(CircuitBreaker);
      expect(authBreaker).toBeInstanceOf(CircuitBreaker);
      expect(criticalBreaker).toBeInstanceOf(CircuitBreaker);
    });
  });
}); 