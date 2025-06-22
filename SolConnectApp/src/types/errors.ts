/**
 * Unified error handling system for SolConnect
 * Provides consistent error types and handling patterns across all layers
 */

export enum ErrorCategory {
  NETWORK = 'network',
  CRYPTO = 'crypto',
  VALIDATION = 'validation',
  SYSTEM = 'system',
  AUTH = 'auth',
  RELAY = 'relay'
}

export enum ErrorCode {
  // Network errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  RELAY_DISCONNECTED = 'RELAY_DISCONNECTED',
  MESSAGE_DELIVERY_FAILED = 'MESSAGE_DELIVERY_FAILED',
  
  // Crypto errors
  CRYPTO_ERROR = 'CRYPTO_ERROR',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_KEY = 'INVALID_KEY',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  SESSION_CREATION_FAILED = 'SESSION_CREATION_FAILED',
  
  // Validation errors
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  INVALID_WALLET_ADDRESS = 'INVALID_WALLET_ADDRESS',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  
  // Auth errors
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  WALLET_CONNECTION_FAILED = 'WALLET_CONNECTION_FAILED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // System errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  SDK_NOT_INITIALIZED = 'SDK_NOT_INITIALIZED',
  SDK_INITIALIZATION_FAILED = 'SDK_INITIALIZATION_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}

export interface AppError {
  category: ErrorCategory;
  code: ErrorCode;
  message: string;
  userMessage: string;
  recoverable: boolean;
  timestamp: number;
  context?: Record<string, any>;
  originalError?: Error;
}

export class SolConnectError extends Error implements AppError {
  constructor(
    public category: ErrorCategory,
    public code: ErrorCode,
    public message: string,
    public userMessage: string,
    public recoverable: boolean = true,
    public context?: Record<string, any>,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SolConnectError';
    this.timestamp = Date.now();
  }

  /**
   * Get the full error chain starting from this error
   */
  getErrorChain(): SolConnectError[] {
    const chain: SolConnectError[] = [this];
    let current = this.originalError;
    
    while (current && current instanceof SolConnectError) {
      chain.push(current);
      current = current.originalError;
    }
    
    return chain;
  }

  /**
   * Get recovery strategy based on error type and context
   */
  getRecoveryStrategy(): 'retry' | 'manual' | 'none' {
    if (!this.recoverable) return 'none';
    
    switch (this.category) {
      case ErrorCategory.NETWORK:
        return 'retry';
      case ErrorCategory.AUTH:
        return this.code === ErrorCode.WALLET_NOT_CONNECTED ? 'manual' : 'retry';
      case ErrorCategory.VALIDATION:
        return 'manual';
      default:
        return 'none';
    }
  }

  /**
   * Determine if this error should be retried
   */
  shouldRetry(retryCount: number = 0, maxRetries: number = 3): boolean {
    if (!this.recoverable || retryCount >= maxRetries) return false;
    
    const strategy = this.getRecoveryStrategy();
    return strategy === 'retry';
  }

  /**
   * Get appropriate retry delay based on attempt count
   */
  getRetryDelayMs(attempt: number = 0): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    switch (this.category) {
      case ErrorCategory.NETWORK:
        // Exponential backoff: 1s, 2s, 4s, 8s, etc.
        return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      case ErrorCategory.AUTH:
        // Fixed delay for auth errors
        return 2000;
      default:
        return baseDelay;
    }
  }

  static network(code: ErrorCode, message: string, userMessage: string, context?: Record<string, any>): SolConnectError {
    return new SolConnectError(ErrorCategory.NETWORK, code, message, userMessage, true, context);
  }

  static crypto(code: ErrorCode, message: string, userMessage: string, context?: Record<string, any>): SolConnectError {
    return new SolConnectError(ErrorCategory.CRYPTO, code, message, userMessage, false, context);
  }

  static validation(code: ErrorCode, message: string, userMessage: string, context?: Record<string, any>): SolConnectError {
    return new SolConnectError(ErrorCategory.VALIDATION, code, message, userMessage, true, context);
  }

  static auth(code: ErrorCode, message: string, userMessage: string, context?: Record<string, any>): SolConnectError {
    return new SolConnectError(ErrorCategory.AUTH, code, message, userMessage, true, context);
  }

  static system(code: ErrorCode, message: string, userMessage: string, context?: Record<string, any>): SolConnectError {
    return new SolConnectError(ErrorCategory.SYSTEM, code, message, userMessage, false, context);
  }

  static security(code: ErrorCode, message: string, userMessage: string, context?: Record<string, any>): SolConnectError {
    return new SolConnectError(ErrorCategory.CRYPTO, code, message, userMessage, false, context);
  }

  toJSON(): AppError {
    return {
      category: this.category,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context,
      originalError: this.originalError
    };
  }
}

/**
 * Result type for consistent API responses
 */
export interface Result<T, E = SolConnectError> {
  success: boolean;
  data?: T;
  error?: E;
}

