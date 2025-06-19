/**
 * React hooks for SolConnect SDK integration
 * Provides state management and reactive updates for messaging operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SolConnectSDK, initializeSDK, getSDK, WalletInfo, SessionConfig } from '../services/SolConnectSDK';
import { ChatSession, Message } from '../types';
import { SolConnectError, Result } from '../types/errors';
import { DeliveryReceipt, Subscription } from '../services/transport/MessageTransport';

export interface UseSolConnectState {
  sdk: SolConnectSDK | null;
  isInitialized: boolean;
  isConnecting: boolean;
  wallet: WalletInfo | null;
  connectionStatus: string;
  error: SolConnectError | null;
}

export interface UseSolConnectActions {
  initialize: (relayEndpoint: string) => Promise<boolean>;
  connectWallet: () => Promise<boolean>;
  disconnectWallet: () => Promise<boolean>;
  clearError: () => void;
  cleanup: () => Promise<void>;
}

/**
 * Main hook for SolConnect SDK integration
 */
export function useSolConnect(): UseSolConnectState & UseSolConnectActions {
  const [state, setState] = useState<UseSolConnectState>({
    sdk: null,
    isInitialized: false,
    isConnecting: false,
    wallet: null,
    connectionStatus: 'disconnected',
    error: null
  });

  const updateState = useCallback((updates: Partial<UseSolConnectState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const initialize = useCallback(async (relayEndpoint: string): Promise<boolean> => {
    updateState({ isConnecting: true, error: null });

    try {
      const result = await initializeSDK({
        relayEndpoint,
        solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        networkType: 'devnet',
        enableLogging: process.env.NODE_ENV === 'development'
      });

      if (result.success) {
        updateState({
          sdk: result.data!,
          isInitialized: true,
          isConnecting: false,
          connectionStatus: result.data!.getConnectionStatus()
        });
        return true;
      } else {
        updateState({
          isConnecting: false,
          error: result.error!
        });
        return false;
      }
    } catch (error) {
      updateState({
        isConnecting: false,
        error: error as SolConnectError
      });
      return false;
    }
  }, [updateState]);

  const connectWallet = useCallback(async (): Promise<boolean> => {
    const sdk = getSDK();
    if (!sdk) {
      updateState({
        error: new SolConnectError(
          'system',
          'UNKNOWN_ERROR',
          'SDK not initialized',
          'Please initialize the SDK first',
          false
        )
      });
      return false;
    }

    updateState({ isConnecting: true, error: null });

    try {
      const result = await sdk.connectWallet();
      
      if (result.success) {
        updateState({
          wallet: result.data!,
          isConnecting: false
        });
        return true;
      } else {
        updateState({
          isConnecting: false,
          error: result.error!
        });
        return false;
      }
    } catch (error) {
      updateState({
        isConnecting: false,
        error: error as SolConnectError
      });
      return false;
    }
  }, [updateState]);

  const disconnectWallet = useCallback(async (): Promise<boolean> => {
    const sdk = getSDK();
    if (!sdk) return true;

    try {
      const result = await sdk.disconnectWallet();
      
      if (result.success) {
        updateState({
          wallet: null
        });
        return true;
      } else {
        updateState({
          error: result.error!
        });
        return false;
      }
    } catch (error) {
      updateState({
        error: error as SolConnectError
      });
      return false;
    }
  }, [updateState]);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const cleanup = useCallback(async () => {
    const sdk = getSDK();
    if (sdk) {
      await sdk.cleanup();
    }
    updateState({
      sdk: null,
      isInitialized: false,
      wallet: null,
      connectionStatus: 'disconnected',
      error: null
    });
  }, [updateState]);

  // Update connection status periodically
  useEffect(() => {
    if (!state.sdk) return;

    const interval = setInterval(() => {
      const status = state.sdk!.getConnectionStatus();
      if (status !== state.connectionStatus) {
        updateState({ connectionStatus: status });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.sdk, state.connectionStatus, updateState]);

  return {
    ...state,
    initialize,
    connectWallet,
    disconnectWallet,
    clearError,
    cleanup
  };
}

export interface UseSessionState {
  session: ChatSession | null;
  isStarting: boolean;
  error: SolConnectError | null;
}

export interface UseSessionActions {
  startSession: (peerWallet: string) => Promise<boolean>;
  endSession: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook for managing individual chat sessions
 */
export function useSession(): UseSessionState & UseSessionActions {
  const [state, setState] = useState<UseSessionState>({
    session: null,
    isStarting: false,
    error: null
  });

  const updateState = useCallback((updates: Partial<UseSessionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const startSession = useCallback(async (peerWallet: string): Promise<boolean> => {
    const sdk = getSDK();
    if (!sdk) {
      updateState({
        error: new SolConnectError(
          'system',
          'UNKNOWN_ERROR',
          'SDK not initialized',
          'Please initialize the SDK first',
          false
        )
      });
      return false;
    }

    updateState({ isStarting: true, error: null });

    try {
      const result = await sdk.startSession({ peerWallet });
      
      if (result.success) {
        updateState({
          session: result.data!,
          isStarting: false
        });
        return true;
      } else {
        updateState({
          isStarting: false,
          error: result.error!
        });
        return false;
      }
    } catch (error) {
      updateState({
        isStarting: false,
        error: error as SolConnectError
      });
      return false;
    }
  }, [updateState]);

  const endSession = useCallback(async (): Promise<boolean> => {
    const sdk = getSDK();
    if (!sdk || !state.session) return true;

    try {
      const result = await sdk.endSession(state.session.session_id);
      
      if (result.success) {
        updateState({
          session: null
        });
        return true;
      } else {
        updateState({
          error: result.error!
        });
        return false;
      }
    } catch (error) {
      updateState({
        error: error as SolConnectError
      });
      return false;
    }
  }, [state.session, updateState]);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  return {
    ...state,
    startSession,
    endSession,
    clearError
  };
}

export interface UseMessagesState {
  messages: Message[];
  isSending: boolean;
  error: SolConnectError | null;
}

export interface UseMessagesActions {
  sendMessage: (text: string) => Promise<boolean>;
  clearMessages: () => void;
  clearError: () => void;
}

/**
 * Hook for managing messages within a session
 */
export function useMessages(sessionId: string | null): UseMessagesState & UseMessagesActions {
  const [state, setState] = useState<UseMessagesState>({
    messages: [],
    isSending: false,
    error: null
  });

  const subscriptionRef = useRef<Subscription | null>(null);

  const updateState = useCallback((updates: Partial<UseMessagesState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    const sdk = getSDK();
    if (!sdk || !sessionId) {
      updateState({
        error: new SolConnectError(
          'validation',
          'INVALID_MESSAGE_FORMAT',
          'Session not available',
          'No active chat session',
          false
        )
      });
      return false;
    }

    updateState({ isSending: true, error: null });

    try {
      const result = await sdk.sendMessage(sessionId, text);
      
      if (result.success) {
        // Add message to local state immediately (optimistic update)
        const newMessage: Message = {
          sender_wallet: sdk.getCurrentWallet()?.address || 'unknown',
          ciphertext: text,
          timestamp: new Date().toISOString(),
          session_id: sessionId
        };

        updateState({
          messages: prev => [...prev.messages, newMessage],
          isSending: false
        });
        return true;
      } else {
        updateState({
          isSending: false,
          error: result.error!
        });
        return false;
      }
    } catch (error) {
      updateState({
        isSending: false,
        error: error as SolConnectError
      });
      return false;
    }
  }, [sessionId, updateState]);

  const clearMessages = useCallback(() => {
    updateState({ messages: [] });
  }, [updateState]);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Subscribe to incoming messages when session changes
  useEffect(() => {
    if (!sessionId) {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      return;
    }

    const sdk = getSDK();
    if (!sdk) return;

    const result = sdk.subscribeToMessages(sessionId, (message: Message) => {
      updateState({
        messages: prev => {
          // Avoid duplicates
          const exists = prev.messages.some(m => 
            m.timestamp === message.timestamp && 
            m.sender_wallet === message.sender_wallet &&
            m.ciphertext === message.ciphertext
          );
          
          if (exists) return prev;
          
          return {
            ...prev,
            messages: [...prev.messages, message]
          };
        }
      });
    });

    if (result.success) {
      subscriptionRef.current = result.data!;
    } else {
      updateState({ error: result.error! });
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [sessionId, updateState]);

  return {
    ...state,
    sendMessage,
    clearMessages,
    clearError
  };
}