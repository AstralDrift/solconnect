/**
 * Enhanced SolConnect SDK with unified architecture patterns
 * Provides consistent interface between React frontend and Rust backend
 */

import { ChatSession, Message, MessageStatus, MessageStatusUpdate } from '../types';
import { SolConnectError, ErrorCode, Result, createResult, ErrorFactory } from '../types/errors';
import { MessageBus, getMessageBus, initializeMessageBus } from './MessageBus';
import { DeliveryReceipt, MessageHandler, Subscription } from './transport/MessageTransport';
import { Metrics, getErrorTracker, initializeMonitoring } from './monitoring';
import { RetryUtility } from './utils/RetryUtility';
import { CircuitBreaker } from './utils/CircuitBreaker';
import { SyncStats } from './sync/SyncProtocol';

export interface WalletInfo {
  address: string;
  connected: boolean;
  balance?: number;
}

export interface SessionConfig {
  peerWallet: string;
  relayEndpoint?: string;
  enableEncryption?: boolean;
}

export interface SDKConfig {
  relayEndpoint: string;
  solanaRpcUrl?: string;
  networkType?: 'devnet' | 'mainnet' | 'testnet';
  enableLogging?: boolean;
}

/**
 * Main SDK class providing high-level messaging operations
 */
export class SolConnectSDK {
  private messageBus: MessageBus | null = null;
  private currentWallet: WalletInfo | null = null;
  private activeSessions = new Map<string, ChatSession>();
  private config: Required<SDKConfig>;
  private isInitialized = false;
  private retryUtility: RetryUtility;
  private circuitBreaker: CircuitBreaker;

  constructor(config: SDKConfig) {
    this.config = {
      solanaRpcUrl: 'https://api.devnet.solana.com',
      networkType: 'devnet',
      enableLogging: true,
      ...config
    };
    
    // Initialize retry utility and circuit breaker for message operations
    this.retryUtility = RetryUtility.forNetworkOperations();
    this.circuitBreaker = CircuitBreaker.forNetworkOperations();
  }

  /**
   * Initialize the SDK with enhanced error handling
   */
  async initialize(): Promise<Result<void>> {
    if (this.isInitialized) {
      return createResult.success(undefined);
    }

    const initContext = {
      operation: 'initialize',
      configProvided: true,
      relayEndpoint: this.config.relayEndpoint,
      networkType: this.config.networkType,
      timestamp: Date.now()
    };

    try {
      // Initialize monitoring services first
      try {
        await initializeMonitoring();
        Metrics.action('sdk_initialization_started');
      } catch (monitoringError) {
        const error = ErrorFactory.sdkInitializationFailed(
          monitoringError as Error,
          { ...initContext, step: 'monitoring_initialization' }
        );
        getErrorTracker().captureError(error, { context: 'SDK monitoring initialization' });
        return createResult.error(error);
      }

      // Initialize message bus with persistence enabled
      let busResult;
      try {
        busResult = await initializeMessageBus({
          relayEndpoint: this.config.relayEndpoint,
          transportType: 'websocket', // Use WebSocket for now
          enableEncryption: true,
          enablePersistence: true
        });
      } catch (busError) {
        const error = ErrorFactory.sdkInitializationFailed(
          busError as Error,
          { ...initContext, step: 'message_bus_initialization' }
        );
        Metrics.action('sdk_initialization_failed', undefined, { error: error.message });
        getErrorTracker().captureError(error, { context: 'SDK message bus initialization' });
        return createResult.error(error);
      }

      if (!busResult.success) {
        const originalError = busResult.error || new Error('MessageBus initialization failed');
        const error = ErrorFactory.sdkInitializationFailed(
          originalError,
          { ...initContext, step: 'message_bus_initialization', busResult }
        );
        
        Metrics.action('sdk_initialization_failed', undefined, { error: error.message });
        getErrorTracker().captureError(error, { context: 'SDK message bus initialization' });
        return createResult.error(error);
      }

      this.messageBus = busResult.data!;
      this.isInitialized = true;

      this.log('SDK initialized successfully');
      Metrics.action('sdk_initialization_completed');
      return createResult.success(undefined);
    } catch (error) {
      // Catch any unexpected errors with proper context
      const sdkError = ErrorFactory.sdkInitializationFailed(
        error as Error,
        { ...initContext, step: 'unexpected_error' }
      );
      
      Metrics.action('sdk_initialization_failed', undefined, { error: sdkError.message });
      getErrorTracker().captureError(sdkError, { context: 'SDK initialization - unexpected error' });
      return createResult.error(sdkError);
    }
  }

