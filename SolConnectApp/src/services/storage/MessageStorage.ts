/**
 * Message Storage Service
 * Provides encrypted local storage for messages with cross-platform support and offline queue management
 */

import { Message, ChatSession, MessageStatus, MessageStatusUpdate, MessageStatusTimestamps } from '../../types';
import { SolConnectError, ErrorCode, Result, createResult } from '../../types/errors';

interface StoredMessage extends Message {
  id: string;
  sessionId: string;
  sequenceNumber?: number;
  deviceId?: string;
  isLocal?: boolean;
  deliveryStatus: 'queued' | 'pending' | 'sent' | 'delivered' | 'failed';
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  retryCount: number;
  lastRetryAt?: Date;
  errorMessage?: string;
  // Read receipt fields
  readAt?: Date;
}

interface QueuedMessage extends StoredMessage {
  priority: number; // Higher priority = sent first
  maxRetries: number;
  nextRetryAt?: Date;
}

interface OfflineQueue {
  sessionId: string;
  messages: QueuedMessage[];
  lastProcessedAt?: Date;
  processingEnabled: boolean;
}

interface NetworkState {
  online: boolean;
  lastStateChange: Date;
  connectionQuality?: 'poor' | 'good' | 'excellent';
}

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

/**
 * Web storage adapter using localStorage
 */
class WebStorageAdapter implements StorageAdapter {
  private prefix = 'solconnect_';

  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(this.prefix + key);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, value);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }
}

/**
 * Mobile storage adapter using AsyncStorage
 */
class MobileStorageAdapter implements StorageAdapter {
  private AsyncStorage: any;
  private prefix = '@solconnect:';

  constructor() {
    // Dynamic import to avoid issues in web environment
    try {
      this.AsyncStorage = require('@react-native-async-storage/async-storage').default;
    } catch (error) {
      console.warn('AsyncStorage not available, falling back to web storage');
      // Fallback to web storage in development
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      if (!this.AsyncStorage) return null;
      return await this.AsyncStorage.getItem(this.prefix + key);
    } catch (error) {
      console.error('Error reading from AsyncStorage:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (!this.AsyncStorage) throw new Error('AsyncStorage not available');
      await this.AsyncStorage.setItem(this.prefix + key, value);
    } catch (error) {
      console.error('Error writing to AsyncStorage:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (!this.AsyncStorage) return;
      await this.AsyncStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Error removing from AsyncStorage:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      if (!this.AsyncStorage) return [];
      const allKeys = await this.AsyncStorage.getAllKeys();
      return allKeys
        .filter((key: string) => key.startsWith(this.prefix))
        .map((key: string) => key.substring(this.prefix.length));
    } catch (error) {
      console.error('Error getting all keys from AsyncStorage:', error);
      return [];
    }
  }
}

/**
 * Message storage service with encryption, cross-platform support, and offline queue management
 */
export class MessageStorage {
  private adapter: StorageAdapter;
  private encryptionKey?: Uint8Array;
  private messageCache = new Map<string, StoredMessage[]>();
  private offlineQueues = new Map<string, OfflineQueue>();
  private maxMessagesPerSession = 1000;
  private maxQueueSize = 500;
  private maxRetries = 3;
  private syncInterval?: NodeJS.Timeout;
  private queueProcessingInterval?: NodeJS.Timeout;
  private networkState: NetworkState = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastStateChange: new Date()
  };
  
  // Event listeners for network state changes
  private onlineListener?: () => void;
  private offlineListener?: () => void;

  // Queue processing callbacks
  private queueProcessors: Array<(sessionId: string, messages: QueuedMessage[]) => Promise<void>> = [];

  constructor() {
    // Select appropriate storage adapter based on platform
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      this.adapter = new WebStorageAdapter();
    } else {
      this.adapter = new MobileStorageAdapter();
    }

    this.setupNetworkStateListeners();
  }

