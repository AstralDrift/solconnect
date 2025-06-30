/**
 * Unified Message Bus for SolConnect with Enhanced Offline Sync
 * Coordinates between transport layer, encryption, state management, and network monitoring
 */

import { ChatSession, Message, MessageStatus, MessageStatusUpdate } from '../types';
import { SolConnectError, ErrorCode, Result, createResult } from '../types/errors';
import { MessageTransport, TransportFactory, DeliveryReceipt, MessageHandler, Subscription, WebSocketTransport } from './transport/MessageTransport';
import { MessageStorage, getMessageStorage } from './storage/MessageStorage';
import { NetworkStateManager, getNetworkStateManager, NetworkState } from './network/NetworkStateManager';
import { Logger } from './monitoring/Logger';
import { SyncManager, getSyncManager } from './sync/SyncManager';
import { WebSocketSyncTransport } from './sync/WebSocketSyncTransport';
import { DatabaseService } from './database/DatabaseService';
import { EncryptionService, initializeEncryptionService, getEncryptionService } from './crypto/EncryptionService';
import { SyncMessageFactory } from './sync/SyncProtocol';
import { getReactionService, ReactionSummary } from './ReactionService';
import { MessageHandler as ProtocolMessageHandler } from './protocol/MessageHandler';

export interface MessageBusConfig {
  relayEndpoint: string;
  transportType?: 'websocket' | 'quic';
  enableEncryption?: boolean;
  messageRetryAttempts?: number;
  connectionTimeout?: number;
  enablePersistence?: boolean;
  enableNetworkManager?: boolean;
  deviceId?: string;
  encryptionPassword?: string; // Password for key storage encryption
  enableStatusTracking?: boolean; // Enable message status tracking
  statusUpdateCallback?: (update: MessageStatusUpdate) => void; // Callback for status updates
}

export interface MessageBusState {
  isInitialized: boolean;
  isConnected: boolean;
  networkState: NetworkState;
  queuedMessageCount: number;
  lastSyncAt?: Date;
  syncInProgress: boolean;
}

export interface MessageInterceptor {
  beforeSend?: (session: ChatSession, message: string) => Promise<Result<string>>;
  afterReceive?: (message: Message) => Promise<Result<Message>>;
}

export interface ReactionEvent {
  type: 'reaction_added' | 'reaction_removed';
  messageId: string;
  sessionId: string;
  emoji: string;
  userAddress: string;
  timestamp: string;
}

export interface ReactionEventHandler {
  (event: ReactionEvent): void;
}

/**
 * Central message bus that coordinates all messaging operations with offline sync
 */
export class MessageBus {
  private transport: MessageTransport;
  private config: Required<MessageBusConfig>;
  private logger = new Logger('MessageBus');
  private isInitialized = false;
  private messageQueue: Array<{ session: ChatSession; message: string; resolve: Function; reject: Function }> = [];
  private subscriptions = new Map<string, Subscription>();
  private storage?: MessageStorage;
  private networkManager?: NetworkStateManager;
  private deviceId: string;
  private syncManager?: SyncManager;
  private database?: DatabaseService;
  private encryptionService?: EncryptionService;
  private messageInterceptor?: MessageInterceptor;
  
  // Sync state
  private syncInProgress = false;
  private lastSyncAt?: Date;
  private syncQueue = new Map<string, Set<string>>(); // sessionId -> Set of messageIds being synced
  
  // Network state listeners
  private networkStateListener?: () => void;
  private queueProcessorUnsubscribe?: () => void;
  
  // Status tracking
  private statusUpdateCallback?: (update: MessageStatusUpdate) => void;
  private messageStatusEventHandlers = new Map<string, (update: MessageStatusUpdate) => void>();
  
  // Reaction tracking
  private reactionEventHandlers = new Map<string, ReactionEventHandler>();
  private reactionService = getReactionService();
  
  // Protocol message handler for read receipts and status updates
  private protocolMessageHandler?: ProtocolMessageHandler;
  
  // Read receipt batching for performance optimization
  private readReceiptBatch = new Map<string, Set<string>>(); // sessionId -> Set of messageIds
  private readReceiptBatchTimer = new Map<string, NodeJS.Timeout>(); // sessionId -> timeout
  private readonly BATCH_DELAY_MS = 500; // Delay before sending batched receipts
  private readonly MAX_BATCH_SIZE = 50; // Maximum messages in a batch
  private batchRetryCount = new Map<string, number>(); // sessionId -> retry count
  private readonly MAX_BATCH_RETRIES = 3; // Maximum retry attempts per batch

  constructor(config: MessageBusConfig) {
    this.config = {
      transportType: 'websocket',
      enableEncryption: true,
      messageRetryAttempts: 3,
      connectionTimeout: 10000,
      enablePersistence: true,
      enableNetworkManager: true,
      deviceId: this.generateDeviceId(),
      encryptionPassword: undefined,
      enableStatusTracking: true,
      statusUpdateCallback: undefined,
      ...config
    };

    this.statusUpdateCallback = this.config.statusUpdateCallback;

    this.deviceId = this.config.deviceId;
    this.transport = TransportFactory.create(this.config.transportType);
    
    // Initialize protocol message handler with status update callback
    this.protocolMessageHandler = new ProtocolMessageHandler({
      enableAutoAck: true,
      enableHeartbeat: true,
      onStatusUpdate: (update: MessageStatusUpdate) => {
        // Forward status updates to all registered handlers
        this.notifyStatusUpdateHandlers(update);
      }
    });
  }