  /**
   * Connect wallet and authenticate user with timeout handling
   */
  async connectWallet(timeoutMs: number = 5000): Promise<Result<WalletInfo>> {
    return await Metrics.time('wallet_connection', async () => {
      const walletContext = {
        operation: 'connectWallet',
        timeoutMs,
        timestamp: Date.now(),
        networkType: this.config.networkType
      };

      try {
        Metrics.action('wallet_connection_started');
        
        // Implement timeout for wallet connection
        const connectionResult = await Promise.race([
          this.performWalletConnection(walletContext),
          this.createTimeoutPromise(timeoutMs, 'connectWallet')
        ]);

        if (connectionResult.isTimeout) {
          const timeoutError = ErrorFactory.networkTimeout('connectWallet', timeoutMs, {
            ...walletContext,
            startTime: walletContext.timestamp
          });
          
          Metrics.action('wallet_connection_failed', undefined, { error: timeoutError.message });
          getErrorTracker().captureError(timeoutError, { context: 'Wallet connection timeout' });
          return createResult.error(timeoutError);
        }

        this.currentWallet = connectionResult;
        this.log('Wallet connected:', this.currentWallet.address);
        Metrics.business('wallet_connected', 1, { walletAddress: this.currentWallet.address });
        
        return createResult.success(this.currentWallet);
      } catch (error) {
        const walletError = ErrorFactory.walletConnectionFailed(
          (error as Error).message || 'Unknown wallet connection error',
          error as Error,
          { ...walletContext, duration: Date.now() - walletContext.timestamp }
        );
        
        Metrics.action('wallet_connection_failed', undefined, { error: walletError.message });
        getErrorTracker().captureError(walletError, { context: 'Wallet connection' });
        return createResult.error(walletError);
      }
    });
  }