export const createResult = {
  success: <T>(data: T): Result<T> => ({
    success: true,
    data
  }),
  
  error: <T>(error: SolConnectError): Result<T> => ({
    success: false,
    error
  })
};

/**
 * Error factory functions for common error scenarios
 */
export const ErrorFactory = {
  connectionFailed: (details?: string): SolConnectError =>
    SolConnectError.network(
      ErrorCode.CONNECTION_FAILED,
      `Connection failed: ${details || 'Unknown reason'}`,
      'Unable to connect to the relay server. Please check your internet connection.',
      { details }
    ),

  encryptionFailed: (details?: string): SolConnectError =>
    SolConnectError.crypto(
      ErrorCode.ENCRYPTION_FAILED,
      `Encryption failed: ${details || 'Unknown reason'}`,
      'Failed to encrypt message. Please try again.',
      { details }
    ),

  invalidWalletAddress: (address: string): SolConnectError =>
    SolConnectError.validation(
      ErrorCode.INVALID_WALLET_ADDRESS,
      `Invalid wallet address: ${address}`,
      'Please enter a valid Solana wallet address.',
      { address }
    ),

  walletNotConnected: (): SolConnectError =>
    SolConnectError.auth(
      ErrorCode.WALLET_NOT_CONNECTED,
      'Wallet not connected',
      'Please connect your wallet to continue.'
    ),

  messageTooLarge: (size: number, maxSize: number): SolConnectError =>
    SolConnectError.validation(
      ErrorCode.MESSAGE_TOO_LARGE,
      `Message size ${size} exceeds maximum ${maxSize}`,
      `Message is too large. Maximum size is ${Math.floor(maxSize / 1024)}KB.`,
      { size, maxSize }
    ),

  // Enhanced error factory methods for specific scenarios
  sdkNotInitialized: (operation: string, context?: Record<string, any>): SolConnectError => {
    const enhancedContext = {
      operation,
      timestamp: Date.now(),
      ...context
    };
    
    return SolConnectError.system(
      ErrorCode.SDK_NOT_INITIALIZED,
      `SDK not initialized for operation: ${operation}`,
      'Please initialize the SDK before performing this operation.',
      enhancedContext
    );
  },

  walletConnectionFailed: (reason: string, originalError?: Error, context?: Record<string, any>): SolConnectError => {
    const enhancedContext = {
      reason,
      timestamp: Date.now(),
      ...context
    };

    return new SolConnectError(
      ErrorCategory.AUTH,
      ErrorCode.WALLET_CONNECTION_FAILED,
      `Wallet connection failed: ${reason}`,
      'Failed to connect to your wallet. Please check that your wallet is available and try again.',
      true,
      enhancedContext,
      originalError
    );
  },

  sessionCreationFailed: (originalError: Error, context?: Record<string, any>): SolConnectError => {
    const enhancedContext = {
      timestamp: Date.now(),
      originalErrorMessage: originalError.message,
      ...context
    };

    return new SolConnectError(
      ErrorCategory.CRYPTO,
      ErrorCode.SESSION_CREATION_FAILED,
      `Session creation failed: ${originalError.message}`,
      'Unable to create secure chat session. Please try again.',
      false, // Crypto errors are typically not recoverable
      enhancedContext,
      originalError
    );
  },

  messageDeliveryFailed: (messageId: string, originalError?: Error, context?: Record<string, any>): SolConnectError => {
    const enhancedContext = {
      messageId,
      timestamp: Date.now(),
      originalErrorMessage: originalError?.message,
      ...context
    };

    return new SolConnectError(
      ErrorCategory.NETWORK,
      ErrorCode.MESSAGE_DELIVERY_FAILED,
      `Message delivery failed for message ${messageId}: ${originalError?.message || 'Unknown error'}`,
      'Failed to deliver your message. It will be retried automatically.',
      true, // Network errors are recoverable
      enhancedContext,
      originalError
    );
  },

  networkTimeout: (operation: string, timeoutMs: number, context?: Record<string, any>): SolConnectError => {
    const enhancedContext = {
      operation,
      timeoutMs,
      timestamp: Date.now(),
      ...context
    };

    return SolConnectError.network(
      ErrorCode.NETWORK_TIMEOUT,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      `The operation timed out. Please check your internet connection and try again.`,
      enhancedContext
    );
  },

  sdkInitializationFailed: (originalError: Error, context?: Record<string, any>): SolConnectError => {
    const enhancedContext = {
      timestamp: Date.now(),
      originalErrorMessage: originalError.message,
      ...context
    };

    return new SolConnectError(
      ErrorCategory.SYSTEM,
      ErrorCode.SDK_INITIALIZATION_FAILED,
      `SDK initialization failed: ${originalError.message}`,
      'Failed to initialize SolConnect. Please check your configuration and try again.',
      true,
      enhancedContext,
      originalError
    );
  }
};