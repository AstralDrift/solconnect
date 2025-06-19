/**
 * Unified Message Bus for SolConnect
 * Coordinates between transport layer, encryption, and state management
 */

import { ChatSession, Message } from '../types';
import { SolConnectError, ErrorCode, Result, createResult } from '../types/errors';
import { MessageTransport, TransportFactory, DeliveryReceipt, MessageHandler, Subscription } from './transport/MessageTransport';
import { MessageStorage, getMessageStorage } from './storage/MessageStorage';

export interface MessageBusConfig {
  relayEndpoint: string;
  transportType?: 'websocket' | 'quic';
  enableEncryption?: boolean;
  messageRetryAttempts?: number;
  connectionTimeout?: number;
  enablePersistence?: boolean;
}

export interface EncryptedMessage {
  sessionId: string;
  encryptedPayload: string;
  nonce: string;
  timestamp: number;
  messageId: string;
}

/**
 * Central message bus that coordinates all messaging operations
 */
export class MessageBus {
  private transport: MessageTransport;
  private config: Required<MessageBusConfig>;
  private isInitialized = false;
  private messageQueue: Array<{ session: ChatSession; message: string; resolve: Function; reject: Function }> = [];
  private subscriptions = new Map<string, Subscription>();
  private storage?: MessageStorage;

