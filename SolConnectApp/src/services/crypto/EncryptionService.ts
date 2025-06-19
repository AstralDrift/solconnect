/**
 * Encryption Service for SolConnect
 * Integrates Signal Protocol with MessageBus for transparent E2E encryption
 */

import { Logger } from '../monitoring/Logger';
import { createResult, Result, SolConnectError, ErrorCode } from '../../types/errors';
import { Message, ChatSession } from '../../types';
import { SignalProtocol, PreKeyBundle, EncryptedMessage, initializeSignalProtocol, getSignalProtocol } from './SignalProtocol';
import { KeyStorage, initializeKeyStorage, getKeyStorage } from './KeyStorage';
import { CryptoUtils } from './CryptoUtils';
import { DatabaseService } from '../database/DatabaseService';

export interface EncryptedPayload {
  version: number;
  senderWallet: string;
  encryptedMessage: EncryptedMessage;
  preKeyBundle?: PreKeyBundle; // Included in first message to establish session
  timestamp: number;
}

export interface EncryptionServiceConfig {
  autoEstablishSessions: boolean;
  persistSessions: boolean;
  keyStoragePassword?: string;
}

const DEFAULT_CONFIG: EncryptionServiceConfig = {
  autoEstablishSessions: true,
  persistSessions: true,
};

/**
 * Encryption service that provides E2E encryption for messages
 */
export class EncryptionService {
  private logger = new Logger('EncryptionService');
  private signalProtocol?: SignalProtocol;
  private keyStorage?: KeyStorage;
  private config: EncryptionServiceConfig;
  private database?: DatabaseService;
  private myWalletAddress?: string;
  private isInitialized = false;
  
  // Cache for prekey bundles
  private preKeyBundleCache = new Map<string, PreKeyBundle>();
  private preKeyBundleFetchPromises = new Map<string, Promise<PreKeyBundle | null>>();

