/**
 * Message Storage Service
 * Provides encrypted local storage for messages with cross-platform support
 */

import { Message, ChatSession } from '../../types';
import { SolConnectError, ErrorCode, Result, createResult } from '../../types/errors';

interface StoredMessage extends Message {
  id: string;
  sessionId: string;
  isLocal?: boolean;
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed';
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
    this.AsyncStorage = require('@react-native-async-storage/async-storage').default;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await this.AsyncStorage.getItem(this.prefix + key);
    } catch (error) {
      console.error('Error reading from AsyncStorage:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.AsyncStorage.setItem(this.prefix + key, value);
    } catch (error) {
      console.error('Error writing to AsyncStorage:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.AsyncStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Error removing from AsyncStorage:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
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
 * Message storage service with encryption and cross-platform support
 */
export class MessageStorage {
  private adapter: StorageAdapter;
  private encryptionKey?: Uint8Array;
  private messageCache = new Map<string, StoredMessage[]>();
  private maxMessagesPerSession = 1000;
  private syncInterval?: NodeJS.Timeout;

  constructor() {
    // Select appropriate storage adapter based on platform
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      this.adapter = new WebStorageAdapter();
    } else {
      this.adapter = new MobileStorageAdapter();
    }
  }

  /**
   * Initialize storage with optional encryption key
   */
  async initialize(encryptionKey?: Uint8Array): Promise<Result<void>> {
    try {
      this.encryptionKey = encryptionKey;
      
      // Load existing messages into cache
      await this.loadAllMessages();
      
      // Start periodic sync
      this.startPeriodicSync();
      
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
   * Store a message
   */
  async storeMessage(sessionId: string, message: Message): Promise<Result<StoredMessage>> {
    try {
      const storedMessage: StoredMessage = {
        ...message,
        id: this.generateMessageId(),
        sessionId,
        deliveryStatus: 'sent'
      };

      // Add to cache
      const messages = this.messageCache.get(sessionId) || [];
      messages.push(storedMessage);
      
      // Limit number of messages per session
      if (messages.length > this.maxMessagesPerSession) {
        messages.splice(0, messages.length - this.maxMessagesPerSession);
      }
      
      this.messageCache.set(sessionId, messages);

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
  async storeMessages(sessionId: string, messages: Message[]): Promise<Result<StoredMessage[]>> {
    try {
      const storedMessages: StoredMessage[] = messages.map(msg => ({
        ...msg,
        id: this.generateMessageId(),
        sessionId,
        deliveryStatus: 'sent' as const
      }));

      // Update cache
      const existingMessages = this.messageCache.get(sessionId) || [];
      const allMessages = [...existingMessages, ...storedMessages];
      
      // Limit number of messages
      if (allMessages.length > this.maxMessagesPerSession) {
        allMessages.splice(0, allMessages.length - this.maxMessagesPerSession);
      }
      
      this.messageCache.set(sessionId, allMessages);

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
   * Update message delivery status
   */
  async updateMessageStatus(
    sessionId: string, 
    messageId: string, 
    status: 'sent' | 'delivered' | 'failed'
  ): Promise<Result<void>> {
    try {
      const messages = this.messageCache.get(sessionId);
      if (!messages) {
        return createResult.error(SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          'Session not found',
          'Message session not found'
        ));
      }

      const message = messages.find(m => m.id === messageId);
      if (message) {
        message.deliveryStatus = status;
        await this.persistSession(sessionId, messages);
      }

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
   * Clear messages for a session
   */
  async clearSession(sessionId: string): Promise<Result<void>> {
    try {
      this.messageCache.delete(sessionId);
      await this.adapter.removeItem(`messages_${sessionId}`);
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
      const messageKeys = keys.filter(key => key.startsWith('messages_'));
      
      for (const key of messageKeys) {
        await this.adapter.removeItem(key);
      }
      
      this.messageCache.clear();
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
        const pending = messages.filter(m => m.deliveryStatus === 'pending');
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
      
      for (const [sessionId, messages] of this.messageCache) {
        allMessages[sessionId] = messages;
      }

      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        messages: allMessages
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
      
      for (const [sessionId, messages] of Object.entries(importData.messages)) {
        const typedMessages = messages as StoredMessage[];
        this.messageCache.set(sessionId, typedMessages);
        await this.persistSession(sessionId, typedMessages);
        importedCount += typedMessages.length;
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
  }

  /**
   * Persist session messages to storage
   */
  private async persistSession(sessionId: string, messages: StoredMessage[]): Promise<void> {
    const data = JSON.stringify(messages);
    await this.adapter.setItem(`messages_${sessionId}`, data);
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