/**
 * Tests for MessageBus
 * Tests message routing, transport abstraction, and error handling
 */

import { MessageBus, initializeMessageBus, getMessageBus } from '../MessageBus';
import { MessageTransport } from '../transport/MessageTransport';
import { ErrorCode } from '../../types/errors';
import { ChatSession, MessageStatus } from '../../types';

// Mock transport implementation for testing
class MockTransport extends MessageTransport {
  private connected = false;
  private messages: any[] = [];
  private syncMessages: any[] = [];
  private rawMessages: any[] = [];
  
  async connect(endpoint: string) {
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
    this.connected = true;
    this.connection = this.createConnection('mock-conn-1', 'connected', () => this.disconnect());
    return { success: true, data: this.connection };
  }

  async send(session: ChatSession, message: string) {
    if (!this.connected) {
      return { 
        success: false, 
        error: { code: ErrorCode.RELAY_DISCONNECTED, message: 'Not connected' }
      };
    }
    
    const receipt = {
      messageId: `msg-${Date.now()}`,
      timestamp: Date.now(),
      status: 'sent' as const
    };
    
    this.messages.push({ session, message, receipt });
    return { success: true, data: receipt };
  }

  async sendSyncMessage(message: any) {
    if (!this.connected) {
      return { 
        success: false, 
        error: { code: ErrorCode.RELAY_DISCONNECTED, message: 'Not connected' }
      };
    }
    
    this.syncMessages.push(message);
    return { success: true, data: undefined };
  }

  async sendRawMessage(message: any) {
    if (!this.connected) {
      return { 
        success: false, 
        error: { code: ErrorCode.RELAY_DISCONNECTED, message: 'Not connected' }
      };
    }
    
    this.rawMessages.push(message);
    return { success: true, data: undefined };
  }

  async disconnect() {
    this.connected = false;
    this.connection = null;
    return { success: true, data: undefined };
  }

  // Test helper methods
  getMessages() {
    return this.messages;
  }

  getSyncMessages() {
    return this.syncMessages;
  }

  getRawMessages() {
    return this.rawMessages;
  }

  isConnected() {
    return this.connected;
  }

  simulateIncomingMessage(message: any) {
    this.handleIncomingMessage(message);
  }

  simulateIncomingSyncMessage(message: any) {
    this.handleIncomingSyncMessage(message);
  }

  simulateIncomingRelayMessage(message: any) {
    this.handleIncomingRelayMessage(message);
  }

  clearMessages() {
    this.messages = [];
    this.syncMessages = [];
    this.rawMessages = [];
  }
}

// Mock TransportFactory
jest.mock('../transport/MessageTransport', () => ({
  ...jest.requireActual('../transport/MessageTransport'),
  TransportFactory: {
    create: jest.fn(),
    createForEnvironment: jest.fn()
  }
}));

