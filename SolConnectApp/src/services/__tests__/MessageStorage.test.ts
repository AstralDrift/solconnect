/**
 * Tests for Enhanced MessageStorage
 * Tests offline queue management, network state detection, and message status tracking
 */

import { MessageStorage, getMessageStorage, initializeMessageStorage } from '../storage/MessageStorage';
import { Message } from '../../types';
import { ErrorCode } from '../../types/errors';

// Mock localStorage for testing
const mockStorage: Record<string, string> = {};

const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  }),
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: jest.fn((index: number) => Object.keys(mockStorage)[index] || null)
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock network events
const mockNetworkEventListeners: Record<string, (() => void)[]> = {};

Object.defineProperty(window, 'addEventListener', {
  value: jest.fn((event: string, listener: () => void) => {
    if (!mockNetworkEventListeners[event]) {
      mockNetworkEventListeners[event] = [];
    }
    mockNetworkEventListeners[event].push(listener);
  })
});

Object.defineProperty(window, 'removeEventListener', {
  value: jest.fn((event: string, listener: () => void) => {
    if (mockNetworkEventListeners[event]) {
      mockNetworkEventListeners[event] = mockNetworkEventListeners[event].filter(l => l !== listener);
    }
  })
});

// Helper to trigger network events
const triggerNetworkEvent = (event: 'online' | 'offline') => {
  if (mockNetworkEventListeners[event]) {
    mockNetworkEventListeners[event].forEach(listener => listener());
  }
};