  constructor(config?: Partial<EncryptionServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the encryption service
   */
  async initialize(
    walletAddress: string,
    database?: DatabaseService
  ): Promise<Result<void>> {
    try {
      if (this.isInitialized) {
        return createResult.success(undefined);
      }

      this.logger.info('Initializing encryption service', { walletAddress });
      this.myWalletAddress = walletAddress;
      this.database = database;

      // Initialize key storage
      const keyStorageResult = await initializeKeyStorage(this.config.keyStoragePassword);
      if (!keyStorageResult.success) {
        return createResult.error(keyStorageResult.error!);
      }
      this.keyStorage = keyStorageResult.data!;

      // Initialize Signal Protocol
      const signalResult = await initializeSignalProtocol(this.keyStorage);
      if (!signalResult.success) {
        return createResult.error(signalResult.error!);
      }
      this.signalProtocol = signalResult.data!;

      // Initialize Signal Protocol for this wallet
      const initResult = await this.signalProtocol.initialize(walletAddress);
      if (!initResult.success) {
        return createResult.error(initResult.error!);
      }

      // Create and publish our prekey bundle
      const bundleResult = await this.createAndPublishPreKeyBundle();
      if (!bundleResult.success) {
        this.logger.warn('Failed to publish prekey bundle', bundleResult.error);
        // Continue - we can still receive messages
      }

      this.isInitialized = true;
      this.logger.info('Encryption service initialized successfully');
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize encryption service', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to initialize encryption: ${error}`,
        'Encryption initialization failed'
      ));
    }
  }

  /**
   * Encrypt a message for sending
   */
  async encryptMessage(
    session: ChatSession,
    plaintext: string
  ): Promise<Result<string>> {
    try {
      if (!this.isInitialized || !this.signalProtocol || !this.myWalletAddress) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Encryption service not initialized',
          'Encryption not available'
        ));
      }

      // Get or establish session
      const sessionId = this.getSessionId(this.myWalletAddress, session.peer_wallet);
      const sessionInfo = await this.signalProtocol.getSessionInfo(sessionId);
      
      let includePreKeyBundle = false;
      if (!sessionInfo.success || !sessionInfo.data?.established) {
        // Need to establish session
        const establishResult = await this.establishSession(session.peer_wallet);
        if (!establishResult.success) {
          return createResult.error(establishResult.error!);
        }
        includePreKeyBundle = true;
      }

      // Encrypt the message
      const plaintextBytes = new TextEncoder().encode(plaintext);
      const encryptResult = await this.signalProtocol.encryptMessage(sessionId, plaintextBytes);
      if (!encryptResult.success || !encryptResult.data) {
        return createResult.error(encryptResult.error!);
      }

      // Create encrypted payload
      const payload: EncryptedPayload = {
        version: 1,
        senderWallet: this.myWalletAddress,
        encryptedMessage: encryptResult.data,
        timestamp: Date.now(),
      };

      // Include prekey bundle if this is the first message
      if (includePreKeyBundle) {
        const bundleResult = await this.signalProtocol.createPreKeyBundle(this.myWalletAddress);
        if (bundleResult.success && bundleResult.data) {
          payload.preKeyBundle = bundleResult.data;
        }
      }

      // Serialize payload
      const serialized = JSON.stringify(payload);
      return createResult.success(serialized);
    } catch (error) {
      this.logger.error('Failed to encrypt message', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to encrypt message: ${error}`,
        'Message encryption failed'
      ));
    }
  }

  /**
   * Decrypt a received message
   */
  async decryptMessage(
    message: Message
  ): Promise<Result<string>> {
    try {
      if (!this.isInitialized || !this.signalProtocol || !this.myWalletAddress) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Encryption service not initialized',
          'Decryption not available'
        ));
      }

      // Parse encrypted payload
      let payload: EncryptedPayload;
      try {
        payload = JSON.parse(message.ciphertext);
      } catch (error) {
        // Not an encrypted message, return as-is
        return createResult.success(message.ciphertext);
      }

      // Check version
      if (payload.version !== 1) {
        return createResult.error(SolConnectError.security(
          ErrorCode.CRYPTO_ERROR,
          `Unsupported encryption version: ${payload.version}`,
          'Unsupported message format'
        ));
      }

      // Get session ID
      const sessionId = this.getSessionId(payload.senderWallet, this.myWalletAddress);
      
      // Check if we need to establish session
      const sessionInfo = await this.signalProtocol.getSessionInfo(sessionId);
      if (!sessionInfo.success || !sessionInfo.data?.established) {
        if (payload.preKeyBundle) {
          // Establish session using included prekey bundle
          const establishResult = await this.signalProtocol.establishSession(
            this.myWalletAddress,
            payload.preKeyBundle
          );
          if (!establishResult.success) {
            return createResult.error(establishResult.error!);
          }
        } else {
          return createResult.error(SolConnectError.security(
            ErrorCode.CRYPTO_ERROR,
            'No session established and no prekey bundle provided',
            'Cannot decrypt message - no encryption session'
          ));
        }
      }

      // Decrypt the message
      const decryptResult = await this.signalProtocol.decryptMessage(
        sessionId,
        payload.encryptedMessage
      );
      if (!decryptResult.success || !decryptResult.data) {
        return createResult.error(decryptResult.error!);
      }

      // Convert to string
      const plaintext = new TextDecoder().decode(decryptResult.data);
      return createResult.success(plaintext);
    } catch (error) {
      this.logger.error('Failed to decrypt message', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to decrypt message: ${error}`,
        'Message decryption failed'
      ));
    }
  }

  /**
   * Establish a session with another wallet
   */
  async establishSession(peerWallet: string): Promise<Result<string>> {
    try {
      if (!this.signalProtocol || !this.myWalletAddress) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Service not initialized',
          'Encryption not available'
        ));
      }

      // Fetch peer's prekey bundle
      const bundleResult = await this.fetchPreKeyBundle(peerWallet);
      if (!bundleResult.success || !bundleResult.data) {
        return createResult.error(SolConnectError.security(
          ErrorCode.CRYPTO_ERROR,
          'Failed to fetch peer prekey bundle',
          'Cannot establish encrypted session'
        ));
      }

      // Establish session
      const sessionResult = await this.signalProtocol.establishSession(
        this.myWalletAddress,
        bundleResult.data
      );

      return sessionResult;
    } catch (error) {
      this.logger.error('Failed to establish session', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to establish session: ${error}`,
        'Session establishment failed'
      ));
    }
  }

  /**
   * Get session info
   */
  async getSessionInfo(peerWallet: string): Promise<Result<{
    established: boolean;
    messagesSent: number;
    messagesReceived: number;
    lastActivity: Date;
  }>> {
    if (!this.signalProtocol || !this.myWalletAddress) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        'Service not initialized',
        'Encryption not available'
      ));
    }

    const sessionId = this.getSessionId(this.myWalletAddress, peerWallet);
    return this.signalProtocol.getSessionInfo(sessionId);
  }

  /**
   * Delete a session
   */
  async deleteSession(peerWallet: string): Promise<Result<void>> {
    if (!this.signalProtocol || !this.myWalletAddress) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        'Service not initialized',
        'Encryption not available'
      ));
    }

    const sessionId = this.getSessionId(this.myWalletAddress, peerWallet);
    return this.signalProtocol.deleteSession(sessionId);
  }

  /**
   * Create message interceptor for MessageBus
   */
  createMessageInterceptor() {
    return {
      /**
       * Intercept outgoing messages for encryption
       */
      beforeSend: async (session: ChatSession, message: string): Promise<Result<string>> => {
        if (!this.isInitialized) {
          // Pass through if not initialized
          return createResult.success(message);
        }

        return this.encryptMessage(session, message);
      },

      /**
       * Intercept incoming messages for decryption
       */
      afterReceive: async (message: Message): Promise<Result<Message>> => {
        if (!this.isInitialized) {
          // Pass through if not initialized
          return createResult.success(message);
        }

        const decryptResult = await this.decryptMessage(message);
        if (!decryptResult.success) {
          this.logger.warn('Failed to decrypt message', decryptResult.error);
          // Return original message on decryption failure
          return createResult.success(message);
        }

        // Return message with decrypted content
        return createResult.success({
          ...message,
          ciphertext: decryptResult.data!,
        });
      },
    };
  }

  /**
   * Export session for backup
   */
  async exportSession(peerWallet: string): Promise<Result<string>> {
    if (!this.signalProtocol || !this.myWalletAddress || !this.keyStorage) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        'Service not initialized',
        'Encryption not available'
      ));
    }

    try {
      const sessionId = this.getSessionId(this.myWalletAddress, peerWallet);
      const sessionResult = await this.keyStorage.loadSession(sessionId);
      if (!sessionResult.success || !sessionResult.data) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Session not found',
          'No encrypted session to export'
        ));
      }

      // Serialize session for export
      const exportData = {
        version: 1,
        sessionId,
        walletAddress: this.myWalletAddress,
        peerWallet,
        timestamp: Date.now(),
        // Session data would be encrypted here in production
      };

      return createResult.success(JSON.stringify(exportData));
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to export session: ${error}`,
        'Session export failed'
      ));
    }
  }

  /**
   * Import session from backup
   */
  async importSession(exportData: string): Promise<Result<void>> {
    // Implementation for session import
    // Would validate and restore session state
    return createResult.error(SolConnectError.system(
      ErrorCode.NOT_IMPLEMENTED,
      'Session import not implemented',
      'Feature coming soon'
    ));
  }

  /**
   * Create and publish prekey bundle
   */
  private async createAndPublishPreKeyBundle(): Promise<Result<void>> {
    try {
      if (!this.signalProtocol || !this.myWalletAddress) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Service not initialized',
          'Cannot create prekey bundle'
        ));
      }

      // Create prekey bundle
      const bundleResult = await this.signalProtocol.createPreKeyBundle(this.myWalletAddress);
      if (!bundleResult.success || !bundleResult.data) {
        return createResult.error(bundleResult.error!);
      }

      // Store in cache
      this.preKeyBundleCache.set(this.myWalletAddress, bundleResult.data);

      // Publish to database if available
      if (this.database) {
        // Store prekey bundle in database for others to fetch
        // This would be implemented based on your database schema
        this.logger.info('Publishing prekey bundle to database');
      }

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to publish prekey bundle: ${error}`,
        'Failed to publish encryption keys'
      ));
    }
  }

  /**
   * Fetch prekey bundle for a wallet
   */
  private async fetchPreKeyBundle(walletAddress: string): Promise<Result<PreKeyBundle | null>> {
    try {
      // Check cache first
      const cached = this.preKeyBundleCache.get(walletAddress);
      if (cached) {
        return createResult.success(cached);
      }

      // Check if we're already fetching this bundle
      const existingPromise = this.preKeyBundleFetchPromises.get(walletAddress);
      if (existingPromise) {
        const result = await existingPromise;
        return createResult.success(result);
      }

      // Create fetch promise
      const fetchPromise = this.doFetchPreKeyBundle(walletAddress);
      this.preKeyBundleFetchPromises.set(walletAddress, fetchPromise);

      try {
        const bundle = await fetchPromise;
        this.preKeyBundleFetchPromises.delete(walletAddress);
        
        if (bundle) {
          this.preKeyBundleCache.set(walletAddress, bundle);
        }
        
        return createResult.success(bundle);
      } catch (error) {
        this.preKeyBundleFetchPromises.delete(walletAddress);
        throw error;
      }
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to fetch prekey bundle: ${error}`,
        'Failed to fetch encryption keys'
      ));
    }
  }

  /**
   * Actually fetch prekey bundle from storage/network
   */
  private async doFetchPreKeyBundle(walletAddress: string): Promise<PreKeyBundle | null> {
    // In production, this would:
    // 1. Check local database
    // 2. Fetch from relay server if not found
    // 3. Validate the bundle signature
    
    // For now, return null (no bundle found)
    this.logger.warn('Prekey bundle fetch not implemented', { walletAddress });
    return null;
  }

  /**
   * Get consistent session ID for two wallets
   */
  private getSessionId(wallet1: string, wallet2: string): string {
    const sorted = [wallet1, wallet2].sort();
    return `${sorted[0]}:${sorted[1]}`;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.preKeyBundleCache.clear();
    this.preKeyBundleFetchPromises.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

export async function initializeEncryptionService(
  walletAddress: string,
  database?: DatabaseService,
  config?: Partial<EncryptionServiceConfig>
): Promise<Result<EncryptionService>> {
  try {
    const service = new EncryptionService(config);
    const result = await service.initialize(walletAddress, database);
    if (!result.success) {
      return createResult.error(result.error!);
    }
    
    encryptionServiceInstance = service;
    return createResult.success(service);
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.CRYPTO_ERROR,
      `Failed to initialize encryption service: ${error}`,
      'Failed to initialize encryption'
    ));
  }
} 