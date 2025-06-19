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
  RELAY_DISCONNECTED = 'RELAY_DISCONNECTED',
  
  // Crypto errors
  CRYPTO_ERROR = 'CRYPTO_ERROR',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_KEY = 'INVALID_KEY',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  
  // Validation errors
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  INVALID_WALLET_ADDRESS = 'INVALID_WALLET_ADDRESS',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  
  // Auth errors
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // System errors
  STORAGE_ERROR = 'STORAGE_ERROR',
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
    )
};