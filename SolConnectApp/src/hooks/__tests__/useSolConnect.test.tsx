/**
 * Tests for SolConnect React hooks
 * Tests hook state management, error handling, and lifecycle
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSolConnect, useSession, useMessages } from '../useSolConnect';
import { ErrorCode } from '../../types/errors';

// Mock the SDK
jest.mock('../../services/SolConnectSDK', () => ({
  initializeSDK: jest.fn(),
  getSDK: jest.fn(),
  cleanupSDK: jest.fn()
}));

// Mock message structure
const mockMessage = {
  sender_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  ciphertext: 'Hello, World!',
  timestamp: new Date().toISOString(),
  session_id: 'test-session'
};

// Mock SDK instance
const createMockSDK = (overrides = {}) => ({
  initialize: jest.fn().mockResolvedValue({ success: true }),
  connectWallet: jest.fn().mockResolvedValue({
    success: true,
    data: {
      address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      connected: true,
      balance: 1.5
    }
  }),
  disconnectWallet: jest.fn().mockResolvedValue({ success: true }),
  startSession: jest.fn().mockResolvedValue({
    success: true,
    data: {
      session_id: 'test-session-123',
      peer_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      sharedKey: new Uint8Array(32)
    }
  }),
  endSession: jest.fn().mockResolvedValue({ success: true }),
  sendMessage: jest.fn().mockResolvedValue({
    success: true,
    data: {
      messageId: 'msg-123',
      timestamp: Date.now(),
      status: 'sent'
    }
  }),
  subscribeToMessages: jest.fn().mockReturnValue({
    success: true,
    data: {
      id: 'sub-123',
      unsubscribe: jest.fn()
    }
  }),
  getCurrentWallet: jest.fn().mockReturnValue(null),
  getConnectionStatus: jest.fn().mockReturnValue('connected'),
  cleanup: jest.fn().mockResolvedValue({ success: true }),
  ...overrides
});

describe('useSolConnect Hook', () => {
  let mockSDK: ReturnType<typeof createMockSDK>;

  beforeEach(() => {
    mockSDK = createMockSDK();
    
    const { initializeSDK, getSDK, cleanupSDK } = require('../../services/SolConnectSDK');
    initializeSDK.mockResolvedValue({ success: true, data: mockSDK });
    getSDK.mockReturnValue(mockSDK);
    cleanupSDK.mockResolvedValue({ success: true });
    
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const { result } = renderHook(() => useSolConnect());
      
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      
      await act(async () => {
        const success = await result.current.initialize('ws://localhost:8080');
        expect(success).toBe(true);
      });
      
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.sdk).toBe(mockSDK);
      expect(result.current.error).toBeNull();
    });

    it('should handle initialization failure', async () => {
      const { initializeSDK } = require('../../services/SolConnectSDK');
      initializeSDK.mockResolvedValue({
        success: false,
        error: { code: ErrorCode.CONNECTION_FAILED, message: 'Failed to connect' }
      });

      const { result } = renderHook(() => useSolConnect());
      
      await act(async () => {
        const success = await result.current.initialize('ws://localhost:8080');
        expect(success).toBe(false);
      });
      
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBeDefined();
      expect(result.current.isConnecting).toBe(false);
    });

    it('should update connection status periodically', async () => {
      const { result } = renderHook(() => useSolConnect());
      
      await act(async () => {
        await result.current.initialize('ws://localhost:8080');
      });
      
      expect(result.current.connectionStatus).toBe('connected');
      
      // Change mock status
      mockSDK.getConnectionStatus.mockReturnValue('disconnected');
      
      // Wait for status update
      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('disconnected');
      }, { timeout: 2000 });
    });
  });

  describe('Wallet Management', () => {
    it('should connect wallet successfully', async () => {
      const { result } = renderHook(() => useSolConnect());
      
      await act(async () => {
        await result.current.initialize('ws://localhost:8080');
      });
      
      await act(async () => {
        const success = await result.current.connectWallet();
        expect(success).toBe(true);
      });
      
      expect(result.current.wallet).toMatchObject({
        address: expect.any(String),
        connected: true,
        balance: expect.any(Number)
      });
    });

    it('should handle wallet connection failure', async () => {
      mockSDK.connectWallet.mockResolvedValue({
        success: false,
        error: { code: ErrorCode.WALLET_NOT_CONNECTED, message: 'Wallet connection failed' }
      });

      const { result } = renderHook(() => useSolConnect());
      
      await act(async () => {
        await result.current.initialize('ws://localhost:8080');
      });
      
      await act(async () => {
        const success = await result.current.connectWallet();
        expect(success).toBe(false);
      });
      
      expect(result.current.wallet).toBeNull();
      expect(result.current.error).toBeDefined();
    });

    it('should disconnect wallet successfully', async () => {
      const { result } = renderHook(() => useSolConnect());
      
      await act(async () => {
        await result.current.initialize('ws://localhost:8080');
        await result.current.connectWallet();
      });
      
      expect(result.current.wallet).toBeDefined();
      
      await act(async () => {
        const success = await result.current.disconnectWallet();
        expect(success).toBe(true);
      });
      
      expect(result.current.wallet).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should clear errors', async () => {
      const { result } = renderHook(() => useSolConnect());
      
      // Force an error
      await act(async () => {
        const success = await result.current.connectWallet(); // No SDK initialized
        expect(success).toBe(false);
      });
      
      expect(result.current.error).toBeDefined();
      
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup successfully', async () => {
      const { result } = renderHook(() => useSolConnect());
      
      await act(async () => {
        await result.current.initialize('ws://localhost:8080');
        await result.current.connectWallet();
      });
      
      await act(async () => {
        await result.current.cleanup();
      });
      
      expect(result.current.sdk).toBeNull();
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.wallet).toBeNull();
    });
  });
});

describe('useSession Hook', () => {
  let mockSDK: ReturnType<typeof createMockSDK>;

  beforeEach(() => {
    mockSDK = createMockSDK();
    
    const { getSDK } = require('../../services/SolConnectSDK');
    getSDK.mockReturnValue(mockSDK);
    
    jest.clearAllMocks();
  });

  it('should start session successfully', async () => {
    const { result } = renderHook(() => useSession());
    
    expect(result.current.session).toBeNull();
    
    await act(async () => {
      const success = await result.current.startSession('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
      expect(success).toBe(true);
    });
    
    expect(result.current.session).toMatchObject({
      session_id: expect.any(String),
      peer_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
    });
  });

  it('should handle session start failure', async () => {
    mockSDK.startSession.mockResolvedValue({
      success: false,
      error: { code: ErrorCode.INVALID_WALLET_ADDRESS, message: 'Invalid wallet' }
    });

    const { result } = renderHook(() => useSession());
    
    await act(async () => {
      const success = await result.current.startSession('invalid-wallet');
      expect(success).toBe(false);
    });
    
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBeDefined();
  });

  it('should end session successfully', async () => {
    const { result } = renderHook(() => useSession());
    
    await act(async () => {
      await result.current.startSession('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    });
    
    expect(result.current.session).toBeDefined();
    
    await act(async () => {
      const success = await result.current.endSession();
      expect(success).toBe(true);
    });
    
    expect(result.current.session).toBeNull();
  });
});

describe('useMessages Hook', () => {
  let mockSDK: ReturnType<typeof createMockSDK>;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    mockUnsubscribe = jest.fn();
    mockSDK = createMockSDK({
      getCurrentWallet: jest.fn().mockReturnValue({
        address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
      })
    });
    
    mockSDK.subscribeToMessages.mockImplementation((sessionId, handler) => {
      // Store handler for later use in tests
      (mockSDK as any).lastHandler = handler;
      return {
        success: true,
        data: { id: 'sub-123', unsubscribe: mockUnsubscribe }
      };
    });
    
    const { getSDK } = require('../../services/SolConnectSDK');
    getSDK.mockReturnValue(mockSDK);
    
    jest.clearAllMocks();
  });

  it('should send message successfully', async () => {
    const { result } = renderHook(() => useMessages('test-session'));
    
    expect(result.current.messages).toHaveLength(0);
    
    await act(async () => {
      const success = await result.current.sendMessage('Hello, World!');
      expect(success).toBe(true);
    });
    
    expect(mockSDK.sendMessage).toHaveBeenCalledWith('test-session', 'Hello, World!');
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].ciphertext).toBe('Hello, World!');
  });

  it('should handle send message failure', async () => {
    mockSDK.sendMessage.mockResolvedValue({
      success: false,
      error: { code: ErrorCode.CONNECTION_FAILED, message: 'Network error' }
    });

    const { result } = renderHook(() => useMessages('test-session'));
    
    await act(async () => {
      const success = await result.current.sendMessage('Hello');
      expect(success).toBe(false);
    });
    
    expect(result.current.error).toBeDefined();
    expect(result.current.messages).toHaveLength(0);
  });

  it('should receive incoming messages', async () => {
    const { result } = renderHook(() => useMessages('test-session'));
    
    // Wait for subscription to be set up
    await waitFor(() => {
      expect(mockSDK.subscribeToMessages).toHaveBeenCalled();
    });
    
    act(() => {
      // Simulate incoming message
      const handler = (mockSDK as any).lastHandler;
      handler(mockMessage);
    });
    
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject(mockMessage);
  });

  it('should not duplicate messages', async () => {
    const { result } = renderHook(() => useMessages('test-session'));
    
    await waitFor(() => {
      expect(mockSDK.subscribeToMessages).toHaveBeenCalled();
    });
    
    act(() => {
      const handler = (mockSDK as any).lastHandler;
      // Send same message twice
      handler(mockMessage);
      handler(mockMessage);
    });
    
    expect(result.current.messages).toHaveLength(1);
  });

  it('should unsubscribe when session changes', async () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useMessages(sessionId),
      { initialProps: { sessionId: 'test-session-1' } }
    );
    
    await waitFor(() => {
      expect(mockSDK.subscribeToMessages).toHaveBeenCalledWith('test-session-1', expect.any(Function));
    });
    
    // Change session
    rerender({ sessionId: 'test-session-2' });
    
    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockSDK.subscribeToMessages).toHaveBeenCalledWith('test-session-2', expect.any(Function));
    });
  });

  it('should unsubscribe when session becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useMessages(sessionId),
      { initialProps: { sessionId: 'test-session' } }
    );
    
    await waitFor(() => {
      expect(mockSDK.subscribeToMessages).toHaveBeenCalled();
    });
    
    // Set session to null
    rerender({ sessionId: null });
    
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should clear messages', async () => {
    const { result } = renderHook(() => useMessages('test-session'));
    
    await waitFor(() => {
      expect(mockSDK.subscribeToMessages).toHaveBeenCalled();
    });
    
    act(() => {
      const handler = (mockSDK as any).lastHandler;
      handler(mockMessage);
    });
    
    expect(result.current.messages).toHaveLength(1);
    
    act(() => {
      result.current.clearMessages();
    });
    
    expect(result.current.messages).toHaveLength(0);
  });

  it('should handle subscription failure', async () => {
    mockSDK.subscribeToMessages.mockReturnValue({
      success: false,
      error: { code: ErrorCode.UNKNOWN_ERROR, message: 'Subscription failed' }
    });

    const { result } = renderHook(() => useMessages('test-session'));
    
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
    
    expect(result.current.error?.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it('should handle null session ID', () => {
    const { result } = renderHook(() => useMessages(null));
    
    expect(mockSDK.subscribeToMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});