  /**
   * Initialize the message bus and establish connection
   */
  async initialize(database?: DatabaseService, walletAddress?: string): Promise<Result<void>> {
    if (this.isInitialized) {
      return createResult.success(undefined);
    }

    try {
      this.logger.info('Initializing MessageBus with offline sync', {
        deviceId: this.deviceId,
        enableNetworkManager: this.config.enableNetworkManager,
        enableEncryption: this.config.enableEncryption
      });

      this.database = database;

      // Initialize encryption if enabled and wallet address provided
      if (this.config.enableEncryption && walletAddress) {
        const encryptionResult = await initializeEncryptionService(
          walletAddress,
          database,
          { keyStoragePassword: this.config.encryptionPassword }
        );
        
        if (!encryptionResult.success) {
          this.logger.warn('Failed to initialize encryption service:', encryptionResult.error);
          // Continue without encryption
        } else {
          this.encryptionService = encryptionResult.data!;
          this.messageInterceptor = this.encryptionService.createMessageInterceptor();
          this.logger.info('Encryption service initialized successfully');
        }
      }

      // Initialize storage if persistence is enabled
      if (this.config.enablePersistence) {
        this.storage = getMessageStorage();
        const storageResult = await this.storage.initialize();
        if (!storageResult.success) {
          this.logger.warn('Failed to initialize message storage:', storageResult.error);
          // Continue without persistence
        } else {
          // Register queue processor with storage
          this.storage.registerQueueProcessor(this.handleQueuedMessages.bind(this));
        }
      }

      // Initialize network state manager
      if (this.config.enableNetworkManager) {
        this.networkManager = getNetworkStateManager();
        const networkResult = await this.networkManager.initialize();
        if (!networkResult.success) {
          this.logger.warn('Failed to initialize network manager:', networkResult.error);
        } else {
          this.setupNetworkStateIntegration();
        }
      }

      // Attempt to connect transport
      const connectionResult = await this.connectTransport();
      if (!connectionResult.success) {
        this.logger.warn('Initial transport connection failed, will retry when online:', connectionResult.error);
        // Continue initialization even if connection fails - we'll retry when online
      }

      // Initialize sync manager
      this.syncManager = getSyncManager();
      if (this.transport instanceof WebSocketTransport) {
        const syncTransport = new WebSocketSyncTransport(this.transport);
        const syncResult = await this.syncManager.initialize(this.database, syncTransport);
        if (!syncResult.success) {
          this.logger.warn('Failed to initialize sync manager:', syncResult.error);
        }
      }

      this.isInitialized = true;

      // Process any pending messages from storage
      if (this.storage) {
        await this.processPendingMessages();
      }

      this.logger.info('MessageBus initialized successfully', {
        connected: this.transport.isConnected,
        networkOnline: this.networkManager?.getNetworkState().online ?? true
      });

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize MessageBus', error);
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to initialize message bus: ${error}`,
        'Failed to connect to the messaging service',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send a message (with offline queue support)
   */
  async sendMessage(session: ChatSession, message: string): Promise<Result<DeliveryReceipt>> {
    try {
      const messageId = this.generateMessageId();
      const timestamp = new Date();
      
      // Apply message interceptor if available (for encryption)
      let processedMessage = message;
      if (this.messageInterceptor?.beforeSend) {
        const interceptResult = await this.messageInterceptor.beforeSend(session, message);
        if (!interceptResult.success) {
          this.logger.error('Message interceptor failed', interceptResult.error);
          return createResult.error(interceptResult.error!);
        }
        processedMessage = interceptResult.data!;
      }
      
      const messageObj: Message = {
        sender_wallet: session.peer_wallet, // This should be current user's wallet
        ciphertext: processedMessage,
        timestamp: timestamp.toISOString(),
        session_id: session.session_id,
        content_type: 'text'
      };

      // Store message in local storage first
      if (this.storage) {
        const storeResult = await this.storage.storeMessage(
          session.session_id,
          messageObj,
          this.deviceId
        );
        
        if (!storeResult.success) {
          this.logger.error('Failed to store message locally', storeResult.error);
          return createResult.error(storeResult.error!);
        }
      }

      // Try to send immediately if online and connected
      if (this.isOnline() && this.transport.isConnected) {
        try {
          const sendResult = await this.transport.send(session, processedMessage);
          
          if (sendResult.success) {
            // Update message status to sent
            if (this.storage) {
              await this.storage.updateMessageStatus(
                session.session_id,
                messageId,
                'sent'
              );
            }
            
            return sendResult;
          } else {
            // Failed to send, leave in queue for retry
            this.logger.warn('Failed to send message, queued for retry', sendResult.error);
            return createResult.success({
              messageId,
              timestamp: timestamp.getTime(),
              status: 'queued' as const
            });
          }
        } catch (error) {
          this.logger.warn('Transport send failed, message queued', error);
          return createResult.success({
            messageId,
            timestamp: timestamp.getTime(),
            status: 'queued' as const
          });
        }
      } else {
        // Offline or not connected, message is already queued
        this.logger.info('Message queued for offline delivery', {
          sessionId: session.session_id,
          messageId,
          isOnline: this.isOnline(),
          isConnected: this.transport.isConnected
        });
        
        return createResult.success({
          messageId,
          timestamp: timestamp.getTime(),
          status: 'queued' as const
        });
      }
    } catch (error) {
      this.logger.error('Failed to send message', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to send message: ${error}`,
        'Message sending failed',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send a read receipt for a message (with batching optimization)
   */
  async sendReadReceipt(sessionId: string, messageId: string, status: 'delivered' | 'read'): Promise<Result<void>> {
    try {
      this.logger.debug('Adding read receipt to batch', { sessionId, messageId, status });

      // Add to batch for performance optimization
      if (status === 'read') {
        this.addToReadReceiptBatch(sessionId, messageId);
        return createResult.success(undefined);
      }

      // For 'delivered' status, send immediately as it's typically time-sensitive
      return await this.sendImmediateReadReceipt(sessionId, messageId, status);
    } catch (error) {
      this.logger.error('Failed to send read receipt', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to send read receipt: ${error}`,
        'Failed to send read receipt',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send a read receipt immediately without batching
   */
  private async sendImmediateReadReceipt(sessionId: string, messageId: string, status: 'delivered' | 'read'): Promise<Result<void>> {
    try {
      this.logger.info('Sending immediate read receipt', { sessionId, messageId, status });

      // Create read receipt
      const receipt = {
        messageId,
        status,
        timestamp: Date.now()
      };

      // Send via sync protocol if available
      if (this.syncManager && this.transport instanceof WebSocketTransport) {
        const syncMessage = SyncMessageFactory.createReadReceipt(
          sessionId,
          this.deviceId,
          [receipt]
        );

        const sendResult = await this.transport.sendSyncMessage(syncMessage);
        if (!sendResult.success) {
          this.logger.error('Failed to send read receipt', sendResult.error);
          return sendResult;
        }
      }

      // Store locally for offline sync
      if (this.storage) {
        await this.storage.storeReadReceipt(sessionId, messageId, status);
      }

      // Update local message status
      if (this.database) {
        await this.database.updateMessageStatus(sessionId, messageId, status);
      }

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to send immediate read receipt', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to send immediate read receipt: ${error}`,
        'Failed to send read receipt',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Add a message to the read receipt batch
   */
  private addToReadReceiptBatch(sessionId: string, messageId: string): void {
    // Initialize batch for session if not exists
    if (!this.readReceiptBatch.has(sessionId)) {
      this.readReceiptBatch.set(sessionId, new Set());
    }

    // Add message to batch
    const batch = this.readReceiptBatch.get(sessionId)!;
    batch.add(messageId);

    this.logger.debug('Added to read receipt batch', { 
      sessionId, 
      messageId, 
      batchSize: batch.size 
    });

    // Check if batch is full and should be sent immediately
    if (batch.size >= this.MAX_BATCH_SIZE) {
      this.flushReadReceiptBatch(sessionId);
      return;
    }

    // Clear existing timer for this session
    const existingTimer = this.readReceiptBatchTimer.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to send batch after delay
    const timer = setTimeout(() => {
      this.flushReadReceiptBatch(sessionId);
    }, this.BATCH_DELAY_MS);

    this.readReceiptBatchTimer.set(sessionId, timer);
  }

  /**
   * Flush read receipt batch for a session
   */
  private async flushReadReceiptBatch(sessionId: string): Promise<void> {
    const batch = this.readReceiptBatch.get(sessionId);
    if (!batch || batch.size === 0) {
      return;
    }

    const messageIds = Array.from(batch);
    this.logger.info('Flushing read receipt batch', { 
      sessionId, 
      messageCount: messageIds.length 
    });

    // Clear batch and timer
    this.readReceiptBatch.delete(sessionId);
    const timer = this.readReceiptBatchTimer.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.readReceiptBatchTimer.delete(sessionId);
    }

    // Send batch via existing markMessagesAsRead method
    try {
      const result = await this.markMessagesAsRead(sessionId, messageIds);
      if (result.success) {
        // Reset retry count on successful batch send
        this.batchRetryCount.delete(sessionId);
        this.logger.debug('Read receipt batch sent successfully', { sessionId, messageCount: messageIds.length });
      } else {
        this.logger.error('Failed to flush read receipt batch', result.error);
        
        // Implement exponential backoff retry
        const retryCount = this.batchRetryCount.get(sessionId) || 0;
        if (retryCount < this.MAX_BATCH_RETRIES) {
          this.batchRetryCount.set(sessionId, retryCount + 1);
          const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          
          setTimeout(() => {
            for (const messageId of messageIds) {
              this.addToReadReceiptBatch(sessionId, messageId);
            }
          }, retryDelay);
          
          this.logger.info('Retry scheduled for read receipt batch', { 
            sessionId, 
            retryCount: retryCount + 1, 
            retryDelay 
          });
        } else {
          this.logger.error('Max retries exceeded for read receipt batch', { sessionId });
          this.batchRetryCount.delete(sessionId);
        }
      }
    } catch (error) {
      this.logger.error('Error flushing read receipt batch', error);
      
      // Implement exponential backoff retry for errors
      const retryCount = this.batchRetryCount.get(sessionId) || 0;
      if (retryCount < this.MAX_BATCH_RETRIES) {
        this.batchRetryCount.set(sessionId, retryCount + 1);
        const retryDelay = Math.pow(2, retryCount) * 1000;
        
        setTimeout(() => {
          for (const messageId of messageIds) {
            this.addToReadReceiptBatch(sessionId, messageId);
          }
        }, retryDelay);
      } else {
        this.logger.error('Max retries exceeded for read receipt batch error handling', { sessionId });
        this.batchRetryCount.delete(sessionId);
      }
    }
  }

  /**
   * Mark multiple messages as read
   */
  async markMessagesAsRead(sessionId: string, messageIds: string[]): Promise<Result<void>> {
    try {
      this.logger.info('Marking messages as read', { sessionId, count: messageIds.length });

      const receipts = messageIds.map(messageId => ({
        messageId,
        status: 'read' as const,
        timestamp: Date.now()
      }));

      // Send batch read receipts
      if (this.syncManager && this.transport instanceof WebSocketTransport) {
        const syncMessage = SyncMessageFactory.createReadReceipt(
          sessionId,
          this.deviceId,
          receipts
        );

        const sendResult = await this.transport.sendSyncMessage(syncMessage);
        if (!sendResult.success) {
          this.logger.warn('Failed to send batch read receipts', sendResult.error);
        }
      }

      // Update local storage and database
      if (this.storage || this.database) {
        await Promise.all(messageIds.map(async messageId => {
          if (this.storage) {
            await this.storage.storeReadReceipt(sessionId, messageId, 'read');
          }
          if (this.database) {
            await this.database.updateMessageStatus(sessionId, messageId, 'read');
          }
        }));
      }

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to mark messages as read', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to mark messages as read: ${error}`,
        'Failed to mark messages as read',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Subscribe to messages for a session
   */
  subscribe(sessionId: string, handler: MessageHandler): Result<Subscription> {
    try {
      const subscription = this.transport.subscribe(sessionId, async (message) => {
        // Apply message interceptor if available (for decryption)
        let processedMessage = message;
        if (this.messageInterceptor?.afterReceive) {
          const interceptResult = await this.messageInterceptor.afterReceive(message);
          if (!interceptResult.success) {
            this.logger.warn('Failed to process received message', interceptResult.error);
            // Continue with original message
          } else {
            processedMessage = interceptResult.data!;
          }
        }
        
        // Store received message
        if (this.storage) {
          this.storage.storeMessage(sessionId, processedMessage, 'remote-device')
            .catch(error => this.logger.error('Failed to store received message', error));
        }
        
        // Call handler with processed message
        handler(processedMessage);
      });

      this.subscriptions.set(subscription.id, subscription);
      this.logger.info('Subscribed to session messages', { sessionId, subscriptionId: subscription.id });
      
      // Start sync for this session if sync manager is available
      if (this.syncManager) {
        // Create a minimal session object for sync
        const session: ChatSession = {
          session_id: sessionId,
          peer_wallet: '',  // Will be populated from actual messages
          sharedKey: new Uint8Array(32)
        };
        
        this.syncManager.startSync(session).then(result => {
          if (!result.success) {
            this.logger.warn('Failed to start sync for session', { 
              sessionId, 
              error: result.error 
            });
          } else {
            this.logger.info('Started sync for session', { sessionId });
          }
        });
      }
      
      return createResult.success(subscription);
    } catch (error) {
      this.logger.error('Failed to subscribe to messages', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to subscribe: ${error}`,
        'Message subscription failed',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): Result<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionId);
        this.logger.info('Unsubscribed from messages', { subscriptionId });
      }
      
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to unsubscribe', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to unsubscribe: ${error}`,
        'Unsubscribe failed',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Sync messages from server (fetch missed messages)
   */
  async syncMessages(sessionId?: string): Promise<Result<number>> {
    if (this.syncInProgress) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'Sync already in progress',
        'Message sync is already running'
      ));
    }

    if (!this.isOnline() || !this.transport.isConnected) {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'Cannot sync while offline',
        'No network connection available for sync'
      ));
    }

    try {
      this.syncInProgress = true;
      this.logger.info('Starting message sync', { sessionId });

      let syncedCount = 0;

      if (sessionId) {
        // Use sync manager if available
        if (this.syncManager) {
          const syncResult = await this.syncManager.syncSession(sessionId);
          if (syncResult.success) {
            const stats = syncResult.data!;
            syncedCount = stats.totalMessagesSynced;
            this.logger.info('Sync completed via SyncManager', { sessionId, stats });
          } else {
            return createResult.error(syncResult.error!);
          }
        } else {
          // Fallback to old sync method
          const sessionSyncResult = await this.syncSessionMessages(sessionId);
          if (sessionSyncResult.success) {
            syncedCount = sessionSyncResult.data!;
          }
        }
      } else {
        // Sync all sessions
        if (this.syncManager) {
          // Get all active sessions from subscriptions
          const sessionIds = new Set<string>();
          for (const [subId] of this.subscriptions) {
            const match = subId.match(/^(.+)-\d+$/);
            if (match) {
              sessionIds.add(match[1]);
            }
          }
          
          for (const sid of sessionIds) {
            const result = await this.syncManager.syncSession(sid);
            if (result.success) {
              syncedCount += result.data!.totalMessagesSynced;
            }
          }
        } else {
          this.logger.info('Full sync not implemented yet - sync specific sessions');
        }
      }

      this.lastSyncAt = new Date();
      this.logger.info('Message sync completed', { sessionId, syncedCount, lastSyncAt: this.lastSyncAt });

      return createResult.success(syncedCount);
    } catch (error) {
      this.logger.error('Message sync failed', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Message sync failed: ${error}`,
        'Failed to sync messages from server',
        { error: error?.toString() }
      ));
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get current message bus state
   */
  getState(): MessageBusState {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.transport.isConnected,
      networkState: this.networkManager?.getNetworkState() ?? {
        online: true,
        connectionQuality: 'good',
        lastStateChange: new Date(),
        stateChangeCount: 0
      },
      queuedMessageCount: this.storage?.getQueueStats().totalQueued ?? 0,
      lastSyncAt: this.lastSyncAt,
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Force process all queued messages
   */
  async processQueuedMessages(): Promise<Result<number>> {
    if (!this.storage) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        'Storage not available',
        'Message storage is not initialized'
      ));
    }

    if (!this.isOnline() || !this.transport.isConnected) {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'Cannot process queue while offline',
        'No network connection available'
      ));
    }

    try {
      const queuedResult = await this.storage.getQueuedMessages();
      if (!queuedResult.success || !queuedResult.data) {
        return createResult.success(0);
      }

      const queuedMessages = queuedResult.data;
      let processedCount = 0;

      this.logger.info('Processing queued messages', { count: queuedMessages.length });

      // Group messages by session
      const messagesBySession = new Map<string, any[]>();
      for (const message of queuedMessages) {
        const sessionMessages = messagesBySession.get(message.sessionId) || [];
        sessionMessages.push(message);
        messagesBySession.set(message.sessionId, sessionMessages);
      }

      // Process each session's messages
      for (const [sessionId, messages] of messagesBySession) {
        if (!this.isOnline()) {
          break; // Stop if we go offline during processing
        }

        try {
          await this.processSessionQueuedMessages(sessionId, messages);
          processedCount += messages.length;
        } catch (error) {
          this.logger.error('Failed to process session queue', error, { sessionId });
        }
      }

      this.logger.info('Queued message processing completed', { processedCount });
      return createResult.success(processedCount);
    } catch (error) {
      this.logger.error('Failed to process queued messages', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Queue processing failed: ${error}`,
        'Failed to process message queue',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Update message status
   */
  async updateMessageStatus(messageId: string, status: MessageStatus): Promise<Result<void>> {
    try {
      this.logger.info('Updating message status', { messageId, status });

      let sessionId: string | null = null;

      // Update in database if available
      if (this.database) {
        // Find the session ID for this message
        const sessions = await this.database.getAllSessions();
        
        for (const session of sessions) {
          const messages = await this.database.getMessages(session.session_id);
          if (messages.some(msg => msg.id === messageId)) {
            sessionId = session.session_id;
            break;
          }
        }
        
        if (sessionId) {
          await this.database.updateMessageStatus(sessionId, messageId, status);
        }
      }

      // Update in storage if available
      if (this.storage && sessionId) {
        await this.storage.updateMessageStatus(sessionId, messageId, status);
      }

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to update message status', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to update message status: ${error}`,
        'Failed to update message status',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Batch update message statuses
   */
  async batchUpdateMessageStatus(updates: MessageStatusUpdate[]): Promise<Result<void>> {
    try {
      this.logger.info('Batch updating message statuses', { count: updates.length });

      // Group updates by session
      const updatesBySession = new Map<string, MessageStatusUpdate[]>();
      
      for (const update of updates) {
        // Find session for each message
        if (this.database) {
          const sessions = await this.database.getAllSessions();
          for (const session of sessions) {
            const messages = await this.database.getMessages(session.session_id);
            if (messages.some(msg => msg.id === update.messageId)) {
              const sessionUpdates = updatesBySession.get(session.session_id) || [];
              sessionUpdates.push(update);
              updatesBySession.set(session.session_id, sessionUpdates);
              break;
            }
          }
        }
      }

      // Apply updates for each session
      for (const [sessionId, sessionUpdates] of updatesBySession) {
        for (const update of sessionUpdates) {
          if (this.database) {
            await this.database.updateMessageStatus(sessionId, update.messageId, update.status);
          }
          if (this.storage) {
            await this.storage.updateMessageStatus(sessionId, update.messageId, update.status);
          }
        }
      }

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to batch update message statuses', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to batch update message statuses: ${error}`,
        'Failed to update message statuses',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<Result<MessageStatus | null>> {
    try {
      if (this.database) {
        const sessions = await this.database.getAllSessions();
        
        for (const session of sessions) {
          const messages = await this.database.getMessages(session.session_id);
          const message = messages.find(msg => msg.id === messageId);
          
          if (message) {
            return createResult.success(message.status || MessageStatus.SENT);
          }
        }
      }

      return createResult.success(null);
    } catch (error) {
      this.logger.error('Failed to get message status', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get message status: ${error}`,
        'Failed to get message status',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Broadcast status update to other devices
   */
  async broadcastStatusUpdate(update: MessageStatusUpdate): Promise<Result<void>> {
    try {
      this.logger.info('Broadcasting status update', update);

      // Send via WebSocket relay if status tracking is enabled
      if (this.config.enableStatusTracking && this.transport instanceof WebSocketTransport) {
        // Find session ID for this message
        let sessionId: string | null = null;
        if (this.database) {
          const sessions = await this.database.getAllSessions();
          for (const session of sessions) {
            const messages = await this.database.getMessages(session.session_id);
            if (messages.some(msg => msg.id === update.messageId)) {
              sessionId = session.session_id;
              break;
            }
          }
        }

        if (sessionId) {
          // Create relay status update message
          const relayMessage = {
            type: 'status_update',
            messageId: update.messageId,
            status: update.status,
            timestamp: update.timestamp,
            roomId: sessionId
          };

          // Send directly via WebSocket transport
          try {
            await this.transport.sendRawMessage(relayMessage);
            this.logger.debug('Status update sent via WebSocket relay', relayMessage);
          } catch (relayError) {
            this.logger.warn('Failed to send status update via relay, falling back to sync protocol', relayError);
            
            // Fallback to sync protocol
            if (this.syncManager) {
              const syncMessage = SyncMessageFactory.createStatusUpdate(
                this.deviceId,
                [update]
              );
              const sendResult = await this.transport.sendSyncMessage(syncMessage);
              if (!sendResult.success) {
                this.logger.error('Failed to broadcast status update via sync protocol', sendResult.error);
                return sendResult;
              }
            }
          }
        } else {
          this.logger.warn('Cannot broadcast status update - session not found for message', update.messageId);
        }
      }

      // Notify local status update handlers
      this.notifyStatusUpdateHandlers(update);

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to broadcast status update', error);
      return createResult.error(SolConnectError.network(
        ErrorCode.MESSAGE_DELIVERY_FAILED,
        `Failed to broadcast status update: ${error}`,
        'Failed to broadcast status update',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Subscribe to message status updates
   */
  onStatusUpdate(handler: (update: MessageStatusUpdate) => void): string {
    const id = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.messageStatusEventHandlers.set(id, handler);
    this.logger.debug('Registered status update handler', { id });
    return id;
  }

  /**
   * Unsubscribe from message status updates
   */
  offStatusUpdate(handlerId: string): void {
    this.messageStatusEventHandlers.delete(handlerId);
    this.logger.debug('Unregistered status update handler', { handlerId });
  }

  /**
   * Notify all status update handlers
   */
  private notifyStatusUpdateHandlers(update: MessageStatusUpdate): void {
    // Call global callback if set
    if (this.statusUpdateCallback) {
      try {
        this.statusUpdateCallback(update);
      } catch (error) {
        this.logger.error('Error in global status update callback', error);
      }
    }

    // Call individual handlers
    this.messageStatusEventHandlers.forEach((handler, id) => {
      try {
        handler(update);
      } catch (error) {
        this.logger.error('Error in status update handler', error, { handlerId: id });
      }
    });
  }

  // ===================================================================
  // REACTION METHODS
  // ===================================================================

  /**
   * Add a reaction to a message
   */
  async addReaction(
    messageId: string,
    sessionId: string,
    userAddress: string,
    emoji: string
  ): Promise<Result<{ action: 'added' | 'removed'; reaction?: any }>> {
    try {
      this.logger.info('Adding reaction to message', { messageId, sessionId, userAddress, emoji });

      // Use ReactionService to add the reaction
      const reactionResult = await this.reactionService.toggleReaction(messageId, userAddress, emoji);
      
      if (!reactionResult.success) {
        return createResult.error(reactionResult.error!);
      }

      const result = reactionResult.data!;

      // Create reaction event
      const reactionEvent: ReactionEvent = {
        type: result.action === 'added' ? 'reaction_added' : 'reaction_removed',
        messageId,
        sessionId,
        emoji,
        userAddress,
        timestamp: new Date().toISOString()
      };

      // Broadcast reaction event to other devices
      await this.broadcastReactionEvent(reactionEvent);

      // Notify local reaction event handlers
      this.notifyReactionEventHandlers(reactionEvent);

      this.logger.info('Reaction processed successfully', { 
        messageId, 
        action: result.action, 
        emoji 
      });

      return createResult.success(result);
    } catch (error) {
      this.logger.error('Failed to add reaction', error);
      return createResult.error(
        new SolConnectError(
          'system' as any,
          ErrorCode.UNKNOWN_ERROR,
          `Failed to add reaction: ${error}`,
          'Unable to add reaction. Please try again.',
          true,
          { messageId, sessionId, userAddress, emoji, originalError: error.message }
        )
      );
    }
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(
    messageId: string,
    sessionId: string,
    userAddress: string,
    emoji: string
  ): Promise<Result<void>> {
    try {
      this.logger.info('Removing reaction from message', { messageId, sessionId, userAddress, emoji });

      // Use ReactionService to remove the reaction
      const reactionResult = await this.reactionService.removeReaction(messageId, userAddress, emoji);
      
      if (!reactionResult.success) {
        return createResult.error(reactionResult.error!);
      }

      // Create reaction event
      const reactionEvent: ReactionEvent = {
        type: 'reaction_removed',
        messageId,
        sessionId,
        emoji,
        userAddress,
        timestamp: new Date().toISOString()
      };

      // Broadcast reaction event to other devices
      await this.broadcastReactionEvent(reactionEvent);

      // Notify local reaction event handlers
      this.notifyReactionEventHandlers(reactionEvent);

      this.logger.info('Reaction removed successfully', { messageId, emoji });
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to remove reaction', error);
      return createResult.error(
        new SolConnectError(
          'system' as any,
          ErrorCode.UNKNOWN_ERROR,
          `Failed to remove reaction: ${error}`,
          'Unable to remove reaction. Please try again.',
          true,
          { messageId, sessionId, userAddress, emoji, originalError: error.message }
        )
      );
    }
  }

  /**
   * Get all reactions for a message
   */
  async getMessageReactions(
    messageId: string,
    currentUserAddress?: string
  ): Promise<Result<ReactionSummary[]>> {
    try {
      this.logger.debug('Getting reactions for message', { messageId });

      const reactionResult = await this.reactionService.getMessageReactions(messageId, currentUserAddress);
      
      if (!reactionResult.success) {
        return createResult.error(reactionResult.error!);
      }

      this.logger.debug('Retrieved reactions for message', { 
        messageId, 
        reactionCount: reactionResult.data!.length 
      });

      return createResult.success(reactionResult.data!);
    } catch (error) {
      this.logger.error('Failed to get message reactions', error);
      return createResult.error(
        new SolConnectError(
          'system' as any,
          ErrorCode.STORAGE_ERROR,
          `Failed to get message reactions: ${error}`,
          'Unable to load reactions. Please try again.',
          true,
          { messageId, originalError: error.message }
        )
      );
    }
  }

  /**
   * Get user's recent emojis for quick picker
   */
  async getUserRecentEmojis(
    userAddress: string,
    limit: number = 8
  ): Promise<Result<Array<{ emoji: string; usageCount: number; lastUsedAt: Date }>>> {
    try {
      this.logger.debug('Getting user recent emojis', { userAddress, limit });

      const recentResult = await this.reactionService.getUserRecentEmojis(userAddress, limit);
      
      if (!recentResult.success) {
        return createResult.error(recentResult.error!);
      }

      this.logger.debug('Retrieved user recent emojis', { 
        userAddress, 
        emojiCount: recentResult.data!.length 
      });

      return createResult.success(recentResult.data!);
    } catch (error) {
      this.logger.error('Failed to get user recent emojis', error);
      return createResult.error(
        new SolConnectError(
          'system' as any,
          ErrorCode.STORAGE_ERROR,
          `Failed to get recent emojis: ${error}`,
          'Unable to load recent emojis. Please try again.',
          true,
          { userAddress, originalError: error.message }
        )
      );
    }
  }

  /**
   * Broadcast reaction event to other devices/users
   */
  private async broadcastReactionEvent(event: ReactionEvent): Promise<void> {
    try {
      this.logger.debug('Broadcasting reaction event', event);

      // Send via WebSocket relay if connected
      if (this.transport instanceof WebSocketTransport && this.transport.isConnected) {
        // Create relay message for reaction event
        const relayMessage = {
          type: 'reaction_event',
          reactionEvent: event,
          roomId: event.sessionId
        };

        try {
          await this.transport.sendRawMessage(relayMessage);
          this.logger.debug('Reaction event sent via WebSocket relay', relayMessage);
        } catch (relayError) {
          this.logger.warn('Failed to send reaction event via relay, falling back to sync protocol', relayError);
          
          // Fallback to sync protocol if available
          if (this.syncManager) {
            const syncMessage = {
              type: 'reaction_sync',
              deviceId: this.deviceId,
              sessionId: event.sessionId,
              reactionEvent: event,
              timestamp: Date.now()
            };
            
            const sendResult = await this.transport.sendSyncMessage(syncMessage);
            if (!sendResult.success) {
              this.logger.error('Failed to broadcast reaction event via sync protocol', sendResult.error);
            }
          }
        }
      } else {
        this.logger.debug('Transport not connected, reaction event will be synced later', event);
      }
    } catch (error) {
      this.logger.error('Failed to broadcast reaction event', error);
    }
  }

  /**
   * Subscribe to reaction events
   */
  onReactionEvent(handler: ReactionEventHandler): string {
    const id = `reaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.reactionEventHandlers.set(id, handler);
    this.logger.debug('Registered reaction event handler', { id });
    return id;
  }

  /**
   * Unsubscribe from reaction events
   */
  offReactionEvent(handlerId: string): void {
    this.reactionEventHandlers.delete(handlerId);
    this.logger.debug('Unregistered reaction event handler', { handlerId });
  }

  /**
   * Notify all reaction event handlers
   */
  private notifyReactionEventHandlers(event: ReactionEvent): void {
    this.reactionEventHandlers.forEach((handler, id) => {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Error in reaction event handler', error, { handlerId: id });
      }
    });
  }

  /**
   * Get stored messages for a session
   */
  async getStoredMessages(sessionId: string, limit?: number): Promise<Result<Message[]>> {
    if (!this.storage) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        'Storage not initialized',
        'Message storage is not available'
      ));
    }

    const result = await this.storage.getMessages(sessionId, limit);
    if (result.success) {
      // Convert StoredMessage to Message format
      const messages: Message[] = result.data!.map(stored => ({
        sender_wallet: stored.sender_wallet,
        ciphertext: stored.ciphertext,
        timestamp: stored.timestamp,
        session_id: stored.session_id,
        content_type: stored.content_type
      }));
      return createResult.success(messages);
    }

    return createResult.error(result.error!);
  }

  /**
   * Clear stored messages for a session
   */
  async clearStoredMessages(sessionId: string): Promise<Result<void>> {
    if (!this.storage) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        'Storage not initialized',
        'Message storage is not available'
      ));
    }

    return await this.storage.clearSession(sessionId);
  }

  /**
   * Export all messages for backup
   */
  async exportMessages(): Promise<Result<string>> {
    if (!this.storage) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        'Storage not initialized',
        'Message storage is not available'
      ));
    }

    return await this.storage.exportMessages();
  }

  /**
   * Import messages from backup
   */
  async importMessages(data: string): Promise<Result<number>> {
    if (!this.storage) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        'Storage not initialized',
        'Message storage is not available'
      ));
    }

    return await this.storage.importMessages(data);
  }