describe('MessageBus', () => {
  let mockTransport: MockTransport;
  let messageBus: MessageBus;
  
  const mockConfig = {
    relayEndpoint: 'ws://localhost:8080',
    transportType: 'websocket' as const,
    enableEncryption: false, // Disable for simpler testing
    messageRetryAttempts: 2,
    connectionTimeout: 5000
  };

  const mockSession: ChatSession = {
    session_id: 'test-session-123',
    peer_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    sharedKey: new Uint8Array(32)
  };

  beforeEach(() => {
    mockTransport = new MockTransport();
    
    // Mock the TransportFactory to return our mock transport
    const { TransportFactory } = require('../transport/MessageTransport');
    TransportFactory.create.mockReturnValue(mockTransport);
    TransportFactory.createForEnvironment.mockReturnValue(mockTransport);
    
    messageBus = new MessageBus(mockConfig);
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (messageBus) {
      await messageBus.disconnect();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await messageBus.initialize();
      
      expect(result.success).toBe(true);
      expect(mockTransport.isConnected()).toBe(true);
      expect(messageBus.isReady).toBe(true);
    });

    it('should handle initialization failure', async () => {
      // Mock transport to fail connection
      mockTransport.connect = jest.fn().mockResolvedValue({
        success: false,
        error: { code: ErrorCode.CONNECTION_FAILED, message: 'Connection failed' }
      });

      const result = await messageBus.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(messageBus.isReady).toBe(false);
    });

    it('should not initialize twice', async () => {
      await messageBus.initialize();
      const connectSpy = jest.spyOn(mockTransport, 'connect');
      
      const result = await messageBus.initialize();
      
      expect(result.success).toBe(true);
      expect(connectSpy).not.toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await messageBus.initialize();
    });

    it('should send message successfully', async () => {
      const result = await messageBus.sendMessage(mockSession, 'Hello, World!');
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        messageId: expect.any(String),
        timestamp: expect.any(Number),
        status: 'sent'
      });
      
      const messages = mockTransport.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Hello, World!');
    });

    it('should reject empty messages', async () => {
      const result = await messageBus.sendMessage(mockSession, '');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_MESSAGE_FORMAT);
    });

    it('should reject messages that are too large', async () => {
      const largeMessage = 'x'.repeat(15000); // Exceed 10KB limit
      const result = await messageBus.sendMessage(mockSession, largeMessage);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.MESSAGE_TOO_LARGE);
    });

    it('should queue messages when not initialized', async () => {
      const uninitializedBus = new MessageBus(mockConfig);
      
      // Start sending message (should be queued)
      const sendPromise = uninitializedBus.sendMessage(mockSession, 'Queued message');
      
      // Initialize after a delay
      setTimeout(async () => {
        await uninitializedBus.initialize();
      }, 50);
      
      const result = await sendPromise;
      
      expect(result.success).toBe(true);
      
      await uninitializedBus.disconnect();
    });

    it('should handle transport send failure', async () => {
      // Mock transport to fail send
      mockTransport.send = jest.fn().mockResolvedValue({
        success: false,
        error: { code: ErrorCode.RELAY_DISCONNECTED, message: 'Not connected' }
      });

      const result = await messageBus.sendMessage(mockSession, 'Hello');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.RELAY_DISCONNECTED);
    });
  });

  describe('Message Subscription', () => {
    beforeEach(async () => {
      await messageBus.initialize();
    });

    it('should subscribe to messages successfully', () => {
      const mockHandler = jest.fn();
      const result = messageBus.subscribeToMessages('test-session', mockHandler);
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: expect.any(String),
        unsubscribe: expect.any(Function)
      });
    });

    it('should deliver messages to subscribers', () => {
      const mockHandler = jest.fn();
      const subscription = messageBus.subscribeToMessages('test-session', mockHandler);
      
      expect(subscription.success).toBe(true);
      
      // Simulate incoming message
      const incomingMessage = {
        sender_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        ciphertext: 'Hello back!',
        timestamp: new Date().toISOString(),
        session_id: 'test-session'
      };
      
      mockTransport.simulateIncomingMessage(incomingMessage);
      
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sender_wallet: incomingMessage.sender_wallet,
          ciphertext: incomingMessage.ciphertext
        })
      );
    });

    it('should unsubscribe successfully', () => {
      const mockHandler = jest.fn();
      const subscription = messageBus.subscribeToMessages('test-session', mockHandler);
      
      expect(subscription.success).toBe(true);
      
      const unsubscribeResult = messageBus.unsubscribe(subscription.data!.id);
      
      expect(unsubscribeResult.success).toBe(true);
      
      // Message should not be delivered after unsubscribe
      const incomingMessage = {
        sender_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        ciphertext: 'Hello back!',
        timestamp: new Date().toISOString(),
        session_id: 'test-session'
      };
      
      mockTransport.simulateIncomingMessage(incomingMessage);
      
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    beforeEach(async () => {
      await messageBus.initialize();
    });

    it('should retry failed messages', async () => {
      let attemptCount = 0;
      mockTransport.send = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          return {
            success: false,
            error: { code: ErrorCode.CONNECTION_FAILED, message: 'Temporary failure' }
          };
        }
        return {
          success: true,
          data: {
            messageId: 'retry-success',
            timestamp: Date.now(),
            status: 'sent'
          }
        };
      });

      const result = await messageBus.sendMessage(mockSession, 'Retry test');
      
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('should not retry validation errors', async () => {
      mockTransport.send = jest.fn().mockResolvedValue({
        success: false,
        error: { 
          code: ErrorCode.INVALID_MESSAGE_FORMAT,
          category: 'validation',
          message: 'Invalid format' 
        }
      });

      const result = await messageBus.sendMessage(mockSession, 'Test');
      
      expect(result.success).toBe(false);
      expect(mockTransport.send).toHaveBeenCalledTimes(1); // No retry
    });

    it('should give up after max retries', async () => {
      mockTransport.send = jest.fn().mockResolvedValue({
        success: false,
        error: { code: ErrorCode.CONNECTION_FAILED, message: 'Always fails' }
      });

      const result = await messageBus.sendMessage(mockSession, 'Always fail');
      
      expect(result.success).toBe(false);
      expect(mockTransport.send).toHaveBeenCalledTimes(2); // Initial + 1 retry (maxRetries = 2)
    });
  });

  describe('Connection Management', () => {
    it('should report connection status correctly', async () => {
      expect(messageBus.connectionStatus).toBe('disconnected');
      
      await messageBus.initialize();
      expect(messageBus.connectionStatus).toBe('connected');
      
      await messageBus.disconnect();
      expect(messageBus.connectionStatus).toBe('disconnected');
    });

    it('should disconnect successfully', async () => {
      await messageBus.initialize();
      
      const result = await messageBus.disconnect();
      
      expect(result.success).toBe(true);
      expect(mockTransport.isConnected()).toBe(false);
      expect(messageBus.isReady).toBe(false);
    });
  });

  describe('Global Instance Management', () => {
    afterEach(() => {
      // Reset global instance
      (global as any).globalMessageBus = null;
    });

    it('should create and manage global instance', async () => {
      const result = await initializeMessageBus(mockConfig);
      
      expect(result.success).toBe(true);
      expect(getMessageBus()).toBe(result.data);
    });

    it('should return existing global instance', () => {
      const bus1 = getMessageBus(mockConfig);
      const bus2 = getMessageBus();
      
      expect(bus1).toBe(bus2);
    });

    it('should throw error when getting uninitialized global instance', () => {
      expect(() => {
        getMessageBus();
      }).toThrow('MessageBus not initialized');
    });
  });

  describe('Error Handling', () => {
    it('should handle subscription errors gracefully', () => {
      const mockHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      
      const subscription = messageBus.subscribeToMessages('test-session', mockHandler);
      expect(subscription.success).toBe(true);
      
      // Should not throw when handler throws
      expect(() => {
        const incomingMessage = {
          sender_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          ciphertext: 'Test message',
          timestamp: new Date().toISOString(),
          session_id: 'test-session'
        };
        
        mockTransport.simulateIncomingMessage(incomingMessage);
      }).not.toThrow();
    });

    it('should handle transport disconnection gracefully', async () => {
      await messageBus.initialize();
      
      // Simulate transport disconnection
      await mockTransport.disconnect();
      
      const result = await messageBus.sendMessage(mockSession, 'Test');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.RELAY_DISCONNECTED);
    });
  });

  describe('Read Receipts', () => {
    beforeEach(async () => {
      await messageBus.initialize();
      mockTransport.clearMessages();
    });

    describe('Individual Read Receipt Sending', () => {
      it('should send immediate read receipt for delivered status', async () => {
        const result = await messageBus.sendReadReceipt(mockSession.session_id, 'msg-123', 'delivered');
        
        expect(result.success).toBe(true);
        
        // Should send immediately via sync protocol
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(1);
        expect(syncMessages[0]).toMatchObject({
          type: expect.stringContaining('read_receipt'),
          sessionId: mockSession.session_id
        });
      });

      it('should batch read receipts for read status', async () => {
        const result = await messageBus.sendReadReceipt(mockSession.session_id, 'msg-123', 'read');
        
        expect(result.success).toBe(true);
        
        // Should not send immediately for read status (batched)
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(0);
      });

      it('should handle read receipt send failure gracefully', async () => {
        // Mock transport to fail sync message send
        mockTransport.sendSyncMessage = jest.fn().mockResolvedValue({
          success: false,
          error: { code: ErrorCode.CONNECTION_FAILED, message: 'Send failed' }
        });

        const result = await messageBus.sendReadReceipt(mockSession.session_id, 'msg-123', 'delivered');
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('Batch Read Receipt Processing', () => {
      it('should batch multiple read receipts and send after delay', async () => {
        // Send multiple read receipts quickly
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-1', 'read');
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-2', 'read');
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-3', 'read');
        
        // Should not send immediately
        expect(mockTransport.getSyncMessages()).toHaveLength(0);
        
        // Wait for batch delay
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Should have sent one batched message
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(1);
        
        // Message should contain all 3 receipts
        const batchMessage = syncMessages[0];
        expect(batchMessage.receipts).toHaveLength(3);
        expect(batchMessage.receipts.map((r: any) => r.messageId)).toEqual(
          expect.arrayContaining(['msg-1', 'msg-2', 'msg-3'])
        );
      });

      it('should flush batch immediately when it reaches max size', async () => {
        // Send messages up to max batch size (50)
        const promises = [];
        for (let i = 1; i <= 50; i++) {
          promises.push(messageBus.sendReadReceipt(mockSession.session_id, `msg-${i}`, 'read'));
        }
        await Promise.all(promises);
        
        // Should flush immediately without waiting for timer
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(1);
        expect(syncMessages[0].receipts).toHaveLength(50);
      });

      it('should handle batch send failures with exponential backoff', async () => {
        let attemptCount = 0;
        mockTransport.sendSyncMessage = jest.fn().mockImplementation(async () => {
          attemptCount++;
          return {
            success: false,
            error: { code: ErrorCode.CONNECTION_FAILED, message: 'Batch send failed' }
          };
        });

        // Send a message to trigger batch
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-1', 'read');
        
        // Wait for initial batch timeout
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Should have attempted to send the batch
        expect(attemptCount).toBe(1);
        
        // Wait for retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Should have retried
        expect(attemptCount).toBe(2);
      });

      it('should separate batches by session ID', async () => {
        const session2Id = 'test-session-456';
        
        // Send read receipts for different sessions
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-1', 'read');
        await messageBus.sendReadReceipt(session2Id, 'msg-2', 'read');
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-3', 'read');
        
        // Wait for batch delay
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Should have sent two separate batches
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(2);
        
        const session1Messages = syncMessages.filter(msg => msg.sessionId === mockSession.session_id);
        const session2Messages = syncMessages.filter(msg => msg.sessionId === session2Id);
        
        expect(session1Messages).toHaveLength(1);
        expect(session2Messages).toHaveLength(1);
        expect(session1Messages[0].receipts).toHaveLength(2);
        expect(session2Messages[0].receipts).toHaveLength(1);
      });
    });

    describe('Bulk Read Receipt Operations', () => {
      it('should mark multiple messages as read', async () => {
        const messageIds = ['msg-1', 'msg-2', 'msg-3', 'msg-4'];
        const result = await messageBus.markMessagesAsRead(mockSession.session_id, messageIds);
        
        expect(result.success).toBe(true);
        
        // Should send sync message with all receipts
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(1);
        expect(syncMessages[0].receipts).toHaveLength(4);
        expect(syncMessages[0].receipts.every((r: any) => r.status === 'read')).toBe(true);
      });

      it('should handle empty message ID list', async () => {
        const result = await messageBus.markMessagesAsRead(mockSession.session_id, []);
        
        expect(result.success).toBe(true);
        
        // Should not send any sync messages
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(0);
      });
    });

    describe('Status Update Callbacks', () => {
      it('should call status update callback when read receipt is received', async () => {
        const statusUpdateCallback = jest.fn();
        const configWithCallback = {
          ...mockConfig,
          statusUpdateCallback
        };
        
        const busWithCallback = new MessageBus(configWithCallback);
        await busWithCallback.initialize();
        
        // Simulate incoming read receipt via relay message
        const readReceiptMessage = {
          type: 'read_receipt',
          messageId: 'msg-123',
          status: 'read',
          timestamp: Date.now(),
          readerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          sessionId: mockSession.session_id
        };
        
        mockTransport.simulateIncomingRelayMessage(readReceiptMessage);
        
        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(statusUpdateCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: 'msg-123',
            status: MessageStatus.READ,
            userId: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
          })
        );
        
        await busWithCallback.disconnect();
      });

      it('should support multiple status update handlers', async () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();
        
        messageBus.onStatusUpdate(handler1);
        messageBus.onStatusUpdate(handler2);
        
        // Simulate status update
        const statusUpdate = {
          type: 'status_update',
          messageId: 'msg-123',
          status: 'read',
          timestamp: Date.now(),
          roomId: mockSession.session_id
        };
        
        mockTransport.simulateIncomingRelayMessage(statusUpdate);
        
        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      });

      it('should unsubscribe status update handlers', async () => {
        const handler = jest.fn();
        const handlerId = messageBus.onStatusUpdate(handler);
        
        messageBus.offStatusUpdate(handlerId);
        
        // Simulate status update
        const statusUpdate = {
          type: 'status_update',
          messageId: 'msg-123',
          status: 'read',
          timestamp: Date.now(),
          roomId: mockSession.session_id
        };
        
        mockTransport.simulateIncomingRelayMessage(statusUpdate);
        
        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle malformed read receipt messages', async () => {
        const malformedMessage = {
          type: 'read_receipt',
          // Missing required fields
        };
        
        // Should not throw when processing malformed message
        expect(() => {
          mockTransport.simulateIncomingRelayMessage(malformedMessage);
        }).not.toThrow();
      });

      it('should clean up batches on disconnect', async () => {
        // Add some messages to batch
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-1', 'read');
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-2', 'read');
        
        // Disconnect should clean up batches
        await messageBus.disconnect();
        
        // Verify batches are cleared (by checking they don't send after timeout)
        await new Promise(resolve => setTimeout(resolve, 600));
        expect(mockTransport.getSyncMessages()).toHaveLength(0);
      });

      it('should handle concurrent batch operations safely', async () => {
        // Send many read receipts concurrently
        const promises = [];
        for (let i = 1; i <= 20; i++) {
          promises.push(messageBus.sendReadReceipt(mockSession.session_id, `msg-${i}`, 'read'));
        }
        
        await Promise.all(promises);
        
        // Wait for batch processing
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Should have sent exactly one batch with all messages
        const syncMessages = mockTransport.getSyncMessages();
        expect(syncMessages).toHaveLength(1);
        expect(syncMessages[0].receipts).toHaveLength(20);
      });

      it('should respect max retry attempts for failed batches', async () => {
        let attemptCount = 0;
        mockTransport.sendSyncMessage = jest.fn().mockImplementation(async () => {
          attemptCount++;
          return {
            success: false,
            error: { code: ErrorCode.CONNECTION_FAILED, message: 'Always fails' }
          };
        });

        // Send message to trigger batch
        await messageBus.sendReadReceipt(mockSession.session_id, 'msg-1', 'read');
        
        // Wait for initial send + all retries (max 3 attempts)
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Should have stopped retrying after max attempts
        expect(attemptCount).toBeLessThanOrEqual(4); // Initial + 3 retries
      });
    });
  });
});