  /**
   * Initialize storage with optional encryption key
   */
  async initialize(encryptionKey?: Uint8Array): Promise<Result<void>> {
    try {
      this.encryptionKey = encryptionKey;
      
      // Load existing messages and queues into cache
      await this.loadAllMessages();
      await this.loadOfflineQueues();
      
      // Start periodic sync and queue processing
      this.startPeriodicSync();
      this.startQueueProcessing();
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to initialize message storage: ${error}`,
        'Failed to initialize message storage',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Store a message (will queue if offline)
   */
  async storeMessage(sessionId: string, message: Message, deviceId?: string): Promise<Result<StoredMessage>> {
    try {
      const storedMessage: StoredMessage = {
        ...message,
        id: this.generateMessageId(),
        sessionId,
        deviceId,
        deliveryStatus: this.networkState.online ? 'pending' : 'queued',
        queuedAt: new Date(),
        retryCount: 0
      };

      // Add to cache
      const messages = this.messageCache.get(sessionId) || [];
      messages.push(storedMessage);
      
      // Limit number of messages per session
      if (messages.length > this.maxMessagesPerSession) {
        messages.splice(0, messages.length - this.maxMessagesPerSession);
      }
      
      this.messageCache.set(sessionId, messages);

      // Add to queue if offline or high priority
      if (!this.networkState.online || this.shouldQueue(message)) {
        await this.addToQueue(sessionId, storedMessage);
      }

      // Persist to storage
      await this.persistSession(sessionId, messages);

      return createResult.success(storedMessage);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to store message: ${error}`,
        'Failed to save message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Store multiple messages
   */
  async storeMessages(sessionId: string, messages: Message[], deviceId?: string): Promise<Result<StoredMessage[]>> {
    try {
      const storedMessages: StoredMessage[] = messages.map(msg => ({
        ...msg,
        id: this.generateMessageId(),
        sessionId,
        deviceId,
        deliveryStatus: this.networkState.online ? 'pending' : 'queued',
        queuedAt: new Date(),
        retryCount: 0
      }));

      // Update cache
      const existingMessages = this.messageCache.get(sessionId) || [];
      const allMessages = [...existingMessages, ...storedMessages];
      
      // Limit number of messages
      if (allMessages.length > this.maxMessagesPerSession) {
        allMessages.splice(0, allMessages.length - this.maxMessagesPerSession);
      }
      
      this.messageCache.set(sessionId, allMessages);

      // Add to queue if offline
      if (!this.networkState.online) {
        for (const message of storedMessages) {
          await this.addToQueue(sessionId, message);
        }
      }

      // Persist to storage
      await this.persistSession(sessionId, allMessages);

      return createResult.success(storedMessages);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to store messages: ${error}`,
        'Failed to save messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Update message delivery status
   */
  async updateMessageStatus(
    sessionId: string, 
    messageId: string, 
    status: StoredMessage['deliveryStatus'],
    error?: string
  ): Promise<Result<void>> {
    try {
      const messages = this.messageCache.get(sessionId) || [];
      const messageIndex = messages.findIndex(m => m.id === messageId);
      
      if (messageIndex === -1) {
        return createResult.error(SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          'Message not found',
          'Message not found in storage'
        ));
      }

      const message = messages[messageIndex];
      message.deliveryStatus = status;
      
      switch (status) {
        case 'sent':
          message.sentAt = new Date();
          break;
        case 'delivered':
          message.deliveredAt = new Date();
          break;
        case 'failed':
          message.failedAt = new Date();
          message.errorMessage = error;
          message.retryCount++;
          break;
      }

      messages[messageIndex] = message;
      this.messageCache.set(sessionId, messages);

      // Update queue if message is queued
      await this.updateQueuedMessage(sessionId, messageId, status, error);

      // Persist changes
      await this.persistSession(sessionId, messages);

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to update message status: ${error}`,
        'Failed to update message status',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Store a read receipt for a message
   */
  async storeReadReceipt(sessionId: string, messageId: string, status: 'delivered' | 'read'): Promise<Result<void>> {
    try {
      const messages = this.messageCache.get(sessionId) || [];
      const messageIndex = messages.findIndex(m => m.id === messageId);
      
      if (messageIndex === -1) {
        // Message not found locally, but that's okay - it might be from another device
        return createResult.success(undefined);
      }

      const message = messages[messageIndex];
      
      // Update the message status
      message.deliveryStatus = status;
      if (status === 'delivered') {
        message.deliveredAt = new Date();
      } else if (status === 'read') {
        message.readAt = new Date();
        // Also ensure delivered is set
        if (!message.deliveredAt) {
          message.deliveredAt = new Date();
        }
      }

      messages[messageIndex] = message;
      this.messageCache.set(sessionId, messages);

      // Persist changes
      await this.persistSession(sessionId, messages);

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to store read receipt: ${error}`,
        'Failed to save read receipt',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string, limit?: number): Promise<Result<StoredMessage[]>> {
    try {
      // Check cache first
      let messages = this.messageCache.get(sessionId);
      
      if (!messages) {
        // Load from storage
        const data = await this.adapter.getItem(`messages_${sessionId}`);
        if (data) {
          messages = JSON.parse(data) as StoredMessage[];
          this.messageCache.set(sessionId, messages);
        } else {
          messages = [];
        }
      }

      // Apply limit if specified
      if (limit && messages.length > limit) {
        messages = messages.slice(-limit);
      }

      return createResult.success(messages);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to retrieve messages: ${error}`,
        'Failed to load messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get all queued messages (ready to send when online)
   */
  async getQueuedMessages(sessionId?: string): Promise<Result<QueuedMessage[]>> {
    try {
      const queuedMessages: QueuedMessage[] = [];
      
      if (sessionId) {
        const queue = this.offlineQueues.get(sessionId);
        if (queue) {
          queuedMessages.push(...queue.messages);
        }
      } else {
        // Get all queued messages across all sessions
        for (const queue of this.offlineQueues.values()) {
          queuedMessages.push(...queue.messages);
        }
      }

      // Sort by priority and queued time
      queuedMessages.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return (a.queuedAt?.getTime() || 0) - (b.queuedAt?.getTime() || 0); // Older first
      });

      return createResult.success(queuedMessages);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get queued messages: ${error}`,
        'Failed to retrieve queued messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Remove message from queue (after successful sending)
   */
  async removeFromQueue(sessionId: string, messageId: string): Promise<Result<void>> {
    try {
      const queue = this.offlineQueues.get(sessionId);
      if (!queue) {
        return createResult.success(undefined);
      }

      queue.messages = queue.messages.filter(m => m.id !== messageId);
      
      if (queue.messages.length === 0) {
        this.offlineQueues.delete(sessionId);
        await this.adapter.removeItem(`queue_${sessionId}`);
      } else {
        await this.persistQueue(sessionId, queue);
      }

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to remove message from queue: ${error}`,
        'Failed to remove queued message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Clear all queued messages for a session
   */
  async clearQueue(sessionId: string): Promise<Result<void>> {
    try {
      this.offlineQueues.delete(sessionId);
      await this.adapter.removeItem(`queue_${sessionId}`);
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to clear queue: ${error}`,
        'Failed to clear message queue',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalQueued: number;
    queuesBySession: Record<string, number>;
    oldestQueuedMessage?: Date;
    newestQueuedMessage?: Date;
  } {
    let totalQueued = 0;
    const queuesBySession: Record<string, number> = {};
    let oldestQueuedMessage: Date | undefined;
    let newestQueuedMessage: Date | undefined;

    for (const [sessionId, queue] of this.offlineQueues) {
      queuesBySession[sessionId] = queue.messages.length;
      totalQueued += queue.messages.length;

      for (const message of queue.messages) {
        if (message.queuedAt) {
          if (!oldestQueuedMessage || message.queuedAt < oldestQueuedMessage) {
            oldestQueuedMessage = message.queuedAt;
          }
          if (!newestQueuedMessage || message.queuedAt > newestQueuedMessage) {
            newestQueuedMessage = message.queuedAt;
          }
        }
      }
    }

    return {
      totalQueued,
      queuesBySession,
      oldestQueuedMessage,
      newestQueuedMessage
    };
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Manually set network state (for testing)
   */
  setNetworkState(online: boolean, connectionQuality?: NetworkState['connectionQuality']): void {
    const wasOnline = this.networkState.online;
    this.networkState = {
      online,
      connectionQuality,
      lastStateChange: new Date()
    };

    // Trigger queue processing if we just came online
    if (!wasOnline && online) {
      this.processAllQueues();
    }
  }

  /**
   * Register a queue processor callback
   */
  registerQueueProcessor(processor: (sessionId: string, messages: QueuedMessage[]) => Promise<void>): void {
    this.queueProcessors.push(processor);
  }

  /**
   * Process all queues manually
   */
  async processAllQueues(): Promise<void> {
    if (!this.networkState.online || this.queueProcessors.length === 0) {
      return;
    }

    for (const [sessionId, queue] of this.offlineQueues) {
      if (queue.processingEnabled && queue.messages.length > 0) {
        await this.processQueue(sessionId);
      }
    }
  }

  /**
   * Clear messages for a session
   */
  async clearSession(sessionId: string): Promise<Result<void>> {
    try {
      this.messageCache.delete(sessionId);
      await this.adapter.removeItem(`messages_${sessionId}`);
      await this.clearQueue(sessionId);
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to clear session: ${error}`,
        'Failed to clear messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Clear all stored messages
   */
  async clearAll(): Promise<Result<void>> {
    try {
      const keys = await this.adapter.getAllKeys();
      const messageKeys = keys.filter(key => key.startsWith('messages_') || key.startsWith('queue_'));
      
      for (const key of messageKeys) {
        await this.adapter.removeItem(key);
      }
      
      this.messageCache.clear();
      this.offlineQueues.clear();
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to clear all messages: ${error}`,
        'Failed to clear all messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get pending messages that need to be sent
   */
  async getPendingMessages(): Promise<Result<StoredMessage[]>> {
    try {
      const pendingMessages: StoredMessage[] = [];
      
      for (const [sessionId, messages] of this.messageCache) {
        const pending = messages.filter(m => 
          m.deliveryStatus === 'pending' || 
          m.deliveryStatus === 'queued'
        );
        pendingMessages.push(...pending);
      }

      return createResult.success(pendingMessages);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get pending messages: ${error}`,
        'Failed to retrieve pending messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Export all messages for backup
   */
  async exportMessages(): Promise<Result<string>> {
    try {
      const allMessages: Record<string, StoredMessage[]> = {};
      const allQueues: Record<string, OfflineQueue> = {};
      
      for (const [sessionId, messages] of this.messageCache) {
        allMessages[sessionId] = messages;
      }

      for (const [sessionId, queue] of this.offlineQueues) {
        allQueues[sessionId] = queue;
      }

      const exportData = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        messages: allMessages,
        queues: allQueues,
        networkState: this.networkState
      };

      return createResult.success(JSON.stringify(exportData, null, 2));
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to export messages: ${error}`,
        'Failed to export messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Import messages from backup
   */
  async importMessages(data: string): Promise<Result<number>> {
    try {
      const importData = JSON.parse(data);
      
      if (!importData.version || !importData.messages) {
        return createResult.error(SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          'Invalid import data format',
          'Invalid backup file format'
        ));
      }

      let importedCount = 0;
      
      // Import messages
      for (const [sessionId, messages] of Object.entries(importData.messages)) {
        const typedMessages = messages as StoredMessage[];
        this.messageCache.set(sessionId, typedMessages);
        await this.persistSession(sessionId, typedMessages);
        importedCount += typedMessages.length;
      }

      // Import queues if available (v2.0+)
      if (importData.queues) {
        for (const [sessionId, queue] of Object.entries(importData.queues)) {
          const typedQueue = queue as OfflineQueue;
          this.offlineQueues.set(sessionId, typedQueue);
          await this.persistQueue(sessionId, typedQueue);
        }
      }

      return createResult.success(importedCount);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to import messages: ${error}`,
        'Failed to import messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Cleanup old messages
   */
  async cleanup(daysToKeep: number = 30): Promise<Result<number>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTimestamp = cutoffDate.toISOString();
      
      let deletedCount = 0;

      for (const [sessionId, messages] of this.messageCache) {
        const filteredMessages = messages.filter(m => m.timestamp > cutoffTimestamp);
        const deleted = messages.length - filteredMessages.length;
        
        if (deleted > 0) {
          deletedCount += deleted;
          this.messageCache.set(sessionId, filteredMessages);
          await this.persistSession(sessionId, filteredMessages);
        }
      }

      return createResult.success(deletedCount);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to cleanup messages: ${error}`,
        'Failed to cleanup old messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Stop periodic sync and cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = undefined;
    }

    // Remove network event listeners
    if (typeof window !== 'undefined') {
      if (this.onlineListener) {
        window.removeEventListener('online', this.onlineListener);
      }
      if (this.offlineListener) {
        window.removeEventListener('offline', this.offlineListener);
      }
    }
  }

  // Private helper methods

  private shouldQueue(message: Message): boolean {
    // Queue messages that are important or large
    return message.ciphertext.length > 1000 || 
           (message as any).priority === 'high';
  }

  private async addToQueue(sessionId: string, message: StoredMessage): Promise<void> {
    let queue = this.offlineQueues.get(sessionId);
    
    if (!queue) {
      queue = {
        sessionId,
        messages: [],
        processingEnabled: true
      };
      this.offlineQueues.set(sessionId, queue);
    }

    const queuedMessage: QueuedMessage = {
      ...message,
      priority: this.calculatePriority(message),
      maxRetries: this.maxRetries,
      nextRetryAt: this.calculateNextRetry(message.retryCount)
    };

    queue.messages.push(queuedMessage);
    
    // Limit queue size
    if (queue.messages.length > this.maxQueueSize) {
      queue.messages.splice(0, queue.messages.length - this.maxQueueSize);
    }

    await this.persistQueue(sessionId, queue);
  }

  private async updateQueuedMessage(
    sessionId: string, 
    messageId: string, 
    status: StoredMessage['deliveryStatus'],
    error?: string
  ): Promise<void> {
    const queue = this.offlineQueues.get(sessionId);
    if (!queue) return;

    const messageIndex = queue.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = queue.messages[messageIndex];
    
    if (status === 'sent' || status === 'delivered') {
      // Remove from queue on success
      queue.messages.splice(messageIndex, 1);
    } else if (status === 'failed') {
      // Update retry info
      message.deliveryStatus = status;
      message.errorMessage = error;
      message.retryCount++;
      message.lastRetryAt = new Date();
      message.nextRetryAt = this.calculateNextRetry(message.retryCount);
      
      // Remove if max retries exceeded
      if (message.retryCount >= message.maxRetries) {
        queue.messages.splice(messageIndex, 1);
      }
    }

    await this.persistQueue(sessionId, queue);
  }

  private calculatePriority(message: StoredMessage): number {
    // Higher priority for newer messages and important content types
    let priority = 50; // Base priority
    
    const messageAge = Date.now() - (message.queuedAt?.getTime() || Date.now());
    const ageHours = messageAge / (1000 * 60 * 60);
    
    // Decrease priority as message gets older
    priority -= Math.min(ageHours * 2, 30);
    
    // Increase priority for certain content types
    if (message.content_type === 'urgent') {
      priority += 20;
    } else if (message.content_type === 'image' || message.content_type === 'file') {
      priority += 10;
    }
    
    return Math.max(priority, 1);
  }

  private calculateNextRetry(retryCount: number): Date {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    const delayMs = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
    return new Date(Date.now() + delayMs);
  }

  private async processQueue(sessionId: string): Promise<void> {
    const queue = this.offlineQueues.get(sessionId);
    if (!queue || !queue.processingEnabled || queue.messages.length === 0) {
      return;
    }

    // Get messages ready for retry
    const now = new Date();
    const readyMessages = queue.messages.filter(m => 
      !m.nextRetryAt || m.nextRetryAt <= now
    );

    if (readyMessages.length === 0) {
      return;
    }

    // Process with registered processors
    for (const processor of this.queueProcessors) {
      try {
        await processor(sessionId, readyMessages);
      } catch (error) {
        console.error('Queue processor failed:', error);
      }
    }

    queue.lastProcessedAt = now;
  }

  private setupNetworkStateListeners(): void {
    if (typeof window !== 'undefined') {
      this.onlineListener = () => {
        this.setNetworkState(true);
      };
      
      this.offlineListener = () => {
        this.setNetworkState(false);
      };

      window.addEventListener('online', this.onlineListener);
      window.addEventListener('offline', this.offlineListener);
    }
  }

  private startQueueProcessing(): void {
    // Process queues every 5 seconds when online
    this.queueProcessingInterval = setInterval(() => {
      if (this.networkState.online) {
        this.processAllQueues();
      }
    }, 5000);
  }

  /**
   * Persist session messages to storage
   */
  private async persistSession(sessionId: string, messages: StoredMessage[]): Promise<void> {
    const data = JSON.stringify(messages);
    await this.adapter.setItem(`messages_${sessionId}`, data);
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(sessionId: string, queue: OfflineQueue): Promise<void> {
    const data = JSON.stringify(queue);
    await this.adapter.setItem(`queue_${sessionId}`, data);
  }

  /**
   * Load all messages from storage
   */
  private async loadAllMessages(): Promise<void> {
    const keys = await this.adapter.getAllKeys();
    const messageKeys = keys.filter(key => key.startsWith('messages_'));
    
    for (const key of messageKeys) {
      const sessionId = key.substring('messages_'.length);
      const data = await this.adapter.getItem(key);
      
      if (data) {
        try {
          const messages = JSON.parse(data) as StoredMessage[];
          this.messageCache.set(sessionId, messages);
        } catch (error) {
          console.error(`Failed to parse messages for session ${sessionId}:`, error);
        }
      }
    }
  }

  /**
   * Load offline queues from storage
   */
  private async loadOfflineQueues(): Promise<void> {
    const keys = await this.adapter.getAllKeys();
    const queueKeys = keys.filter(key => key.startsWith('queue_'));
    
    for (const key of queueKeys) {
      const sessionId = key.substring('queue_'.length);
      const data = await this.adapter.getItem(key);
      
      if (data) {
        try {
          const queue = JSON.parse(data) as OfflineQueue;
          this.offlineQueues.set(sessionId, queue);
        } catch (error) {
          console.error(`Failed to parse queue for session ${sessionId}:`, error);
        }
      }
    }
  }

  /**
   * Start periodic sync to ensure cache and storage are in sync
   */
  private startPeriodicSync(): void {
    // Sync every 30 seconds
    this.syncInterval = setInterval(() => {
      this.syncCacheToStorage();
    }, 30000);
  }

  /**
   * Sync cache to storage
   */
  private async syncCacheToStorage(): Promise<void> {
    for (const [sessionId, messages] of this.messageCache) {
      try {
        await this.persistSession(sessionId, messages);
      } catch (error) {
        console.error(`Failed to sync session ${sessionId}:`, error);
      }
    }

    for (const [sessionId, queue] of this.offlineQueues) {
      try {
        await this.persistQueue(sessionId, queue);
      } catch (error) {
        console.error(`Failed to sync queue ${sessionId}:`, error);
      }
    }
  }

  /**
   * Update message status with timestamp tracking
   */
  async updateMessageStatus(
    messageId: string, 
    status: MessageStatus, 
    timestamp: string = new Date().toISOString(),
    error?: string
  ): Promise<Result<void>> {
    try {
      // Find the message across all sessions
      let targetMessage: StoredMessage | undefined;
      let targetSessionId: string | undefined;

      for (const [sessionId, messages] of this.sessions) {
        const message = messages.find(m => m.id === messageId);
        if (message) {
          targetMessage = message;
          targetSessionId = sessionId;
          break;
        }
      }

      if (!targetMessage || !targetSessionId) {
        return createResult.error(SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          `Message ${messageId} not found`,
          'Message not found'
        ));
      }

      // Update status and timestamps
      targetMessage.status = status;
      
      if (!targetMessage.statusTimestamps) {
        targetMessage.statusTimestamps = {};
      }

      switch (status) {
        case MessageStatus.SENT:
          targetMessage.statusTimestamps.sentAt = timestamp;
          targetMessage.deliveryStatus = 'sent';
          break;
        case MessageStatus.DELIVERED:
          targetMessage.statusTimestamps.deliveredAt = timestamp;
          targetMessage.deliveryStatus = 'delivered';
          break;
        case MessageStatus.READ:
          targetMessage.statusTimestamps.readAt = timestamp;
          // Also set legacy field for backward compatibility
          targetMessage.readAt = timestamp;
          break;
        case MessageStatus.FAILED:
          targetMessage.statusTimestamps.failedAt = timestamp;
          targetMessage.deliveryStatus = 'failed';
          targetMessage.errorMessage = error;
          break;
        case MessageStatus.SENDING:
          // Reset error state when retrying
          targetMessage.errorMessage = undefined;
          targetMessage.deliveryStatus = 'pending';
          break;
      }

      // Persist the updated session
      await this.persistSession(targetSessionId, this.sessions.get(targetSessionId)!);
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to update message status: ${error}`,
        'Failed to update message status'
      ));
    }
  }

  /**
   * Get current status of a message
   */
  async getMessageStatus(messageId: string): Promise<Result<MessageStatus>> {
    try {
      for (const messages of this.sessions.values()) {
        const message = messages.find(m => m.id === messageId);
        if (message) {
          return createResult.success(message.status || MessageStatus.SENT);
        }
      }

      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        `Message ${messageId} not found`,
        'Message not found'
      ));
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get message status: ${error}`,
        'Failed to get message status'
      ));
    }
  }

  /**
   * Get all messages with a specific status
   */
  async getMessagesWithStatus(status: MessageStatus): Promise<Result<StoredMessage[]>> {
    try {
      const matchingMessages: StoredMessage[] = [];
      
      for (const messages of this.sessions.values()) {
        const filtered = messages.filter(m => m.status === status);
        matchingMessages.push(...filtered);
      }

      // Sort by timestamp descending (newest first)
      matchingMessages.sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      });

      return createResult.success(matchingMessages);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get messages with status: ${error}`,
        'Failed to retrieve messages'
      ));
    }
  }

  /**
   * Batch update message statuses for performance
   */
  async batchUpdateMessageStatus(updates: MessageStatusUpdate[]): Promise<Result<void>> {
    try {
      const sessionUpdates = new Map<string, StoredMessage[]>();

      // Group updates by session for efficient persistence
      for (const update of updates) {
        let targetMessage: StoredMessage | undefined;
        let targetSessionId: string | undefined;

        // Find the message
        for (const [sessionId, messages] of this.sessions) {
          const message = messages.find(m => m.id === update.messageId);
          if (message) {
            targetMessage = message;
            targetSessionId = sessionId;
            break;
          }
        }

        if (targetMessage && targetSessionId) {
          // Apply status update
          targetMessage.status = update.status;
          
          if (!targetMessage.statusTimestamps) {
            targetMessage.statusTimestamps = {};
          }

          switch (update.status) {
            case MessageStatus.SENT:
              targetMessage.statusTimestamps.sentAt = update.timestamp;
              targetMessage.deliveryStatus = 'sent';
              break;
            case MessageStatus.DELIVERED:
              targetMessage.statusTimestamps.deliveredAt = update.timestamp;
              targetMessage.deliveryStatus = 'delivered';
              break;
            case MessageStatus.READ:
              targetMessage.statusTimestamps.readAt = update.timestamp;
              targetMessage.readAt = update.timestamp;
              break;
            case MessageStatus.FAILED:
              targetMessage.statusTimestamps.failedAt = update.timestamp;
              targetMessage.deliveryStatus = 'failed';
              targetMessage.errorMessage = update.error;
              break;
          }

          // Track which sessions need to be persisted
          if (!sessionUpdates.has(targetSessionId)) {
            sessionUpdates.set(targetSessionId, this.sessions.get(targetSessionId)!);
          }
        }
      }

      // Persist all updated sessions
      const persistPromises = Array.from(sessionUpdates.entries()).map(
        ([sessionId, messages]) => this.persistSession(sessionId, messages)
      );

      await Promise.all(persistPromises);

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to batch update message statuses: ${error}`,
        'Failed to update message statuses'
      ));
    }
  }

  /**
   * Get status statistics for a session
   */
  async getSessionStatusStats(sessionId: string): Promise<Result<Record<MessageStatus, number>>> {
    try {
      const messages = this.sessions.get(sessionId);
      if (!messages) {
        return createResult.error(SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          `Session ${sessionId} not found`,
          'Session not found'
        ));
      }

      const stats: Record<MessageStatus, number> = {
        [MessageStatus.SENDING]: 0,
        [MessageStatus.SENT]: 0,
        [MessageStatus.DELIVERED]: 0,
        [MessageStatus.READ]: 0,
        [MessageStatus.FAILED]: 0,
      };

      for (const message of messages) {
        const status = message.status || MessageStatus.SENT;
        stats[status]++;
      }

      return createResult.success(stats);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get session status stats: ${error}`,
        'Failed to get statistics'
      ));
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let messageStorage: MessageStorage | null = null;

/**
 * Get message storage instance
 */
export function getMessageStorage(): MessageStorage {
  if (!messageStorage) {
    messageStorage = new MessageStorage();
  }
  return messageStorage;
}

/**
 * Initialize message storage
 */
export async function initializeMessageStorage(encryptionKey?: Uint8Array): Promise<Result<MessageStorage>> {
  const storage = getMessageStorage();
  const result = await storage.initialize(encryptionKey);
  
  if (result.success) {
    return createResult.success(storage);
  } else {
    return createResult.error(result.error!);
  }
} 