  /**
   * Process raw protocol message (for use by transport layer)
   */
  async processProtocolMessage(data: Uint8Array): Promise<Result<void>> {
    if (!this.protocolMessageHandler) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'Protocol message handler not initialized',
        'Cannot process protocol messages'
      ));
    }

    return await this.protocolMessageHandler.processMessage(data);
  }

  /**
   * Get current connection status
   */
  get connectionStatus() {
    return this.transport.connectionStatus;
  }

  /**
   * Check if ready to send messages
   */
  get isReady(): boolean {
    return this.isInitialized && this.transport.isConnected;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<Result<void>> {
    try {
      this.logger.info('Disconnecting MessageBus');

      // Stop all sync operations
      if (this.syncManager) {
        // Stop sync for all active sessions
        const sessionIds = new Set<string>();
        for (const [subId] of this.subscriptions) {
          const match = subId.match(/^(.+)-\d+$/);
          if (match) {
            sessionIds.add(match[1]);
          }
        }
        
        for (const sessionId of sessionIds) {
          await this.syncManager.stopSync(sessionId);
        }
        
        // Shutdown sync manager
        await this.syncManager.shutdown();
      }

      // Unsubscribe all
      for (const subscriptionId of this.subscriptions.keys()) {
        this.unsubscribe(subscriptionId);
      }

      // Cleanup network state integration
      if (this.networkStateListener) {
        this.networkStateListener();
      }
      if (this.queueProcessorUnsubscribe) {
        this.queueProcessorUnsubscribe();
      }

      // Disconnect transport
      const result = await this.transport.disconnect();
      
      // Cleanup storage
      if (this.storage) {
        this.storage.destroy();
      }

      // Cleanup network manager
      if (this.networkManager) {
        this.networkManager.destroy();
      }

      // Cleanup read receipt batching
      this.cleanupReadReceiptBatches();

      this.isInitialized = false;
      this.messageQueue = [];
      this.syncInProgress = false;

      this.logger.info('MessageBus disconnected successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to disconnect MessageBus', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to disconnect: ${error}`,
        'Error occurred while disconnecting',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Cleanup read receipt batching resources
   */
  private cleanupReadReceiptBatches(): void {
    // Clear all batch timers
    for (const [sessionId, timer] of this.readReceiptBatchTimer) {
      clearTimeout(timer);
      this.logger.debug('Cleared read receipt batch timer', { sessionId });
    }
    
    // Clear all batches
    this.readReceiptBatch.clear();
    this.readReceiptBatchTimer.clear();
    this.batchRetryCount.clear();
    
    this.logger.info('Read receipt batching cleanup completed');
  }

  // Private methods

  private async connectTransport(): Promise<Result<any>> {
    try {
      return await this.transport.connect(this.config.relayEndpoint);
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Transport connection failed: ${error}`,
        'Failed to connect to relay server',
        { error: error?.toString() }
      ));
    }
  }

  private setupNetworkStateIntegration(): void {
    if (!this.networkManager) return;

    // Listen for network state changes
    this.networkStateListener = this.networkManager.addEventListener((state) => {
      this.logger.info('Network state changed', state);

      if (state.online && this.transport.isConnected) {
        // Network is back online and transport is connected
        this.processPendingMessages()
          .then(() => this.logger.info('Processed pending messages after coming online'))
          .catch((error) => this.logger.error('Failed to process pending messages', error));
      }
    });

    // Subscribe to sync messages and relay events
    if (this.transport) {
      this.transport.onSyncMessage((message) => {
        if (message.type === 'read_receipt_sync') {
          const readReceiptSync = message as any; // Type will be ReadReceiptSyncMessage
          this.handleIncomingReadReceipts(readReceiptSync).catch(error => 
            this.logger.error('Failed to handle incoming read receipts', error)
          );
        }
      });

      // Handle incoming status updates from WebSocket relay
      if (this.config.enableStatusTracking) {
        this.transport.onRelayMessage((message) => {
          this.handleIncomingRelayMessage(message).catch(error =>
            this.logger.error('Failed to handle incoming relay message', error)
          );
        });
      }
    }
  }

  private async handleIncomingReadReceipts(message: any): Promise<void> {
    try {
      const receipts = message.receipts || [];
      
      for (const receipt of receipts) {
        // Update local message status
        if (this.database) {
          await this.database.updateMessageStatus(
            message.sessionId,
            receipt.messageId,
            receipt.status,
            receipt.timestamp
          );
        }
        
        // Notify UI of status update
        this.logger.info('Received read receipt', {
          messageId: receipt.messageId,
          status: receipt.status,
          from: receipt.readerWallet
        });
      }
    } catch (error) {
      this.logger.error('Error processing read receipts', error);
    }
  }

  private async handleIncomingRelayMessage(message: any): Promise<void> {
    try {
      this.logger.debug('Handling incoming relay message', { type: message.type });

      switch (message.type) {
        case 'status_update':
          await this.handleIncomingStatusUpdate(message);
          break;
          
        case 'delivery_receipt':
          await this.handleIncomingDeliveryReceipt(message);
          break;
          
        case 'read_receipt':
          await this.handleIncomingReadReceiptRelay(message);
          break;
          
        case 'typing_indicator':
          await this.handleIncomingTypingIndicator(message);
          break;
          
        case 'reaction_event':
          await this.handleIncomingReactionEvent(message);
          break;
          
        default:
          this.logger.debug('Unknown relay message type', { type: message.type });
      }
    } catch (error) {
      this.logger.error('Error handling incoming relay message', error);
    }
  }

  private async handleIncomingStatusUpdate(message: any): Promise<void> {
    try {
      const { messageId, status, timestamp } = message;
      
      this.logger.info('Received status update', { messageId, status, timestamp });

      // Update local database
      if (this.database && message.roomId) {
        await this.database.updateMessageStatus(message.roomId, messageId, status, timestamp);
      }

      // Update storage
      if (this.storage && message.roomId) {
        await this.storage.updateMessageStatus(message.roomId, messageId, status);
      }

      // Create status update object
      const statusUpdate: MessageStatusUpdate = {
        messageId,
        status,
        timestamp: timestamp || new Date().toISOString()
      };

      // Notify handlers
      this.notifyStatusUpdateHandlers(statusUpdate);
    } catch (error) {
      this.logger.error('Error handling incoming status update', error);
    }
  }

  private async handleIncomingDeliveryReceipt(message: any): Promise<void> {
    try {
      const { originalMessageId, recipientWallet, timestamp } = message;
      
      this.logger.info('Received delivery receipt', { 
        originalMessageId, 
        recipientWallet, 
        timestamp 
      });

      // Update message status to delivered
      const statusUpdate: MessageStatusUpdate = {
        messageId: originalMessageId,
        status: MessageStatus.DELIVERED,
        timestamp: timestamp || new Date().toISOString()
      };

      // Update local storage
      if (this.database && message.roomId) {
        await this.database.updateMessageStatus(
          message.roomId, 
          originalMessageId, 
          MessageStatus.DELIVERED, 
          timestamp
        );
      }

      // Notify handlers
      this.notifyStatusUpdateHandlers(statusUpdate);
    } catch (error) {
      this.logger.error('Error handling delivery receipt', error);
    }
  }

  private async handleIncomingReadReceiptRelay(message: any): Promise<void> {
    try {
      const { originalMessageId, readerWallet, timestamp } = message;
      
      this.logger.info('Received read receipt from relay', { 
        originalMessageId, 
        readerWallet, 
        timestamp 
      });

      // Update message status to read
      const statusUpdate: MessageStatusUpdate = {
        messageId: originalMessageId,
        status: MessageStatus.READ,
        timestamp: timestamp || new Date().toISOString()
      };

      // Update local storage
      if (this.database && message.roomId) {
        await this.database.updateMessageStatus(
          message.roomId, 
          originalMessageId, 
          MessageStatus.READ, 
          timestamp
        );
      }

      // Notify handlers
      this.notifyStatusUpdateHandlers(statusUpdate);
    } catch (error) {
      this.logger.error('Error handling read receipt from relay', error);
    }
  }

  private async handleIncomingTypingIndicator(message: any): Promise<void> {
    try {
      const { userWallet, isTyping, roomId } = message;
      
      this.logger.debug('Received typing indicator', { 
        userWallet, 
        isTyping, 
        roomId 
      });

      // Notify typing indicator handlers (if implemented)
      // This could be extended to support typing indicators in the UI
      
    } catch (error) {
      this.logger.error('Error handling typing indicator', error);
    }
  }

  private async handleIncomingReactionEvent(message: any): Promise<void> {
    try {
      const reactionEvent = message.reactionEvent as ReactionEvent;
      
      this.logger.info('Received reaction event', reactionEvent);

      // Update local database/storage if needed
      // The reaction is already handled by the original sender, but we might want to
      // store/cache reaction data locally for offline scenarios

      // Notify reaction event handlers
      this.notifyReactionEventHandlers(reactionEvent);
      
    } catch (error) {
      this.logger.error('Error handling incoming reaction event', error);
    }
  }

  private async handleQueuedMessages(sessionId: string, messages: any[]): Promise<void> {
    if (sessionId === '*') {
      // Process all queued messages
      await this.processQueuedMessages();
    } else {
      // Process specific session
      await this.processSessionQueuedMessages(sessionId, messages);
    }
  }

  private async processSessionQueuedMessages(sessionId: string, messages: any[]): Promise<void> {
    if (!this.transport.isConnected || !this.storage) {
      return;
    }

    for (const message of messages) {
      if (!this.isOnline()) {
        break; // Stop if we go offline
      }

      try {
        // Create session object for transport
        const session: ChatSession = {
          session_id: sessionId,
          peer_wallet: message.sender_wallet,
          sharedKey: new Uint8Array(32) // Placeholder
        };

        // Try to send the message
        const sendResult = await this.transport.send(session, message.ciphertext);
        
        if (sendResult.success) {
          // Update message status to sent and remove from queue
          await this.storage.updateMessageStatus(sessionId, message.id, 'sent');
          await this.storage.removeFromQueue(sessionId, message.id);
          
          this.logger.debug('Queued message sent successfully', {
            sessionId,
            messageId: message.id
          });
        } else {
          // Update retry count and status
          await this.storage.updateMessageStatus(
            sessionId,
            message.id,
            'failed',
            sendResult.error?.message
          );
          
          this.logger.warn('Failed to send queued message', {
            sessionId,
            messageId: message.id,
            error: sendResult.error
          });
        }
      } catch (error) {
        this.logger.error('Error processing queued message', error, {
          sessionId,
          messageId: message.id
        });
      }
    }
  }

  private async syncSessionMessages(sessionId: string): Promise<Result<number>> {
    // Placeholder for server sync implementation
    // In a real implementation, this would:
    // 1. Get last sync timestamp for session
    // 2. Request messages from server since last sync
    // 3. Store received messages locally
    // 4. Update sync timestamp
    
    this.logger.info('Session message sync not yet implemented', { sessionId });
    return createResult.success(0);
  }

  private async processPendingMessages(): Promise<void> {
    if (!this.storage) return;

    try {
      const pendingResult = await this.storage.getPendingMessages();
      if (pendingResult.success && pendingResult.data && pendingResult.data.length > 0) {
        this.logger.info('Found pending messages from previous session', {
          count: pendingResult.data.length
        });
        
        // Process pending messages if online
        if (this.isOnline() && this.transport.isConnected) {
          await this.processQueuedMessages();
        }
      }
    } catch (error) {
      this.logger.error('Failed to process pending messages', error);
    }
  }

  private isOnline(): boolean {
    return this.networkManager?.getNetworkState().online ?? true;
  }

  private generateMessageId(): string {
    return `msg_${this.deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeviceId(): string {
    // Generate a unique device ID
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 9);
    const platform = typeof window !== 'undefined' ? 'web' : 'mobile';
    return `${platform}_${timestamp}_${random}`;
  }
}

// Singleton instance
let globalMessageBus: MessageBus | null = null;

/**
 * Initialize and get the global message bus instance
 */
export async function initializeMessageBus(config: MessageBusConfig): Promise<Result<MessageBus>> {
  try {
    const messageBus = new MessageBus(config);
    const initResult = await messageBus.initialize();
    
    if (!initResult.success) {
      return createResult.error(initResult.error!);
    }
    
    globalMessageBus = messageBus;
    return createResult.success(messageBus);
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.UNKNOWN_ERROR,
      `Failed to initialize MessageBus: ${error}`,
      'Failed to initialize message bus',
      { error: error?.toString() }
    ));
  }
}

/**
 * Get the global message bus instance
 */
export function getMessageBus(config?: MessageBusConfig): MessageBus {
  if (!globalMessageBus) {
    if (!config) {
      throw new Error('MessageBus not initialized. Call initializeMessageBus first.');
    }
    globalMessageBus = new MessageBus(config);
  }
  return globalMessageBus;
}

/**
 * Cleanup the global message bus instance
 */
export async function cleanupMessageBus(): Promise<Result<void>> {
  if (globalMessageBus) {
    const result = await globalMessageBus.disconnect();
    globalMessageBus = null;
    return result;
  }
  
  return createResult.success(undefined);
}