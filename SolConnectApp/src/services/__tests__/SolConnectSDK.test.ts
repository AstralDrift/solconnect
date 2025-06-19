/**
 * Comprehensive tests for SolConnectSDK
 * Tests SDK initialization, wallet connection, session management, and messaging
 */

import { SolConnectSDK, initializeSDK, getSDK, cleanupSDK } from '../SolConnectSDK';
import { ErrorCode } from '../../types/errors';

// Mock the MessageBus
jest.mock('../MessageBus', () => ({
  initializeMessageBus: jest.fn(),
  getMessageBus: jest.fn(),
  MessageBus: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue({ success: true }),
    sendMessage: jest.fn().mockResolvedValue({ 
      success: true, 
      data: { messageId: 'test-msg-123', timestamp: Date.now(), status: 'sent' }
    }),
    subscribeToMessages: jest.fn().mockReturnValue({
      success: true,
      data: { id: 'sub-123', unsubscribe: jest.fn() }
    }),
    disconnect: jest.fn().mockResolvedValue({ success: true }),
    connectionStatus: 'connected',
    isReady: true
  }))
}));

describe('SolConnectSDK', () => {
  let sdk: SolConnectSDK;
  const mockConfig = {
    relayEndpoint: 'ws://localhost:8080',
    solanaRpcUrl: 'https://api.devnet.solana.com',
    networkType: 'devnet' as const,
    enableLogging: false
  };

  beforeEach(async () => {
    // Clean up any existing SDK instance
    await cleanupSDK();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (sdk) {
      await sdk.cleanup();
    }
    await cleanupSDK();
  });

  describe('Initialization', () => {
    it('should initialize SDK successfully', async () => {
      const result = await initializeSDK(mockConfig);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(SolConnectSDK);
      expect(getSDK()).toBe(result.data);
    });

    it('should handle initialization failure', async () => {
      // Mock MessageBus to fail initialization
      const { initializeMessageBus } = require('../MessageBus');
      initializeMessageBus.mockResolvedValueOnce({
        success: false,
        error: new Error('Connection failed')
      });

      const result = await initializeSDK(mockConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should not initialize twice', async () => {
      const result1 = await initializeSDK(mockConfig);
      expect(result1.success).toBe(true);
      
      sdk = result1.data!;
      const result2 = await sdk.initialize();
      expect(result2.success).toBe(true);
    });
  });

  describe('Wallet Management', () => {
    beforeEach(async () => {
      const result = await initializeSDK(mockConfig);
      sdk = result.data!;
    });

    it('should connect wallet successfully', async () => {
      const result = await sdk.connectWallet();
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        connected: true,
        address: expect.any(String),
        balance: expect.any(Number)
      });
      
      expect(sdk.getCurrentWallet()).toEqual(result.data);
    });

    it('should disconnect wallet successfully', async () => {
      await sdk.connectWallet();
      const result = await sdk.disconnectWallet();
      
      expect(result.success).toBe(true);
      expect(sdk.getCurrentWallet()).toBeNull();
    });

    it('should handle wallet connection failure', async () => {
      // Mock wallet connection to fail
      jest.spyOn(sdk as any, 'generateTestWalletAddress').mockImplementation(() => {
        throw new Error('Wallet connection failed');
      });

      const result = await sdk.connectWallet();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.WALLET_NOT_CONNECTED);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      const result = await initializeSDK(mockConfig);
      sdk = result.data!;
      await sdk.connectWallet();
    });

    it('should start session successfully', async () => {
      const peerWallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
      const result = await sdk.startSession({ peerWallet });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        session_id: expect.any(String),
        peer_wallet: peerWallet,
        sharedKey: expect.any(Uint8Array)
      });
      
      expect(sdk.getActiveSessions()).toHaveLength(1);
    });

    it('should reject invalid peer wallet', async () => {
      const result = await sdk.startSession({ peerWallet: 'invalid-wallet' });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_WALLET_ADDRESS);
    });

    it('should require wallet connection for session', async () => {
      await sdk.disconnectWallet();
      const result = await sdk.startSession({ 
        peerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.WALLET_NOT_CONNECTED);
    });

    it('should end session successfully', async () => {
      const sessionResult = await sdk.startSession({ 
        peerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
      });
      
      const sessionId = sessionResult.data!.session_id;
      const result = await sdk.endSession(sessionId);
      
      expect(result.success).toBe(true);
      expect(sdk.getActiveSessions()).toHaveLength(0);
    });
  });

  describe('Messaging', () => {
    let sessionId: string;

    beforeEach(async () => {
      const result = await initializeSDK(mockConfig);
      sdk = result.data!;
      await sdk.connectWallet();
      
      const sessionResult = await sdk.startSession({ 
        peerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
      });
      sessionId = sessionResult.data!.session_id;
    });

    it('should send message successfully', async () => {
      const result = await sdk.sendMessage(sessionId, 'Hello, World!');
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        messageId: expect.any(String),
        timestamp: expect.any(Number),
        status: 'sent'
      });
    });

    it('should reject empty messages', async () => {
      const result = await sdk.sendMessage(sessionId, '');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_MESSAGE_FORMAT);
    });

    it('should reject messages for invalid session', async () => {
      const result = await sdk.sendMessage('invalid-session', 'Hello');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_MESSAGE_FORMAT);
    });

    it('should subscribe to messages successfully', async () => {
      const mockHandler = jest.fn();
      const result = sdk.subscribeToMessages(sessionId, mockHandler);
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: expect.any(String),
        unsubscribe: expect.any(Function)
      });
    });
  });

  describe('Status and State', () => {
    beforeEach(async () => {
      const result = await initializeSDK(mockConfig);
      sdk = result.data!;
    });

    it('should report connection status', () => {
      expect(sdk.getConnectionStatus()).toBe('connected');
    });

    it('should report ready state correctly', async () => {
      expect(sdk.isReady).toBe(false); // No wallet connected
      
      await sdk.connectWallet();
      expect(sdk.isReady).toBe(true); // Wallet connected and message bus ready
    });

    it('should track active sessions', async () => {
      await sdk.connectWallet();
      
      expect(sdk.getActiveSessions()).toHaveLength(0);
      
      await sdk.startSession({ 
        peerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
      });
      
      expect(sdk.getActiveSessions()).toHaveLength(1);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      const result = await initializeSDK(mockConfig);
      sdk = result.data!;
      await sdk.connectWallet();
    });

    it('should cleanup successfully', async () => {
      await sdk.startSession({ 
        peerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
      });
      
      const result = await sdk.cleanup();
      
      expect(result.success).toBe(true);
      expect(sdk.getCurrentWallet()).toBeNull();
      expect(sdk.getActiveSessions()).toHaveLength(0);
    });

    it('should cleanup global SDK instance', async () => {
      expect(getSDK()).toBe(sdk);
      
      const result = await cleanupSDK();
      
      expect(result.success).toBe(true);
      expect(getSDK()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const result = await initializeSDK(mockConfig);
      sdk = result.data!;
    });

    it('should handle message bus failures gracefully', async () => {
      const { MessageBus } = require('../MessageBus');
      const mockMessageBus = new MessageBus();
      mockMessageBus.sendMessage = jest.fn().mockResolvedValue({
        success: false,
        error: new Error('Network error')
      });
      
      // Replace the message bus instance
      (sdk as any).messageBus = mockMessageBus;
      await sdk.connectWallet();
      
      const sessionResult = await sdk.startSession({ 
        peerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
      });
      
      const result = await sdk.sendMessage(sessionResult.data!.session_id, 'Hello');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle uninitialized SDK operations', async () => {
      // Don't initialize the SDK
      const uninitializedSDK = new SolConnectSDK(mockConfig);
      
      const result = await uninitializedSDK.startSession({ 
        peerWallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.WALLET_NOT_CONNECTED);
    });
  });
});