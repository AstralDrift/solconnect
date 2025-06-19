/**
 * Unified Message Bus for SolConnect with Enhanced Offline Sync
 * Coordinates between transport layer, encryption, state management, and network monitoring
 */

import { ChatSession, Message } from '../types';
import { SolConnectError, ErrorCode, Result, createResult } from '../types/errors';
import { MessageTransport, TransportFactory, DeliveryReceipt, MessageHandler, Subscription } from './transport/MessageTransport';
import { MessageStorage, getMessageStorage } from './storage/MessageStorage';
import { NetworkStateManager, getNetworkStateManager, NetworkState } from './network/NetworkStateManager';
import { Logger } from './monitoring/Logger';

export interface MessageBusConfig {
  relayEndpoint: string;
  transportType?: 'websocket' | 'quic';
  enableEncryption?: boolean;
  messageRetryAttempts?: number;
  connectionTimeout?: number;
  enablePersistence?: boolean;
  enableNetworkManager?: boolean;
  deviceId?: string;
}

export interface MessageBusState {
  isInitialized: boolean;
  isConnected: boolean;
  networkState: NetworkState;
  queuedMessageCount: number;
  lastSyncAt?: Date;
  syncInProgress: boolean;
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
  
  // Sync state
  private syncInProgress = false;
  private lastSyncAt?: Date;
  private syncQueue = new Map<string, Set<string>>(); // sessionId -> Set of messageIds being synced
  
  // Network state listeners
  private networkStateListener?: () => void;
  private queueProcessorUnsubscribe?: () => void;

  constructor(config: MessageBusConfig) {
    this.config = {
      transportType: 'websocket',
      enableEncryption: true,
      messageRetryAttempts: 3,
      connectionTimeout: 10000,
      enablePersistence: true,
      enableNetworkManager: true,
      deviceId: this.generateDeviceId(),
      ...config
    };

    this.deviceId = this.config.deviceId;
    this.transport = TransportFactory.create(this.config.transportType);
  }

  /**
   * Initialize the message bus and establish connection
   */
  async initialize(): Promise<Result<void>> {
    if (this.isInitialized) {
      return createResult.success(undefined);
    }

    try {
      this.logger.info('Initializing MessageBus with offline sync', {
        deviceId: this.deviceId,
        enableNetworkManager: this.config.enableNetworkManager
      });

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
      
      const messageObj: Message = {
        sender_wallet: session.peer_wallet, // This should be current user's wallet
        ciphertext: message,
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
          const sendResult = await this.transport.send(session, message);
          
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
   * Subscribe to messages for a session
   */
  subscribe(sessionId: string, handler: MessageHandler): Result<Subscription> {
    try {
      const subscription = this.transport.subscribe(sessionId, (message) => {
        // Store received message
        if (this.storage) {
          this.storage.storeMessage(sessionId, message, 'remote-device')
            .catch(error => this.logger.error('Failed to store received message', error));
        }
        
        // Call handler
        handler(message);
      });

      this.subscriptions.set(subscription.id, subscription);
      this.logger.info('Subscribed to session messages', { sessionId, subscriptionId: subscription.id });
      
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
        // Sync specific session
        const sessionSyncResult = await this.syncSessionMessages(sessionId);
        if (sessionSyncResult.success) {
          syncedCount = sessionSyncResult.data!;
        }
      } else {
        // Sync all sessions (placeholder - would need server API to list sessions)
        this.logger.info('Full sync not implemented yet - sync specific sessions');
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
    this.networkStateListener = this.networkManager.addEventListener((networkState) => {
      this.logger.info('Network state changed', networkState);

      if (networkState.online && !this.transport.isConnected) {
        // Network came online, try to reconnect transport
        this.connectTransport().then(result => {
          if (result.success) {
            this.logger.info('Transport reconnected after network restoration');
            // Process queued messages
            this.processQueuedMessages();
          } else {
            this.logger.warn('Failed to reconnect transport after network restoration', result.error);
          }
        });
      }
    });

    // Register queue processor with network manager
    this.queueProcessorUnsubscribe = this.networkManager.registerQueueProcessor(
      this.handleQueuedMessages.bind(this)
    );
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