  constructor(config: MessageBusConfig) {
    this.config = {
      transportType: 'websocket',
      enableEncryption: true,
      messageRetryAttempts: 3,
      connectionTimeout: 10000,
      enablePersistence: true,
      ...config
    };

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
      // Initialize storage if persistence is enabled
      if (this.config.enablePersistence) {
        this.storage = getMessageStorage();
        const storageResult = await this.storage.initialize();
        if (!storageResult.success) {
          console.warn('Failed to initialize message storage:', storageResult.error);
          // Continue without persistence
        }
      }

      const connectionResult = await this.transport.connect(this.config.relayEndpoint);
      
      if (!connectionResult.success) {
        return createResult.error(connectionResult.error!);
      }

      this.isInitialized = true;

      // Process any queued messages
      await this.processQueuedMessages();

      // Process any pending messages from storage
      if (this.storage) {
        await this.processPendingMessages();
      }

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to initialize message bus: ${error}`,
        'Failed to connect to the messaging service',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send a message through the bus
   */
  async sendMessage(session: ChatSession, plaintext: string): Promise<Result<DeliveryReceipt>> {
    // Validate input
    if (!plaintext.trim()) {
      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Empty message',
        'Message cannot be empty'
      ));
    }

    if (plaintext.length > 10000) { // 10KB limit
      return createResult.error(SolConnectError.validation(
        ErrorCode.MESSAGE_TOO_LARGE,
        `Message size ${plaintext.length} exceeds limit`,
        'Message is too long. Please shorten your message.',
        { size: plaintext.length, limit: 10000 }
      ));
    }

    // Queue message if not initialized
    if (!this.isInitialized) {
      return new Promise((resolve, reject) => {
        this.messageQueue.push({ session, message: plaintext, resolve, reject });
      });
    }

    try {
      let messageToSend = plaintext;

      // Apply encryption if enabled
      if (this.config.enableEncryption) {
        const encryptionResult = await this.encryptMessage(session, plaintext);
        if (!encryptionResult.success) {
          return createResult.error(encryptionResult.error!);
        }
        messageToSend = encryptionResult.data!;
      }

      // Store message if persistence is enabled
      if (this.storage) {
        const message: Message = {
          sender_wallet: 'self', // This should be the current user's wallet
          ciphertext: messageToSend,
          timestamp: new Date().toISOString(),
          session_id: session.session_id
        };
        
        const storeResult = await this.storage.storeMessage(session.session_id, message);
        if (!storeResult.success) {
          console.warn('Failed to store message:', storeResult.error);
        }
      }

      // Send through transport with retry logic
      const sendResult = await this.sendWithRetry(session, messageToSend);
      
      // Update message status in storage
      if (this.storage && sendResult.success) {
        await this.storage.updateMessageStatus(
          session.session_id,
          sendResult.data!.messageId,
          'sent'
        );
      }

      return sendResult;
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to send message: ${error}`,
        'An unexpected error occurred while sending the message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Subscribe to messages for a specific session
   */
  subscribeToMessages(sessionId: string, handler: MessageHandler): Result<Subscription> {
    try {
      // Wrap handler to decrypt messages if needed
      const wrappedHandler: MessageHandler = async (message: Message) => {
        try {
          let processedMessage = message;

          if (this.config.enableEncryption && message.ciphertext) {
            const decryptionResult = await this.decryptMessage(message);
            if (decryptionResult.success) {
              processedMessage = {
                ...message,
                ciphertext: decryptionResult.data!
              };
            } else {
              console.error('Failed to decrypt message:', decryptionResult.error);
              // Still pass the encrypted message to handler
            }
          }

          // Store received message if persistence is enabled
          if (this.storage) {
            const storeResult = await this.storage.storeMessage(sessionId, processedMessage);
            if (!storeResult.success) {
              console.warn('Failed to store received message:', storeResult.error);
            }
          }

          handler(processedMessage);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      };

      const subscription = this.transport.subscribe(sessionId, wrappedHandler);
      this.subscriptions.set(subscription.id, subscription);

      return createResult.success(subscription);
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
   * Get stored messages for a session
   */
  async getStoredMessages(sessionId: string, limit?: number): Promise<Result<Message[]>> {
    if (!this.storage) {
      return createResult.success([]);
    }

    const result = await this.storage.getMessages(sessionId, limit);
    if (result.success) {
      // Convert stored messages back to regular messages
      const messages: Message[] = result.data!.map(stored => ({
        sender_wallet: stored.sender_wallet,
        ciphertext: stored.ciphertext,
        timestamp: stored.timestamp,
        session_id: stored.session_id
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
      return createResult.success(undefined);
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
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): Result<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionId);
      }
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to unsubscribe: ${error}`,
        'Failed to unsubscribe from messages',
        { error: error?.toString() }
      ));
    }
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
      // Unsubscribe all
      for (const subscriptionId of this.subscriptions.keys()) {
        this.unsubscribe(subscriptionId);
      }

      // Disconnect transport
      const result = await this.transport.disconnect();
      
      // Cleanup storage
      if (this.storage) {
        this.storage.destroy();
      }

      this.isInitialized = false;
      this.messageQueue = [];

      return result;
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to disconnect: ${error}`,
        'Error occurred while disconnecting',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Encrypt a message
   */
  private async encryptMessage(session: ChatSession, plaintext: string): Promise<Result<string>> {
    try {
      // Simplified encryption - in production, use proper encryption
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      // For demo purposes, just base64 encode
      // In production, use session.sharedKey with ChaCha20-Poly1305
      const encrypted = btoa(String.fromCharCode(...data));
      
      return createResult.success(encrypted);
    } catch (error) {
      return createResult.error(SolConnectError.crypto(
        ErrorCode.ENCRYPTION_FAILED,
        `Encryption failed: ${error}`,
        'Failed to encrypt message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Decrypt a message
   */
  private async decryptMessage(message: Message): Promise<Result<string>> {
    try {
      // Simplified decryption - in production, use proper decryption
      const decoded = atob(message.ciphertext);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
      }
      
      const decoder = new TextDecoder();
      const plaintext = decoder.decode(bytes);
      
      return createResult.success(plaintext);
    } catch (error) {
      return createResult.error(SolConnectError.crypto(
        ErrorCode.DECRYPTION_FAILED,
        `Decryption failed: ${error}`,
        'Failed to decrypt message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send message with retry logic
   */
  private async sendWithRetry(session: ChatSession, message: string): Promise<Result<DeliveryReceipt>> {
    let lastError: SolConnectError | null = null;
    
    for (let attempt = 1; attempt <= this.config.messageRetryAttempts; attempt++) {
      const result = await this.transport.send(session, message);
      
      if (result.success) {
        return result;
      }
      
      lastError = result.error!;
      
      // Don't retry on validation errors
      if (lastError.category === 'validation') {
        return result;
      }
      
      // Wait before retry with exponential backoff
      if (attempt < this.config.messageRetryAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    return createResult.error(lastError!);
  }

  /**
   * Process queued messages
   */
  private async processQueuedMessages(): Promise<void> {
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const item of queue) {
      try {
        const result = await this.sendMessage(item.session, item.message);
        if (result.success) {
          item.resolve(result);
        } else {
          item.reject(result.error);
        }
      } catch (error) {
        item.reject(error);
      }
    }
  }

  /**
   * Process pending messages from storage
   */
  private async processPendingMessages(): Promise<void> {
    if (!this.storage) return;

    const pendingResult = await this.storage.getPendingMessages();
    if (!pendingResult.success) return;

    for (const message of pendingResult.data!) {
      // Attempt to resend pending messages
      console.log(`Resending pending message: ${message.id}`);
      // TODO: Implement resend logic based on session information
    }
  }
}

// Singleton instance
let messageBus: MessageBus | null = null;

/**
 * Get message bus instance
 */
export function getMessageBus(config?: MessageBusConfig): MessageBus {
  if (!messageBus && config) {
    messageBus = new MessageBus(config);
  }
  
  if (!messageBus) {
    throw new Error('MessageBus not initialized. Call initializeMessageBus first.');
  }
  
  return messageBus;
}

/**
 * Initialize message bus
 */
export async function initializeMessageBus(config: MessageBusConfig): Promise<Result<MessageBus>> {
  messageBus = new MessageBus(config);
  const result = await messageBus.initialize();
  
  if (result.success) {
    return createResult.success(messageBus);
  } else {
    messageBus = null;
    return createResult.error(result.error!);
  }
}