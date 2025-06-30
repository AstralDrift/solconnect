import { SolConnectSDK } from '../SolConnectSDK';
import { MessageBus } from '../MessageBus';
import { createResult } from '../../types/errors';
import { ChatSession } from '../../types';

// Mock dependencies
jest.mock('../MessageBus');
jest.mock('../monitoring');

describe('SolConnectSDK Sync Integration', () => {
  let sdk: SolConnectSDK;
  let mockMessageBus: jest.Mocked<MessageBus>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create SDK instance
    sdk = new SolConnectSDK({
      relayEndpoint: 'ws://localhost:8080'
    });
    
    // Mock MessageBus
    mockMessageBus = {
      syncMessages: jest.fn(),
      getState: jest.fn(),
      processQueuedMessages: jest.fn(),
      connectionStatus: 'connected',
      clearStoredMessages: jest.fn()
    } as any;
    
    // Set up SDK with mocked dependencies
    (sdk as any).messageBus = mockMessageBus;
    (sdk as any).isInitialized = true;
    (sdk as any).currentWallet = { address: 'test123', connected: true };
  });
  
  describe('syncMessages', () => {
    it('should sync messages for a specific session', async () => {
      const sessionId = 'session123';
      const syncedCount = 5;
      
      mockMessageBus.syncMessages.mockResolvedValue(createResult.success(syncedCount));
      
      const result = await sdk.syncMessages(sessionId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(syncedCount);
      expect(mockMessageBus.syncMessages).toHaveBeenCalledWith(sessionId);
    });
    
    it('should sync all sessions when no sessionId provided', async () => {
      const syncedCount = 10;
      
      mockMessageBus.syncMessages.mockResolvedValue(createResult.success(syncedCount));
      
      const result = await sdk.syncMessages();
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(syncedCount);
      expect(mockMessageBus.syncMessages).toHaveBeenCalledWith(undefined);
    });
    
    it('should handle sync errors', async () => {
      const error = new Error('Sync failed');
      mockMessageBus.syncMessages.mockResolvedValue(createResult.error(error as any));
      
      const result = await sdk.syncMessages('session123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should fail if SDK not initialized', async () => {
      (sdk as any).isInitialized = false;
      
      const result = await sdk.syncMessages('session123');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SDK_NOT_INITIALIZED');
      expect(mockMessageBus.syncMessages).not.toHaveBeenCalled();
    });
  });
  
  describe('getSyncStatus', () => {
    it('should return current sync status', () => {
      const mockState = {
        syncInProgress: true,
        lastSyncAt: new Date(),
        queuedMessageCount: 3
      };
      
      mockMessageBus.getState.mockReturnValue({
        ...mockState,
        isInitialized: true,
        isConnected: true,
        networkState: {} as any
      });
      
      const result = sdk.getSyncStatus();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        syncInProgress: mockState.syncInProgress,
        lastSyncAt: mockState.lastSyncAt,
        queuedMessageCount: mockState.queuedMessageCount
      });
    });
    
    it('should fail if message bus not available', () => {
      (sdk as any).messageBus = null;
      
      const result = sdk.getSyncStatus();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SDK_NOT_INITIALIZED');
    });
  });
  
  describe('processQueuedMessages', () => {
    it('should process all queued messages', async () => {
      const processedCount = 7;
      
      mockMessageBus.processQueuedMessages.mockResolvedValue(createResult.success(processedCount));
      
      const result = await sdk.processQueuedMessages();
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(processedCount);
      expect(mockMessageBus.processQueuedMessages).toHaveBeenCalled();
    });
    
    it('should handle processing errors', async () => {
      const error = new Error('Processing failed');
      mockMessageBus.processQueuedMessages.mockResolvedValue(createResult.error(error as any));
      
      const result = await sdk.processQueuedMessages();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('enableAutoSync', () => {
    let session: ChatSession;
    
    beforeEach(() => {
      session = {
        session_id: 'session123',
        peer_wallet: 'peer123',
        sharedKey: new Uint8Array()
      };
      
      (sdk as any).activeSessions.set(session.session_id, session);
    });
    
    afterEach(() => {
      // Clean up any intervals
      if ((session as any)._autoSyncInterval) {
        clearInterval((session as any)._autoSyncInterval);
      }
    });
    
    it('should enable auto-sync for a session', async () => {
      mockMessageBus.syncMessages.mockResolvedValue(createResult.success(0));
      
      const result = await sdk.enableAutoSync(session.session_id, 100);
      
      expect(result.success).toBe(true);
      expect((session as any)._autoSyncInterval).toBeDefined();
      
      // Wait a bit to see if sync is called
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockMessageBus.syncMessages).toHaveBeenCalledWith(session.session_id);
    });
    
    it('should use default interval if not specified', async () => {
      const result = await sdk.enableAutoSync(session.session_id);
      
      expect(result.success).toBe(true);
      expect((session as any)._autoSyncInterval).toBeDefined();
    });
    
    it('should fail if session not found', async () => {
      const result = await sdk.enableAutoSync('invalid-session');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_MESSAGE_FORMAT');
    });
  });
  
  describe('disableAutoSync', () => {
    let session: ChatSession;
    
    beforeEach(() => {
      session = {
        session_id: 'session123',
        peer_wallet: 'peer123',
        sharedKey: new Uint8Array()
      };
      
      (sdk as any).activeSessions.set(session.session_id, session);
    });
    
    it('should disable auto-sync for a session', async () => {
      // First enable auto-sync
      const intervalId = setInterval(() => {}, 1000);
      (session as any)._autoSyncInterval = intervalId;
      
      const result = await sdk.disableAutoSync(session.session_id);
      
      expect(result.success).toBe(true);
      expect((session as any)._autoSyncInterval).toBeUndefined();
    });
    
    it('should succeed even if auto-sync not enabled', async () => {
      const result = await sdk.disableAutoSync(session.session_id);
      
      expect(result.success).toBe(true);
    });
    
    it('should fail if session not found', async () => {
      const result = await sdk.disableAutoSync('invalid-session');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_MESSAGE_FORMAT');
    });
  });
  
  describe('endSession with auto-sync cleanup', () => {
    it('should clean up auto-sync when ending session', async () => {
      const session = {
        session_id: 'session123',
        peer_wallet: 'peer123',
        sharedKey: new Uint8Array()
      };
      
      (sdk as any).activeSessions.set(session.session_id, session);
      
      // Enable auto-sync
      const intervalId = setInterval(() => {}, 1000);
      (session as any)._autoSyncInterval = intervalId;
      
      mockMessageBus.clearStoredMessages.mockResolvedValue(createResult.success(undefined));
      
      const result = await sdk.endSession(session.session_id);
      
      expect(result.success).toBe(true);
      expect((sdk as any).activeSessions.has(session.session_id)).toBe(false);
      
      // Verify interval was cleared (can't directly test clearInterval was called)
      // But we can verify the session was removed which would prevent further syncs
    });
  });
}); 