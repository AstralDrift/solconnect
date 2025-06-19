/**
 * Enhanced SolConnect SDK with unified architecture patterns
 * Provides consistent interface between React frontend and Rust backend
 */

import { ChatSession, Message } from '../types';
import { SolConnectError, ErrorCode, Result, createResult, ErrorFactory } from '../types/errors';
import { MessageBus, getMessageBus, initializeMessageBus } from './MessageBus';
import { DeliveryReceipt, MessageHandler, Subscription } from './transport/MessageTransport';
import { Metrics, getErrorTracker, initializeMonitoring } from './monitoring';

export interface WalletInfo {
  address: string;
  connected: boolean;
  balance?: number;
}

export interface SessionConfig {
  peerWallet: string;
  relayEndpoint?: string;
  enableEncryption?: boolean;
}

export interface SDKConfig {
  relayEndpoint: string;
  solanaRpcUrl?: string;
  networkType?: 'devnet' | 'mainnet' | 'testnet';
  enableLogging?: boolean;
}

/**
 * Main SDK class providing high-level messaging operations
 */
export class SolConnectSDK {
  private messageBus: MessageBus | null = null;
  private currentWallet: WalletInfo | null = null;
  private activeSessions = new Map<string, ChatSession>();
  private config: Required<SDKConfig>;
  private isInitialized = false;

  constructor(config: SDKConfig) {
    this.config = {
      solanaRpcUrl: 'https://api.devnet.solana.com',
      networkType: 'devnet',
      enableLogging: true,
      ...config
    };
  }

  /**
   * Initialize the SDK
   */
  async initialize(): Promise<Result<void>> {
    if (this.isInitialized) {
      return createResult.success(undefined);
    }

    try {
      // Initialize monitoring services first
      await initializeMonitoring();
      Metrics.action('sdk_initialization_started');

      // Initialize message bus with persistence enabled
      const busResult = await initializeMessageBus({
        relayEndpoint: this.config.relayEndpoint,
        transportType: 'websocket', // Use WebSocket for now
        enableEncryption: true,
        enablePersistence: true
      });

      if (!busResult.success) {
        Metrics.action('sdk_initialization_failed', undefined, { error: busResult.error?.message });
        getErrorTracker().captureError(busResult.error!.toError(), { context: 'SDK initialization' });
        return createResult.error(busResult.error!);
      }

      this.messageBus = busResult.data!;
      this.isInitialized = true;

      this.log('SDK initialized successfully');
      Metrics.action('sdk_initialization_completed');
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `SDK initialization failed: ${error}`,
        'Failed to initialize SolConnect',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Connect wallet and authenticate user
   */
  async connectWallet(): Promise<Result<WalletInfo>> {
    return await Metrics.time('wallet_connection', async () => {
      try {
        Metrics.action('wallet_connection_started');
        
        // For now, simulate wallet connection
        // In production, this would integrate with Solana wallet adapter
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const walletAddress = this.generateTestWalletAddress();
        
        this.currentWallet = {
          address: walletAddress,
          connected: true,
          balance: 1.5 // SOL
        };

        this.log('Wallet connected:', this.currentWallet.address);
        Metrics.business('wallet_connected', 1, { walletAddress });
        return createResult.success(this.currentWallet);
      } catch (error) {
        Metrics.action('wallet_connection_failed', undefined, { error: error?.toString() });
        getErrorTracker().captureError(error as Error, { context: 'Wallet connection' });
        return createResult.error(SolConnectError.auth(
          ErrorCode.WALLET_NOT_CONNECTED,
          `Wallet connection failed: ${error}`,
          'Failed to connect wallet. Please try again.',
          { error: error?.toString() }
        ));
      }
    });
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<Result<void>> {
    try {
      // Close all active sessions
      for (const sessionId of this.activeSessions.keys()) {
        await this.endSession(sessionId);
      }

      this.currentWallet = null;
      this.log('Wallet disconnected');
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Wallet disconnection failed: ${error}`,
        'Error occurred while disconnecting wallet',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Start a new chat session with a peer
   */
  async startSession(config: SessionConfig): Promise<Result<ChatSession>> {
    if (!this.currentWallet?.connected) {
      return createResult.error(ErrorFactory.walletNotConnected());
    }

    if (!this.isInitialized || !this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'SDK not initialized',
        'Please initialize the SDK first'
      ));
    }

    try {
      // Validate peer wallet address
      if (!this.isValidWalletAddress(config.peerWallet)) {
        return createResult.error(ErrorFactory.invalidWalletAddress(config.peerWallet));
      }

      // Generate session ID
      const sessionId = this.generateSessionId(this.currentWallet.address, config.peerWallet);

      // Create shared key (simplified for demo)
      const sharedKey = this.deriveSharedKey(this.currentWallet.address, config.peerWallet);

      const session: ChatSession = {
        session_id: sessionId,
        peer_wallet: config.peerWallet,
        sharedKey: sharedKey
      };

      this.activeSessions.set(sessionId, session);
      this.log('Session started:', sessionId);
      
      Metrics.business('session_created', 1, { sessionId, peerWallet: config.peerWallet });
      return createResult.success(session);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to start session: ${error}`,
        'Failed to start chat session',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send a message in a session
   */
  async sendMessage(sessionId: string, plaintext: string): Promise<Result<DeliveryReceipt>> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        'Session not found',
        'Chat session not found. Please start a new session.'
      ));
    }

    if (!this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'Message bus not available',
        'Messaging service is not available'
      ));
    }

