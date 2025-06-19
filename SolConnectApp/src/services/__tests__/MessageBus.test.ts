/**
 * Tests for MessageBus
 * Tests message routing, transport abstraction, and error handling
 */

import { MessageBus, initializeMessageBus, getMessageBus } from '../MessageBus';
import { MessageTransport } from '../transport/MessageTransport';
import { ErrorCode } from '../../types/errors';
import { ChatSession } from '../../types';

// Mock transport implementation for testing
class MockTransport extends MessageTransport {
  private connected = false;
  private messages: any[] = [];
  
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

  async disconnect() {
    this.connected = false;
    this.connection = null;
    return { success: true, data: undefined };
  }

  // Test helper methods
  getMessages() {
    return this.messages;
  }

  isConnected() {
    return this.connected;
  }

  simulateIncomingMessage(message: any) {
    this.handleIncomingMessage(message);
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
});