describe('Enhanced MessageStorage', () => {
  let storage: MessageStorage;
  const mockSessionId = 'test-session-123';
  const mockDeviceId = 'test-device-001';
  
  const createMockMessage = (content: string, contentType: string = 'text'): Message => ({
    sender_wallet: 'wallet123',
    ciphertext: content,
    timestamp: new Date().toISOString(),
    session_id: mockSessionId,
    content_type: contentType
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    Object.keys(mockNetworkEventListeners).forEach(key => delete mockNetworkEventListeners[key]);
    
    storage = new MessageStorage();
    await storage.initialize();
    
    // Start with online state
    storage.setNetworkState(true);
  });

  afterEach(() => {
    storage.destroy();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newStorage = new MessageStorage();
      const result = await newStorage.initialize();
      
      expect(result.success).toBe(true);
      
      newStorage.destroy();
    });

    it('should initialize with encryption key', async () => {
      const encryptionKey = new Uint8Array(32);
      const newStorage = new MessageStorage();
      const result = await newStorage.initialize(encryptionKey);
      
      expect(result.success).toBe(true);
      
      newStorage.destroy();
    });

    it('should set up network state listeners', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Network State Management', () => {
    it('should track network state correctly', () => {
      let networkState = storage.getNetworkState();
      expect(networkState.online).toBe(true);

      storage.setNetworkState(false);
      networkState = storage.getNetworkState();
      expect(networkState.online).toBe(false);
      expect(networkState.lastStateChange).toBeInstanceOf(Date);
    });

    it('should respond to network events', () => {
      storage.setNetworkState(false);
      expect(storage.getNetworkState().online).toBe(false);

      triggerNetworkEvent('online');
      expect(storage.getNetworkState().online).toBe(true);

      triggerNetworkEvent('offline');
      expect(storage.getNetworkState().online).toBe(false);
    });

    it('should set connection quality', () => {
      storage.setNetworkState(true, 'excellent');
      const networkState = storage.getNetworkState();
      
      expect(networkState.online).toBe(true);
      expect(networkState.connectionQuality).toBe('excellent');
    });
  });

  describe('Message Storage with Queue Management', () => {
    it('should store message as pending when online', async () => {
      storage.setNetworkState(true);
      const message = createMockMessage('Hello online');
      
      const result = await storage.storeMessage(mockSessionId, message, mockDeviceId);
      
      expect(result.success).toBe(true);
      expect(result.data?.deliveryStatus).toBe('pending');
      expect(result.data?.deviceId).toBe(mockDeviceId);
    });

    it('should store message as queued when offline', async () => {
      storage.setNetworkState(false);
      const message = createMockMessage('Hello offline');
      
      const result = await storage.storeMessage(mockSessionId, message, mockDeviceId);
      
      expect(result.success).toBe(true);
      expect(result.data?.deliveryStatus).toBe('queued');
      expect(result.data?.queuedAt).toBeInstanceOf(Date);
    });

    it('should queue high priority messages even when online', async () => {
      storage.setNetworkState(true);
      const message = createMockMessage('x'.repeat(1500), 'text'); // Long message
      
      const result = await storage.storeMessage(mockSessionId, message, mockDeviceId);
      
      expect(result.success).toBe(true);
      
      // Check if message was added to queue
      const queuedResult = await storage.getQueuedMessages(mockSessionId);
      expect(queuedResult.success).toBe(true);
      expect(queuedResult.data?.length).toBeGreaterThan(0);
    });

    it('should store multiple messages correctly', async () => {
      storage.setNetworkState(false);
      const messages = [
        createMockMessage('Message 1'),
        createMockMessage('Message 2'),
        createMockMessage('Message 3')
      ];
      
      const result = await storage.storeMessages(mockSessionId, messages, mockDeviceId);
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
      expect(result.data?.every(m => m.deliveryStatus === 'queued')).toBe(true);
    });
  });

  describe('Message Status Updates', () => {
    let messageId: string;

    beforeEach(async () => {
      const message = createMockMessage('Test message');
      const result = await storage.storeMessage(mockSessionId, message, mockDeviceId);
      messageId = result.data!.id;
    });

    it('should update message status to sent', async () => {
      const result = await storage.updateMessageStatus(mockSessionId, messageId, 'sent');
      
      expect(result.success).toBe(true);
      
      const messages = await storage.getMessages(mockSessionId);
      const message = messages.data?.find(m => m.id === messageId);
      expect(message?.deliveryStatus).toBe('sent');
      expect(message?.sentAt).toBeInstanceOf(Date);
    });

    it('should update message status to delivered', async () => {
      const result = await storage.updateMessageStatus(mockSessionId, messageId, 'delivered');
      
      expect(result.success).toBe(true);
      
      const messages = await storage.getMessages(mockSessionId);
      const message = messages.data?.find(m => m.id === messageId);
      expect(message?.deliveryStatus).toBe('delivered');
      expect(message?.deliveredAt).toBeInstanceOf(Date);
    });

    it('should update message status to failed with error', async () => {
      const errorMessage = 'Network timeout';
      const result = await storage.updateMessageStatus(mockSessionId, messageId, 'failed', errorMessage);
      
      expect(result.success).toBe(true);
      
      const messages = await storage.getMessages(mockSessionId);
      const message = messages.data?.find(m => m.id === messageId);
      expect(message?.deliveryStatus).toBe('failed');
      expect(message?.failedAt).toBeInstanceOf(Date);
      expect(message?.errorMessage).toBe(errorMessage);
      expect(message?.retryCount).toBe(1);
    });

    it('should handle invalid message ID', async () => {
      const result = await storage.updateMessageStatus(mockSessionId, 'invalid-id', 'sent');
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Message not found');
    });
  });

  describe('Queue Management', () => {
    beforeEach(async () => {
      storage.setNetworkState(false); // Start offline to populate queue
      
      // Add multiple messages to queue
      const messages = [
        createMockMessage('Urgent message', 'urgent'),
        createMockMessage('Normal message', 'text'),
        createMockMessage('Image message', 'image')
      ];
      
      for (const message of messages) {
        await storage.storeMessage(mockSessionId, message, mockDeviceId);
      }
    });

    it('should get queued messages sorted by priority', async () => {
      const result = await storage.getQueuedMessages(mockSessionId);
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
      
      // Should be sorted by priority (urgent first)
      expect(result.data?.[0].ciphertext).toBe('Urgent message');
    });

    it('should get queued messages for all sessions', async () => {
      // Add message to another session
      await storage.storeMessage('other-session', createMockMessage('Other session message'), mockDeviceId);
      
      const result = await storage.getQueuedMessages();
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(4); // 3 from mockSessionId + 1 from other-session
    });

    it('should remove message from queue', async () => {
      const queuedResult = await storage.getQueuedMessages(mockSessionId);
      const messageId = queuedResult.data![0].id;
      
      const removeResult = await storage.removeFromQueue(mockSessionId, messageId);
      expect(removeResult.success).toBe(true);
      
      const afterRemoveResult = await storage.getQueuedMessages(mockSessionId);
      expect(afterRemoveResult.data?.length).toBe(2);
      expect(afterRemoveResult.data?.every(m => m.id !== messageId)).toBe(true);
    });

    it('should clear entire queue', async () => {
      const clearResult = await storage.clearQueue(mockSessionId);
      expect(clearResult.success).toBe(true);
      
      const queuedResult = await storage.getQueuedMessages(mockSessionId);
      expect(queuedResult.data?.length).toBe(0);
    });

    it('should provide queue statistics', () => {
      const stats = storage.getQueueStats();
      
      expect(stats.totalQueued).toBeGreaterThan(0);
      expect(stats.queuesBySession[mockSessionId]).toBeGreaterThan(0);
      expect(stats.oldestQueuedMessage).toBeInstanceOf(Date);
      expect(stats.newestQueuedMessage).toBeInstanceOf(Date);
    });
  });

  describe('Queue Processing', () => {
    let processedMessages: any[] = [];
    
    beforeEach(async () => {
      processedMessages = [];
      
      // Register a mock queue processor
      storage.registerQueueProcessor(async (sessionId, messages) => {
        processedMessages.push(...messages);
      });
      
      // Add messages to queue while offline
      storage.setNetworkState(false);
      await storage.storeMessage(mockSessionId, createMockMessage('Message 1'), mockDeviceId);
      await storage.storeMessage(mockSessionId, createMockMessage('Message 2'), mockDeviceId);
    });

    it('should process queues when coming online', async () => {
      expect(processedMessages.length).toBe(0);
      
      // Come online - should trigger queue processing
      storage.setNetworkState(true);
      
      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(processedMessages.length).toBeGreaterThan(0);
    });

    it('should process all queues manually', async () => {
      storage.setNetworkState(true);
      
      await storage.processAllQueues();
      
      expect(processedMessages.length).toBeGreaterThan(0);
    });

    it('should not process when offline', async () => {
      storage.setNetworkState(false);
      
      await storage.processAllQueues();
      
      expect(processedMessages.length).toBe(0);
    });
  });

  describe('Message Retrieval', () => {
    beforeEach(async () => {
      const messages = [
        createMockMessage('Message 1'),
        createMockMessage('Message 2'),
        createMockMessage('Message 3')
      ];
      
      await storage.storeMessages(mockSessionId, messages, mockDeviceId);
    });

    it('should get all messages for a session', async () => {
      const result = await storage.getMessages(mockSessionId);
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
    });

    it('should get limited messages', async () => {
      const result = await storage.getMessages(mockSessionId, 2);
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });

    it('should get pending messages across all sessions', async () => {
      const result = await storage.getPendingMessages();
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
      expect(result.data?.every(m => 
        m.deliveryStatus === 'pending' || 
        m.deliveryStatus === 'queued'
      )).toBe(true);
    });

    it('should return empty array for non-existent session', async () => {
      const result = await storage.getMessages('non-existent-session');
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(0);
    });
  });

  describe('Export and Import with Queue Data', () => {
    beforeEach(async () => {
      // Add some messages and queue data
      storage.setNetworkState(false);
      await storage.storeMessage(mockSessionId, createMockMessage('Queued message'), mockDeviceId);
      
      storage.setNetworkState(true);
      await storage.storeMessage(mockSessionId, createMockMessage('Normal message'), mockDeviceId);
    });

    it('should export messages and queue data', async () => {
      const result = await storage.exportMessages();
      
      expect(result.success).toBe(true);
      
      const exportData = JSON.parse(result.data!);
      expect(exportData.version).toBe('2.0');
      expect(exportData.messages).toBeDefined();
      expect(exportData.queues).toBeDefined();
      expect(exportData.networkState).toBeDefined();
    });

    it('should import messages and queue data', async () => {
      const exportResult = await storage.exportMessages();
      const exportData = exportResult.data!;
      
      // Clear storage
      await storage.clearAll();
      
      // Import back
      const importResult = await storage.importMessages(exportData);
      
      expect(importResult.success).toBe(true);
      expect(importResult.data).toBeGreaterThan(0);
      
      // Verify data was imported
      const messages = await storage.getMessages(mockSessionId);
      expect(messages.data?.length).toBeGreaterThan(0);
    });

    it('should handle invalid import data', async () => {
      const result = await storage.importMessages('invalid json');
      
      expect(result.success).toBe(false);
    });

    it('should handle legacy export format', async () => {
      const legacyData = {
        version: '1.0',
        messages: {
          [mockSessionId]: [
            {
              id: 'legacy-msg-1',
              sessionId: mockSessionId,
              ciphertext: 'Legacy message',
              timestamp: new Date().toISOString(),
              deliveryStatus: 'sent'
            }
          ]
        }
      };
      
      const result = await storage.importMessages(JSON.stringify(legacyData));
      
      expect(result.success).toBe(true);
    });
  });

  describe('Cleanup and Maintenance', () => {
    beforeEach(async () => {
      // Add messages with different timestamps
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago
      
      const messages = [
        { ...createMockMessage('Old message'), timestamp: oldDate.toISOString() },
        { ...createMockMessage('Recent message'), timestamp: recentDate.toISOString() },
        createMockMessage('New message')
      ];
      
      await storage.storeMessages(mockSessionId, messages, mockDeviceId);
    });

    it('should cleanup old messages', async () => {
      const result = await storage.cleanup(30); // Keep 30 days
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(1); // Should delete 1 old message
      
      const messages = await storage.getMessages(mockSessionId);
      expect(messages.data?.length).toBe(2); // Should have 2 remaining
    });

    it('should clear session data', async () => {
      const result = await storage.clearSession(mockSessionId);
      
      expect(result.success).toBe(true);
      
      const messages = await storage.getMessages(mockSessionId);
      expect(messages.data?.length).toBe(0);
      
      const queuedMessages = await storage.getQueuedMessages(mockSessionId);
      expect(queuedMessages.data?.length).toBe(0);
    });

    it('should clear all data', async () => {
      const result = await storage.clearAll();
      
      expect(result.success).toBe(true);
      
      const messages = await storage.getMessages(mockSessionId);
      expect(messages.data?.length).toBe(0);
      
      const stats = storage.getQueueStats();
      expect(stats.totalQueued).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage adapter errors gracefully', async () => {
      // Mock storage error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage full');
      });
      
      const message = createMockMessage('Test message');
      const result = await storage.storeMessage(mockSessionId, message, mockDeviceId);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Storage full');
    });

    it('should handle corrupt data gracefully', async () => {
      // Set corrupt data
      mockStorage['solconnect_messages_test'] = 'invalid json';
      
      const result = await storage.getMessages('test');
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(0);
    });
  });

  describe('Singleton and Factory Functions', () => {
    it('should return same instance from getMessageStorage', () => {
      const instance1 = getMessageStorage();
      const instance2 = getMessageStorage();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize storage with factory function', async () => {
      const encryptionKey = new Uint8Array(32);
      const result = await initializeMessageStorage(encryptionKey);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(MessageStorage);
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle maximum queue size', async () => {
      storage.setNetworkState(false);
      
      // Add messages beyond max queue size (assuming 500 is the limit)
      for (let i = 0; i < 600; i++) {
        await storage.storeMessage(mockSessionId, createMockMessage(`Message ${i}`), mockDeviceId);
      }
      
      const queuedResult = await storage.getQueuedMessages(mockSessionId);
      expect(queuedResult.data?.length).toBeLessThanOrEqual(500);
    });

    it('should handle maximum messages per session', async () => {
      // Add messages beyond max per session (assuming 1000 is the limit)
      for (let i = 0; i < 1100; i++) {
        await storage.storeMessage(mockSessionId, createMockMessage(`Message ${i}`), mockDeviceId);
      }
      
      const messages = await storage.getMessages(mockSessionId);
      expect(messages.data?.length).toBeLessThanOrEqual(1000);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        promises.push(storage.storeMessage(mockSessionId, createMockMessage(`Concurrent ${i}`), mockDeviceId));
      }
      
      const results = await Promise.all(promises);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle rapid network state changes', () => {
      const initialState = storage.getNetworkState();
      
      // Rapid state changes
      for (let i = 0; i < 100; i++) {
        storage.setNetworkState(i % 2 === 0);
      }
      
      const finalState = storage.getNetworkState();
      expect(finalState).toBeDefined();
      expect(typeof finalState.online).toBe('boolean');
    });
  });
}); 