    try {
      const result = await Metrics.time('message_send', async () => {
        return await this.messageBus!.sendMessage(session, plaintext);
      });
      
      if (result.success) {
        this.log('Message sent:', result.data!.messageId);
        Metrics.business('message_sent', 1, { sessionId, messageId: result.data!.messageId });
      } else {
        Metrics.action('message_send_failed', undefined, { sessionId, error: result.error?.message });
      }
      
      return result;
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to send message: ${error}`,
        'Failed to send message. Please try again.',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Subscribe to messages for a session
   */
  subscribeToMessages(sessionId: string, handler: MessageHandler): Result<Subscription> {
    if (!this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'Message bus not available',
        'Messaging service is not available'
      ));
    }

    try {
      // Wrap handler to add session context
      const wrappedHandler: MessageHandler = (message: Message) => {
        this.log('Message received:', message);
        handler({
          ...message,
          session_id: sessionId
        });
      };

      return this.messageBus.subscribeToMessages(sessionId, wrappedHandler);
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
   * End a chat session
   */
  async endSession(sessionId: string): Promise<Result<void>> {
    try {
      this.activeSessions.delete(sessionId);
      this.log('Session ended:', sessionId);
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to end session: ${error}`,
        'Error occurred while ending session',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get current wallet info
   */
  getCurrentWallet(): WalletInfo | null {
    return this.currentWallet;
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): ChatSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): string {
    return this.messageBus?.connectionStatus || 'disconnected';
  }

  /**
   * Check if SDK is ready for use
   */
  get isReady(): boolean {
    return this.isInitialized && 
           this.currentWallet?.connected === true && 
           this.messageBus?.isReady === true;
  }

  /**
   * Get stored messages for a session
   */
  async getStoredMessages(sessionId: string, limit?: number): Promise<Result<Message[]>> {
    if (!this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'SDK not initialized',
        'Please initialize the SDK first'
      ));
    }

    return await this.messageBus.getStoredMessages(sessionId, limit);
  }

  /**
   * Clear stored messages for a session
   */
  async clearStoredMessages(sessionId: string): Promise<Result<void>> {
    if (!this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'SDK not initialized',
        'Please initialize the SDK first'
      ));
    }

    return await this.messageBus.clearStoredMessages(sessionId);
  }

  /**
   * Export all messages for backup
   */
  async exportMessages(): Promise<Result<string>> {
    if (!this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'SDK not initialized',
        'Please initialize the SDK first'
      ));
    }

    return await this.messageBus.exportMessages();
  }

  /**
   * Import messages from backup
   */
  async importMessages(data: string): Promise<Result<number>> {
    if (!this.messageBus) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'SDK not initialized',
        'Please initialize the SDK first'
      ));
    }

    return await this.messageBus.importMessages(data);
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<Result<void>> {
    try {
      // Disconnect wallet
      if (this.currentWallet?.connected) {
        await this.disconnectWallet();
      }

      // Disconnect message bus
      if (this.messageBus) {
        await this.messageBus.disconnect();
        this.messageBus = null;
      }

      this.isInitialized = false;
      this.log('SDK cleanup completed');

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Cleanup failed: ${error}`,
        'Error occurred during cleanup',
        { error: error?.toString() }
      ));
    }
  }

  // Private helper methods

  private generateTestWalletAddress(): string {
    // Generate a realistic-looking Solana address for demo
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private isValidWalletAddress(address: string): boolean {
    // Basic validation for Solana address format
    return typeof address === 'string' && 
           address.length >= 32 && 
           address.length <= 44 &&
           /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
  }

  private generateSessionId(wallet1: string, wallet2: string): string {
    // Create deterministic session ID from both wallet addresses
    const sortedWallets = [wallet1, wallet2].sort();
    const timestamp = Date.now();
    return `session_${sortedWallets[0].slice(0, 8)}_${sortedWallets[1].slice(0, 8)}_${timestamp}`;
  }

  private deriveSharedKey(myWallet: string, peerWallet: string): Uint8Array {
    // Simplified key derivation for demo
    // In production, this would use proper X25519 ECDH
    const keyMaterial = myWallet + peerWallet;
    const encoder = new TextEncoder();
    const data = encoder.encode(keyMaterial);
    
    // Create a 32-byte key from the wallet addresses
    const key = new Uint8Array(32);
    for (let i = 0; i < key.length; i++) {
      key[i] = data[i % data.length] ^ (i + 42);
    }
    
    return key;
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[SolConnectSDK] ${message}`, ...args);
    }
  }
}

/**
 * Global SDK instance
 */
let globalSDK: SolConnectSDK | null = null;

/**
 * Initialize and get the global SDK instance
 */
export async function initializeSDK(config: SDKConfig): Promise<Result<SolConnectSDK>> {
  try {
    const sdk = new SolConnectSDK(config);
    const initResult = await sdk.initialize();
    
    if (!initResult.success) {
      return createResult.error(initResult.error!);
    }
    
    globalSDK = sdk;
    return createResult.success(sdk);
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.UNKNOWN_ERROR,
      `Failed to initialize SDK: ${error}`,
      'Failed to initialize SolConnect SDK',
      { error: error?.toString() }
    ));
  }
}

/**
 * Get the global SDK instance
 */
export function getSDK(): SolConnectSDK | null {
  return globalSDK;
}

/**
 * Cleanup the global SDK instance
 */
export async function cleanupSDK(): Promise<Result<void>> {
  if (globalSDK) {
    const result = await globalSDK.cleanup();
    globalSDK = null;
    return result;
  }
  
  return createResult.success(undefined);
}