  /**
   * Perform the actual wallet connection operation
   */
  private async performWalletConnection(context: Record<string, any>): Promise<WalletInfo> {
    try {
      // For now, simulate wallet connection
      // In production, this would integrate with Solana wallet adapter
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const walletAddress = this.generateTestWalletAddress();
      
      return {
        address: walletAddress,
        connected: true,
        balance: 1.5 // SOL
      };
    } catch (error) {
      throw ErrorFactory.walletConnectionFailed(
        'Wallet adapter connection failed',
        error as Error,
        { ...context, step: 'wallet_adapter_connection' }
      );
    }
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  private createTimeoutPromise(timeoutMs: number, operation: string): Promise<{ isTimeout: boolean }> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject({ isTimeout: true });
      }, timeoutMs);
    });
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<Result<void>> {
    try {
      // Close all active sessions
      for (const sessionId of this.activeSessions.keys()) {
        await this.endSession(sessionId);
      }

      this.currentWallet = null;
      this.log('Wallet disconnected');
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Wallet disconnection failed: ${error}`,
        'Error occurred while disconnecting wallet',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Start a new chat session with a peer with enhanced error handling
   */
  async startSession(config: SessionConfig): Promise<Result<ChatSession>> {
    const sessionContext = {
      operation: 'startSession',
      peerWallet: config.peerWallet,
      currentWallet: this.currentWallet?.address,
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    // Enhanced pre-condition checks
    if (!this.currentWallet?.connected) {
      const error = ErrorFactory.walletNotConnected();
      error.context = { ...error.context, ...sessionContext };
      return createResult.error(error);
    }

    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('startSession', sessionContext);
      return createResult.error(error);
    }

    try {
      // Validate peer wallet address with enhanced context
      if (!this.isValidWalletAddress(config.peerWallet)) {
        const error = ErrorFactory.invalidWalletAddress(config.peerWallet);
        error.context = { ...error.context, ...sessionContext };
        return createResult.error(error);
      }

      // Generate session ID with error handling
      let sessionId: string;
      try {
        sessionId = this.generateSessionId(this.currentWallet.address, config.peerWallet);
      } catch (error) {
        const sessionError = ErrorFactory.sessionCreationFailed(
          error as Error,
          { ...sessionContext, step: 'session_id_generation' }
        );
        getErrorTracker().captureError(sessionError, { context: 'Session ID generation' });
        return createResult.error(sessionError);
      }

      // Create shared key with error handling
      let sharedKey: string;
      try {
        sharedKey = this.deriveSharedKey(this.currentWallet.address, config.peerWallet);
      } catch (error) {
        const keyError = ErrorFactory.sessionCreationFailed(
          error as Error,
          { ...sessionContext, step: 'key_derivation', sessionId }
        );
        getErrorTracker().captureError(keyError, { context: 'Shared key derivation' });
        return createResult.error(keyError);
      }

      // Create session object
      const session: ChatSession = {
        session_id: sessionId,
        peer_wallet: config.peerWallet,
        sharedKey: sharedKey
      };

      // Store session with error handling
      try {
        this.activeSessions.set(sessionId, session);
        this.log('Session started:', sessionId);
        
        Metrics.business('session_created', 1, { sessionId, peerWallet: config.peerWallet });
        return createResult.success(session);
      } catch (error) {
        const storageError = ErrorFactory.sessionCreationFailed(
          error as Error,
          { ...sessionContext, step: 'session_storage', sessionId }
        );
        getErrorTracker().captureError(storageError, { context: 'Session storage' });
        return createResult.error(storageError);
      }
    } catch (error) {
      // Catch any unexpected errors with proper context
      const sessionError = ErrorFactory.sessionCreationFailed(
        error as Error,
        { ...sessionContext, step: 'unexpected_error' }
      );
      getErrorTracker().captureError(sessionError, { context: 'Session creation - unexpected error' });
      return createResult.error(sessionError);
    }
  }

  /**
   * Send a message in a session with retry logic and circuit breaker
   */
  async sendMessage(sessionId: string, plaintext: string): Promise<Result<DeliveryReceipt>> {
    const messageContext = {
      operation: 'sendMessage',
      sessionId,
      messageLength: plaintext.length,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Validate session exists
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Session not found',
        'Chat session not found. Please start a new session.',
        messageContext
      );
      return createResult.error(error);
    }

    // Validate message bus availability
    if (!this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('sendMessage', messageContext);
      return createResult.error(error);
    }

    // Generate message ID for tracking
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const enhancedContext = { ...messageContext, messageId };

    try {
      // Use circuit breaker and retry utility for resilient message sending
      const result = await this.circuitBreaker.execute(async () => {
        return await this.retryUtility.execute(
          async () => {
            return await Metrics.time('message_send', async () => {
              const sendResult = await this.messageBus!.sendMessage(session, plaintext);
              
              if (!sendResult.success) {
                // Convert failed result to an error for retry logic
                throw ErrorFactory.messageDeliveryFailed(
                  messageId,
                  sendResult.error || new Error('Message send failed'),
                  { ...enhancedContext, busError: sendResult.error }
                );
              }
              
              return sendResult;
            });
          },
          {
            onRetry: (error, attemptNumber) => {
              enhancedContext.retryCount = attemptNumber;
              this.log(`Retrying message send (attempt ${attemptNumber + 1}):`, error.message);
              Metrics.action('message_send_retry', undefined, {
                sessionId,
                messageId,
                attemptNumber,
                error: error.message
              });
            },
            shouldRetry: (error, attemptNumber) => {
              // Only retry network errors, not validation errors
              if (error instanceof SolConnectError) {
                return error.shouldRetry(attemptNumber);
              }
              return attemptNumber < 3; // Default retry for unknown errors
            }
          }
        );
      });

      if (result.success) {
        this.log('Message sent:', result.data!.messageId);
        Metrics.business('message_sent', 1, { 
          sessionId, 
          messageId: result.data!.messageId,
          retryCount: enhancedContext.retryCount 
        });
      }

      return result;
    } catch (error) {
      // Handle circuit breaker open state
      if (error.message?.includes('Circuit breaker is OPEN')) {
        const circuitError = ErrorFactory.messageDeliveryFailed(
          messageId,
          error as Error,
          { ...enhancedContext, circuitBreakerState: this.circuitBreaker.getState() }
        );
        
        Metrics.action('message_send_failed', undefined, { 
          sessionId, 
          messageId,
          error: 'circuit_breaker_open' 
        });
        getErrorTracker().captureError(circuitError, { context: 'Message send - circuit breaker open' });
        return createResult.error(circuitError);
      }

      // Handle retry exhaustion and other errors
      const deliveryError = error instanceof SolConnectError 
        ? error 
        : ErrorFactory.messageDeliveryFailed(
            messageId,
            error as Error,
            { ...enhancedContext, step: 'retry_exhausted' }
          );

      Metrics.action('message_send_failed', undefined, { 
        sessionId, 
        messageId,
        error: deliveryError.message,
        retryCount: enhancedContext.retryCount
      });
      getErrorTracker().captureError(deliveryError, { context: 'Message send failed' });
      return createResult.error(deliveryError);
    }
  }

  /**
   * Subscribe to messages for a session
   */
  subscribeToMessages(sessionId: string, handler: MessageHandler): Result<Subscription> {
    if (!this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'Message bus not available',
        'Messaging service is not available'
      ));
    }

    try {
      // Wrap handler to add session context
      const wrappedHandler: MessageHandler = (message: Message) => {
        this.log('Message received:', message);
        handler({
          ...message,
          session_id: sessionId
        });
      };

      return this.messageBus.subscribeToMessages(sessionId, wrappedHandler);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to subscribe to messages: ${error}`,
        'Failed to set up message subscription',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * End a chat session with enhanced error handling
   */
  async endSession(sessionId: string): Promise<Result<void>> {
    const context = {
      operation: 'endSession',
      sessionId,
      timestamp: Date.now(),
      hasSession: this.activeSessions.has(sessionId)
    };

    try {
      // Check if session exists
      if (!this.activeSessions.has(sessionId)) {
        const error = SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          `Session ${sessionId} not found`,
          'Session not found. It may have already ended.',
          context
        );
        return createResult.error(error);
      }

      const session = this.activeSessions.get(sessionId)!;
      
      // Clean up auto-sync if enabled
      const intervalId = (session as any)._autoSyncInterval;
      if (intervalId) {
        clearInterval(intervalId);
        this.log('Auto-sync disabled for ending session:', sessionId);
      }

      // Remove session
      this.activeSessions.delete(sessionId);
      
      // Clean up any session-specific resources
      if (this.messageBus) {
        try {
          // Attempt to clean up message bus resources for this session
          await this.messageBus.clearStoredMessages(sessionId);
        } catch (cleanupError) {
          // Log but don't fail the operation
          this.log('Warning: Failed to clean up session messages:', cleanupError);
          Metrics.action('session_cleanup_warning', undefined, {
            sessionId,
            error: (cleanupError as Error).message
          });
        }
      }

      this.log('Session ended:', sessionId);
      Metrics.business('session_ended', 1, { sessionId });
      
      return createResult.success(undefined);
    } catch (error) {
      const endError = SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to end session: ${(error as Error).message}`,
        'Error occurred while ending session. Please try again.',
        { ...context, error: (error as Error).message }
      );
      
      getErrorTracker().captureError(endError, { context: 'Session end failed' });
      return createResult.error(endError);
    }
  }

  /**
   * Get current wallet info
   */
  getCurrentWallet(): WalletInfo | null {
    return this.currentWallet;
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): ChatSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): string {
    return this.messageBus?.connectionStatus || 'disconnected';
  }

  /**
   * Check if SDK is ready for use
   */
  get isReady(): boolean {
    return this.isInitialized && 
           this.currentWallet?.connected === true && 
           this.messageBus?.isReady === true;
  }

  /**
   * Get stored messages for a session with enhanced error handling
   */
  async getStoredMessages(sessionId: string, limit?: number): Promise<Result<Message[]>> {
    const context = {
      operation: 'getStoredMessages',
      sessionId,
      limit,
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('getStoredMessages', context);
      return createResult.error(error);
    }

    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid session ID provided',
        'Please provide a valid session ID.',
        context
      );
      return createResult.error(error);
    }

    try {
      // Use retry utility for database operations
      const result = await this.retryUtility.execute(
        async () => {
          return await Metrics.time('get_stored_messages', async () => {
            return await this.messageBus!.getStoredMessages(sessionId, limit);
          });
        },
        {
          onRetry: (error, attemptNumber) => {
            this.log(`Retrying message retrieval (attempt ${attemptNumber + 1}):`, error.message);
            Metrics.action('get_messages_retry', undefined, {
              sessionId,
              attemptNumber,
              error: error.message
            });
          },
          shouldRetry: (error) => {
            // Retry on storage errors but not on validation errors
            if (error instanceof SolConnectError) {
              return error.category === ErrorCategory.SYSTEM && error.recoverable;
            }
            return true;
          }
        }
      );

      if (result.success) {
        Metrics.business('messages_retrieved', result.data?.length || 0, { sessionId });
      }

      return result;
    } catch (error) {
      const storageError = SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to retrieve messages: ${(error as Error).message}`,
        'Unable to retrieve messages. Please try again.',
        { ...context, error: (error as Error).message }
      );
      
      Metrics.action('get_messages_failed', undefined, { sessionId, error: storageError.message });
      getErrorTracker().captureError(storageError, { context: 'Message retrieval failed' });
      return createResult.error(storageError);
    }
  }

  /**
   * Clear stored messages for a session with enhanced error handling
   */
  async clearStoredMessages(sessionId: string): Promise<Result<void>> {
    const context = {
      operation: 'clearStoredMessages',
      sessionId,
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('clearStoredMessages', context);
      return createResult.error(error);
    }

    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid session ID provided',
        'Please provide a valid session ID.',
        context
      );
      return createResult.error(error);
    }

    try {
      // Execute with retry for resilience
      const result = await this.retryUtility.execute(
        async () => {
          return await Metrics.time('clear_stored_messages', async () => {
            return await this.messageBus!.clearStoredMessages(sessionId);
          });
        },
        {
          onRetry: (error, attemptNumber) => {
            this.log(`Retrying message clear (attempt ${attemptNumber + 1}):`, error.message);
            Metrics.action('clear_messages_retry', undefined, {
              sessionId,
              attemptNumber,
              error: error.message
            });
          }
        }
      );

      if (result.success) {
        this.log('Messages cleared for session:', sessionId);
        Metrics.business('messages_cleared', 1, { sessionId });
      }

      return result;
    } catch (error) {
      const clearError = SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to clear messages: ${(error as Error).message}`,
        'Unable to clear messages. Please try again.',
        { ...context, error: (error as Error).message }
      );
      
      Metrics.action('clear_messages_failed', undefined, { sessionId, error: clearError.message });
      getErrorTracker().captureError(clearError, { context: 'Message clear failed' });
      return createResult.error(clearError);
    }
  }

  /**
   * Export all messages for backup with enhanced error handling
   */
  async exportMessages(): Promise<Result<string>> {
    const context = {
      operation: 'exportMessages',
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus,
      activeSessions: this.activeSessions.size
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('exportMessages', context);
      return createResult.error(error);
    }

    try {
      const startTime = Date.now();
      
      // Execute export with monitoring
      const result = await Metrics.time('export_messages', async () => {
        return await this.messageBus!.exportMessages();
      });

      if (result.success && result.data) {
        const exportSize = new Blob([result.data]).size;
        const duration = Date.now() - startTime;
        
        this.log(`Messages exported: ${exportSize} bytes in ${duration}ms`);
        Metrics.business('messages_exported', 1, { 
          exportSize, 
          duration,
          sessionCount: this.activeSessions.size 
        });
      }

      return result;
    } catch (error) {
      const exportError = SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to export messages: ${(error as Error).message}`,
        'Unable to export messages. Please check your storage and try again.',
        { ...context, error: (error as Error).message }
      );
      
      Metrics.action('export_messages_failed', undefined, { error: exportError.message });
      getErrorTracker().captureError(exportError, { context: 'Message export failed' });
      return createResult.error(exportError);
    }
  }

  /**
   * Import messages from backup with enhanced error handling
   */
  async importMessages(data: string): Promise<Result<number>> {
    const context = {
      operation: 'importMessages',
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus,
      dataSize: data?.length || 0
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('importMessages', context);
      return createResult.error(error);
    }

    // Validate import data
    if (!data || typeof data !== 'string' || data.trim().length === 0) {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid import data provided',
        'Please provide valid message data to import.',
        context
      );
      return createResult.error(error);
    }

    // Check data size limit (e.g., 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (data.length > maxSize) {
      const error = ErrorFactory.messageTooLarge(data.length, maxSize);
      error.context = { ...error.context, ...context };
      return createResult.error(error);
    }

    try {
      const startTime = Date.now();
      
      // Execute import with monitoring
      const result = await Metrics.time('import_messages', async () => {
        return await this.messageBus!.importMessages(data);
      });

      if (result.success && result.data !== undefined) {
        const duration = Date.now() - startTime;
        
        this.log(`Messages imported: ${result.data} messages in ${duration}ms`);
        Metrics.business('messages_imported', result.data, { 
          dataSize: data.length,
          duration,
          messageCount: result.data 
        });
      }

      return result;
    } catch (error) {
      const importError = SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to import messages: ${(error as Error).message}`,
        'Unable to import messages. Please check the data format and try again.',
        { ...context, error: (error as Error).message }
      );
      
      Metrics.action('import_messages_failed', undefined, { 
        dataSize: data.length,
        error: importError.message 
      });
      getErrorTracker().captureError(importError, { context: 'Message import failed' });
      return createResult.error(importError);
    }
  }

  /**
   * Update message status with enhanced error handling
   */
  async updateMessageStatus(messageId: string, status: MessageStatus, optimistic: boolean = false): Promise<Result<void>> {
    const context = {
      operation: 'updateMessageStatus',
      messageId,
      status,
      optimistic,
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('updateMessageStatus', context);
      return createResult.error(error);
    }

    // Validate inputs
    if (!messageId || typeof messageId !== 'string') {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid message ID provided',
        'Please provide a valid message ID.',
        context
      );
      return createResult.error(error);
    }

    if (!Object.values(MessageStatus).includes(status)) {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        `Invalid message status: ${status}`,
        'Please provide a valid message status.',
        context
      );
      return createResult.error(error);
    }

    try {
      // Execute with retry for resilience
      const result = await this.retryUtility.execute(
        async () => {
          return await Metrics.time('update_message_status', async () => {
            // Update in storage first
            if (this.messageBus) {
              const storageResult = await this.messageBus.updateMessageStatus(messageId, status);
              if (!storageResult.success) {
                throw ErrorFactory.messageDeliveryFailed(
                  messageId,
                  storageResult.error || new Error('Status update failed'),
                  { ...context, storageError: storageResult.error }
                );
              }
            }

            // Broadcast status update if not optimistic
            if (!optimistic && this.messageBus) {
              const update: MessageStatusUpdate = {
                messageId,
                status,
                timestamp: new Date().toISOString()
              };
              
              await this.messageBus.broadcastStatusUpdate(update);
            }

            return createResult.success(undefined);
          });
        },
        {
          onRetry: (error, attemptNumber) => {
            this.log(`Retrying status update (attempt ${attemptNumber + 1}):`, error.message);
            Metrics.action('status_update_retry', undefined, {
              messageId,
              status,
              attemptNumber,
              error: error.message
            });
          }
        }
      );

      if (result.success) {
        this.log(`Message status updated: ${messageId} -> ${status}`);
        Metrics.business('message_status_updated', 1, { messageId, status, optimistic });
      }

      return result;
    } catch (error) {
      const statusError = error instanceof SolConnectError 
        ? error 
        : ErrorFactory.messageDeliveryFailed(
            messageId,
            error as Error,
            { ...context, step: 'status_update_failed' }
          );

      Metrics.action('status_update_failed', undefined, { 
        messageId, 
        status,
        error: statusError.message 
      });
      getErrorTracker().captureError(statusError, { context: 'Message status update failed' });
      return createResult.error(statusError);
    }
  }

  /**
   * Mark message as read with enhanced error handling
   */
  async markMessageAsRead(messageId: string): Promise<Result<void>> {
    const context = {
      operation: 'markMessageAsRead',
      messageId,
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('markMessageAsRead', context);
      return createResult.error(error);
    }

    // Validate message ID
    if (!messageId || typeof messageId !== 'string') {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid message ID provided',
        'Please provide a valid message ID.',
        context
      );
      return createResult.error(error);
    }

    try {
      // Update status to read
      const result = await this.updateMessageStatus(messageId, MessageStatus.READ, false);
      
      if (result.success) {
        this.log(`Message marked as read: ${messageId}`);
        Metrics.business('message_marked_read', 1, { messageId });
      }

      return result;
    } catch (error) {
      const readError = SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to mark message as read: ${(error as Error).message}`,
        'Unable to mark message as read. Please try again.',
        { ...context, error: (error as Error).message }
      );
      
      Metrics.action('mark_read_failed', undefined, { messageId, error: readError.message });
      getErrorTracker().captureError(readError, { context: 'Mark message as read failed' });
      return createResult.error(readError);
    }
  }

  /**
   * Batch update message statuses for performance
   */
  async batchUpdateMessageStatus(updates: MessageStatusUpdate[]): Promise<Result<void>> {
    const context = {
      operation: 'batchUpdateMessageStatus',
      updateCount: updates.length,
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('batchUpdateMessageStatus', context);
      return createResult.error(error);
    }

    // Validate updates array
    if (!Array.isArray(updates) || updates.length === 0) {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid updates array provided',
        'Please provide a non-empty array of status updates.',
        context
      );
      return createResult.error(error);
    }

    // Validate each update
    for (const update of updates) {
      if (!update.messageId || !update.status || !update.timestamp) {
        const error = SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          'Invalid status update format',
          'All status updates must have messageId, status, and timestamp.',
          { ...context, invalidUpdate: update }
        );
        return createResult.error(error);
      }
    }

    try {
      // Execute batch update with monitoring
      const result = await Metrics.time('batch_update_message_status', async () => {
        if (this.messageBus) {
          const storageResult = await this.messageBus.batchUpdateMessageStatus(updates);
          if (!storageResult.success) {
            throw ErrorFactory.messageDeliveryFailed(
              'batch_update',
              storageResult.error || new Error('Batch status update failed'),
              { ...context, storageError: storageResult.error }
            );
          }

          // Broadcast all status updates
          for (const update of updates) {
            await this.messageBus.broadcastStatusUpdate(update);
          }
        }

        return createResult.success(undefined);
      });

      if (result.success) {
        this.log(`Batch status update completed: ${updates.length} messages`);
        Metrics.business('batch_status_updated', updates.length, { updateCount: updates.length });
      }

      return result;
    } catch (error) {
      const batchError = error instanceof SolConnectError 
        ? error 
        : SolConnectError.system(
            ErrorCode.UNKNOWN_ERROR,
            `Batch status update failed: ${(error as Error).message}`,
            'Unable to update message statuses. Please try again.',
            { ...context, error: (error as Error).message }
          );

      Metrics.action('batch_status_update_failed', undefined, { 
        updateCount: updates.length,
        error: batchError.message 
      });
      getErrorTracker().captureError(batchError, { context: 'Batch status update failed' });
      return createResult.error(batchError);
    }
  }

  /**
   * Get message status with enhanced error handling
   */
  async getMessageStatus(messageId: string): Promise<Result<MessageStatus | null>> {
    const context = {
      operation: 'getMessageStatus',
      messageId,
      timestamp: Date.now(),
      sdkInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    // Check SDK initialization
    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('getMessageStatus', context);
      return createResult.error(error);
    }

    // Validate message ID
    if (!messageId || typeof messageId !== 'string') {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Invalid message ID provided',
        'Please provide a valid message ID.',
        context
      );
      return createResult.error(error);
    }

    try {
      // Execute with retry for resilience
      const result = await this.retryUtility.execute(
        async () => {
          return await Metrics.time('get_message_status', async () => {
            return await this.messageBus!.getMessageStatus(messageId);
          });
        },
        {
          onRetry: (error, attemptNumber) => {
            this.log(`Retrying get status (attempt ${attemptNumber + 1}):`, error.message);
            Metrics.action('get_status_retry', undefined, {
              messageId,
              attemptNumber,
              error: error.message
            });
          }
        }
      );

      if (result.success) {
        Metrics.business('message_status_retrieved', 1, { messageId, status: result.data });
      }

      return result;
    } catch (error) {
      const statusError = SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get message status: ${(error as Error).message}`,
        'Unable to retrieve message status. Please try again.',
        { ...context, error: (error as Error).message }
      );
      
      Metrics.action('get_status_failed', undefined, { messageId, error: statusError.message });
      getErrorTracker().captureError(statusError, { context: 'Get message status failed' });
      return createResult.error(statusError);
    }
  }

  /**
   * Cleanup and disconnect with enhanced error handling
   */
  async cleanup(): Promise<Result<void>> {
    const context = {
      operation: 'cleanup',
      timestamp: Date.now(),
      currentState: {
        isInitialized: this.isInitialized,
        hasWallet: !!this.currentWallet,
        walletConnected: this.currentWallet?.connected || false,
        hasMessageBus: !!this.messageBus,
        activeSessions: this.activeSessions.size
      }
    };

    const errors: Error[] = [];

    try {
      // End all active sessions first
      if (this.activeSessions.size > 0) {
        this.log(`Ending ${this.activeSessions.size} active sessions...`);
        const sessionIds = Array.from(this.activeSessions.keys());
        
        for (const sessionId of sessionIds) {
          try {
            await this.endSession(sessionId);
          } catch (sessionError) {
            errors.push(new Error(`Failed to end session ${sessionId}: ${(sessionError as Error).message}`));
            this.log('Warning: Failed to end session during cleanup:', sessionId, sessionError);
          }
        }
      }

      // Disconnect wallet
      if (this.currentWallet?.connected) {
        try {
          const disconnectResult = await this.disconnectWallet();
          if (!disconnectResult.success) {
            errors.push(new Error(`Wallet disconnect failed: ${disconnectResult.error?.message}`));
          }
        } catch (walletError) {
          errors.push(new Error(`Wallet cleanup error: ${(walletError as Error).message}`));
          this.log('Warning: Failed to disconnect wallet during cleanup:', walletError);
        }
      }

      // Disconnect message bus
      if (this.messageBus) {
        try {
          await this.messageBus.disconnect();
          this.messageBus = null;
        } catch (busError) {
          errors.push(new Error(`Message bus cleanup error: ${(busError as Error).message}`));
          this.log('Warning: Failed to disconnect message bus during cleanup:', busError);
        }
      }

      // Reset state
      this.isInitialized = false;
      this.activeSessions.clear();
      
      // Report any errors that occurred during cleanup
      if (errors.length > 0) {
        const cleanupError = SolConnectError.system(
          ErrorCode.UNKNOWN_ERROR,
          `Cleanup completed with ${errors.length} error(s): ${errors.map(e => e.message).join('; ')}`,
          'Cleanup completed with some errors. The SDK has been reset.',
          { 
            ...context, 
            errors: errors.map(e => e.message),
            errorCount: errors.length 
          }
        );
        
        Metrics.action('cleanup_with_errors', undefined, { errorCount: errors.length });
        getErrorTracker().captureError(cleanupError, { context: 'SDK cleanup with errors' });
        
        // Return success even with errors, as the SDK is still reset
        this.log('SDK cleanup completed with errors');
        return createResult.success(undefined);
      }

      this.log('SDK cleanup completed successfully');
      Metrics.business('sdk_cleanup_completed', 1, { 
        sessionsCleared: context.currentState.activeSessions 
      });
      
      return createResult.success(undefined);
    } catch (error) {
      // Catastrophic failure - ensure SDK is marked as not initialized
      this.isInitialized = false;
      this.messageBus = null;
      this.currentWallet = null;
      this.activeSessions.clear();
      
      const fatalError = SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Fatal cleanup error: ${(error as Error).message}`,
        'A critical error occurred during cleanup. The SDK has been forcefully reset.',
        { ...context, fatalError: (error as Error).message }
      );
      
      Metrics.action('cleanup_fatal_error', undefined, { error: fatalError.message });
      getErrorTracker().captureError(fatalError, { context: 'SDK cleanup fatal error' });
      
      return createResult.error(fatalError);
    }
  }

  /**
   * Sync messages for a specific session or all sessions
   * @param sessionId - Optional session ID to sync. If not provided, syncs all sessions
   * @returns Number of messages synced
   */
  async syncMessages(sessionId?: string): Promise<Result<number>> {
    const syncContext = {
      operation: 'syncMessages',
      sessionId,
      timestamp: Date.now(),
      isInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('syncMessages', syncContext);
      return createResult.error(error);
    }

    try {
      this.log('Starting message sync', sessionId ? `for session ${sessionId}` : 'for all sessions');
      Metrics.action('sync_started', undefined, { sessionId });

      const syncResult = await this.messageBus.syncMessages(sessionId);

      if (syncResult.success) {
        const syncedCount = syncResult.data!;
        this.log('Message sync completed', `${syncedCount} messages synced`);
        Metrics.business('messages_synced', syncedCount, { sessionId });
        return createResult.success(syncedCount);
      } else {
        Metrics.action('sync_failed', undefined, { 
          sessionId, 
          error: syncResult.error?.message 
        });
        return syncResult;
      }
    } catch (error) {
      const syncError = SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Sync failed: ${error}`,
        'Failed to sync messages',
        { ...syncContext, error: error?.toString() }
      );
      
      Metrics.action('sync_failed', undefined, { 
        sessionId, 
        error: syncError.message 
      });
      getErrorTracker().captureError(syncError, { context: 'Message sync' });
      return createResult.error(syncError);
    }
  }

  /**
   * Get the current sync status
   * @returns Current sync state including progress and last sync time
   */
  getSyncStatus(): Result<{
    syncInProgress: boolean;
    lastSyncAt?: Date;
    queuedMessageCount: number;
  }> {
    if (!this.messageBus) {
      return createResult.error(ErrorFactory.sdkNotInitialized('getSyncStatus'));
    }

    try {
      const state = this.messageBus.getState();
      return createResult.success({
        syncInProgress: state.syncInProgress,
        lastSyncAt: state.lastSyncAt,
        queuedMessageCount: state.queuedMessageCount
      });
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to get sync status: ${error}`,
        'Failed to get sync status',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Force process all queued messages
   * Useful when coming back online after being offline
   * @returns Number of messages processed
   */
  async processQueuedMessages(): Promise<Result<number>> {
    const processContext = {
      operation: 'processQueuedMessages',
      timestamp: Date.now(),
      isInitialized: this.isInitialized,
      messageBusReady: !!this.messageBus
    };

    if (!this.isInitialized || !this.messageBus) {
      const error = ErrorFactory.sdkNotInitialized('processQueuedMessages', processContext);
      return createResult.error(error);
    }

    try {
      this.log('Processing queued messages');
      Metrics.action('queue_processing_started');

      const processResult = await this.messageBus.processQueuedMessages();

      if (processResult.success) {
        const processedCount = processResult.data!;
        this.log('Queue processing completed', `${processedCount} messages processed`);
        Metrics.business('messages_processed_from_queue', processedCount);
        return createResult.success(processedCount);
      } else {
        Metrics.action('queue_processing_failed', undefined, { 
          error: processResult.error?.message 
        });
        return processResult;
      }
    } catch (error) {
      const processError = SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Queue processing failed: ${error}`,
        'Failed to process queued messages',
        { ...processContext, error: error?.toString() }
      );
      
      Metrics.action('queue_processing_failed', undefined, { 
        error: processError.message 
      });
      getErrorTracker().captureError(processError, { context: 'Queue processing' });
      return createResult.error(processError);
    }
  }

  /**
   * Enable automatic sync for a session
   * Messages will be synced automatically when network is available
   * @param sessionId - Session ID to enable auto-sync for
   * @param intervalMs - Sync interval in milliseconds (default: 5000)
   */
  async enableAutoSync(sessionId: string, intervalMs: number = 5000): Promise<Result<void>> {
    const autoSyncContext = {
      operation: 'enableAutoSync',
      sessionId,
      intervalMs,
      timestamp: Date.now()
    };

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Session not found',
        'Chat session not found. Please start a new session.',
        autoSyncContext
      );
      return createResult.error(error);
    }

    try {
      // Store auto-sync interval
      const intervalId = setInterval(async () => {
        if (this.messageBus?.connectionStatus === 'connected') {
          await this.syncMessages(sessionId);
        }
      }, intervalMs);

      // Store interval ID for cleanup
      (session as any)._autoSyncInterval = intervalId;
      
      this.log('Auto-sync enabled for session', sessionId);
      Metrics.action('auto_sync_enabled', undefined, { sessionId, intervalMs });
      
      return createResult.success(undefined);
    } catch (error) {
      const syncError = SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to enable auto-sync: ${error}`,
        'Failed to enable automatic sync',
        { ...autoSyncContext, error: error?.toString() }
      );
      
      getErrorTracker().captureError(syncError, { context: 'Auto-sync setup' });
      return createResult.error(syncError);
    }
  }

  /**
   * Disable automatic sync for a session
   * @param sessionId - Session ID to disable auto-sync for
   */
  async disableAutoSync(sessionId: string): Promise<Result<void>> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      const error = SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Session not found',
        'Chat session not found.',
        { sessionId }
      );
      return createResult.error(error);
    }

    try {
      const intervalId = (session as any)._autoSyncInterval;
      if (intervalId) {
        clearInterval(intervalId);
        delete (session as any)._autoSyncInterval;
      }
      
      this.log('Auto-sync disabled for session', sessionId);
      Metrics.action('auto_sync_disabled', undefined, { sessionId });
      
      return createResult.success(undefined);
    } catch (error) {
      const syncError = SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to disable auto-sync: ${error}`,
        'Failed to disable automatic sync',
        { sessionId, error: error?.toString() }
      );
      
      getErrorTracker().captureError(syncError, { context: 'Auto-sync teardown' });
      return createResult.error(syncError);
    }
  }

  // Private helper methods

  private generateTestWalletAddress(): string {
    // Generate a realistic-looking Solana address for demo
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private isValidWalletAddress(address: string): boolean {
    // Basic validation for Solana address format
    return typeof address === 'string' && 
           address.length >= 32 && 
           address.length <= 44 &&
           /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
  }

  private generateSessionId(wallet1: string, wallet2: string): string {
    // Create deterministic session ID from both wallet addresses
    const sortedWallets = [wallet1, wallet2].sort();
    const timestamp = Date.now();
    return `session_${sortedWallets[0].slice(0, 8)}_${sortedWallets[1].slice(0, 8)}_${timestamp}`;
  }

  private deriveSharedKey(myWallet: string, peerWallet: string): Uint8Array {
    // Simplified key derivation for demo
    // In production, this would use proper X25519 ECDH
    const keyMaterial = myWallet + peerWallet;
    const encoder = new TextEncoder();
    const data = encoder.encode(keyMaterial);
    
    // Create a 32-byte key from the wallet addresses
    const key = new Uint8Array(32);
    for (let i = 0; i < key.length; i++) {
      key[i] = data[i % data.length] ^ (i + 42);
    }
    
    return key;
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[SolConnectSDK] ${message}`, ...args);
    }
  }
}

/**
 * Global SDK instance
 */
let globalSDK: SolConnectSDK | null = null;

/**
 * Initialize and get the global SDK instance
 */
export async function initializeSDK(config: SDKConfig): Promise<Result<SolConnectSDK>> {
  try {
    const sdk = new SolConnectSDK(config);
    const initResult = await sdk.initialize();
    
    if (!initResult.success) {
      return createResult.error(initResult.error!);
    }
    
    globalSDK = sdk;
    return createResult.success(sdk);
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.UNKNOWN_ERROR,
      `Failed to initialize SDK: ${error}`,
      'Failed to initialize SolConnect SDK',
      { error: error?.toString() }
    ));
  }
}

/**
 * Get the global SDK instance
 */
export function getSDK(): SolConnectSDK | null {
  return globalSDK;
}

/**
 * Cleanup the global SDK instance
 */
export async function cleanupSDK(): Promise<Result<void>> {
  if (globalSDK) {
    const result = await globalSDK.cleanup();
    globalSDK = null;
    return result;
  }
  
  return createResult.success(undefined);
}