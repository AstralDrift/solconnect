/**
 * Secure key storage for Signal Protocol
 * Handles persistent storage of cryptographic keys
 */

import { createResult, Result, SolConnectError, ErrorCode } from '../../types/errors';
import { SignedPreKey, OneTimePreKey, SessionState } from './SignalProtocol';
import { CryptoUtils } from './CryptoUtils';
import { Logger } from '../monitoring/Logger';

export interface StoredIdentityKey {
  walletAddress: string;
  publicKey: Uint8Array;
  privateKey: CryptoKey;
  createdAt: number;
}

export interface StoredPreKey {
  keyId: number;
  publicKey: Uint8Array;
  privateKey: CryptoKey;
  createdAt: number;
}

interface KeyStorageBackend {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * IndexedDB backend for browser environments
 */
class IndexedDBBackend implements KeyStorageBackend {
  private dbName = 'SolConnectKeyStorage';
  private storeName = 'keys';
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(key: string): Promise<any> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, value: any): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async keys(): Promise<string[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();
      
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * LocalStorage backend for simple environments
 */
class LocalStorageBackend implements KeyStorageBackend {
  private prefix = 'solconnect_keys_';

  async get(key: string): Promise<any> {
    const item = localStorage.getItem(this.prefix + key);
    return item ? JSON.parse(item) : null;
  }

  async set(key: string, value: any): Promise<void> {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keys = await this.keys();
    keys.forEach(key => localStorage.removeItem(key));
  }

  async keys(): Promise<string[]> {
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
 * Secure key storage service
 */
export class KeyStorage {
  private logger = new Logger('KeyStorage');
  private backend: KeyStorageBackend;
  private encryptionKey?: CryptoKey;
  private isInitialized = false;

  constructor(backend?: KeyStorageBackend) {
    // Use IndexedDB if available, fallback to localStorage
    if (backend) {
      this.backend = backend;
    } else if (typeof indexedDB !== 'undefined') {
      this.backend = new IndexedDBBackend();
    } else {
      this.backend = new LocalStorageBackend();
    }
  }

  /**
   * Initialize key storage with encryption
   */
  async initialize(password?: string): Promise<Result<void>> {
    try {
      if (this.isInitialized) {
        return createResult.success(undefined);
      }

      // Derive storage encryption key from password or use default
      if (password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveBits', 'deriveKey']
        );

        this.encryptionKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: encoder.encode('SolConnect-KeyStorage-Salt'),
            iterations: 100000,
            hash: 'SHA-256',
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      }

      this.isInitialized = true;
      this.logger.info('Key storage initialized');
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize key storage', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to initialize key storage: ${error}`,
        'Key storage initialization failed'
      ));
    }
  }

  /**
   * Store identity key pair
   */
  async storeIdentityKeyPair(
    walletAddress: string,
    keyPair: CryptoKeyPair
  ): Promise<Result<void>> {
    try {
      const publicKeyBytes = await CryptoUtils.exportKey(keyPair.publicKey);
      
      // Store private key securely
      const privateKeyData = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      
      const stored: StoredIdentityKey = {
        walletAddress,
        publicKey: publicKeyBytes,
        privateKey: keyPair.privateKey,
        createdAt: Date.now(),
      };

      // Encrypt if encryption key is available
      const dataToStore = this.encryptionKey
        ? await this.encryptData(privateKeyData)
        : privateKeyData;

      await this.backend.set(`identity_${walletAddress}`, {
        publicKey: Array.from(publicKeyBytes),
        privateKey: dataToStore,
        createdAt: stored.createdAt,
      });

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to store identity key: ${error}`,
        'Failed to save encryption keys'
      ));
    }
  }

  /**
   * Get identity key pair
   */
  async getIdentityKeyPair(walletAddress: string): Promise<Result<CryptoKeyPair | null>> {
    try {
      const stored = await this.backend.get(`identity_${walletAddress}`);
      if (!stored) {
        return createResult.success(null);
      }

      // Decrypt if needed
      const privateKeyData = this.encryptionKey
        ? await this.decryptData(stored.privateKey)
        : stored.privateKey;

      // Import keys
      const publicKey = await CryptoUtils.importKey(
        new Uint8Array(stored.publicKey),
        'Ed25519',
        ['verify']
      );

      const privateKey = await crypto.subtle.importKey(
        'jwk',
        privateKeyData,
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519',
        },
        true,
        ['sign']
      );

      return createResult.success({ publicKey, privateKey });
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get identity key: ${error}`,
        'Failed to load encryption keys'
      ));
    }
  }

  /**
   * Store signed prekey
   */
  async storeSignedPreKey(
    walletAddress: string,
    prekey: SignedPreKey,
    keyPair: CryptoKeyPair
  ): Promise<Result<void>> {
    try {
      const privateKeyData = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      
      const dataToStore = this.encryptionKey
        ? await this.encryptData(privateKeyData)
        : privateKeyData;

      await this.backend.set(`signed_prekey_${walletAddress}`, {
        keyId: prekey.keyId,
        publicKey: Array.from(prekey.publicKey),
        privateKey: dataToStore,
        signature: Array.from(prekey.signature),
        timestamp: prekey.timestamp,
      });

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to store signed prekey: ${error}`,
        'Failed to save prekey'
      ));
    }
  }

  /**
   * Get signed prekey
   */
  async getSignedPreKey(walletAddress: string): Promise<Result<SignedPreKey | null>> {
    try {
      const stored = await this.backend.get(`signed_prekey_${walletAddress}`);
      if (!stored) {
        return createResult.success(null);
      }

      return createResult.success({
        keyId: stored.keyId,
        publicKey: new Uint8Array(stored.publicKey),
        signature: new Uint8Array(stored.signature),
        timestamp: stored.timestamp,
      });
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get signed prekey: ${error}`,
        'Failed to load prekey'
      ));
    }
  }

  /**
   * Store one-time prekey
   */
  async storeOneTimePreKey(
    walletAddress: string,
    prekey: OneTimePreKey,
    keyPair: CryptoKeyPair
  ): Promise<Result<void>> {
    try {
      const privateKeyData = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      
      const dataToStore = this.encryptionKey
        ? await this.encryptData(privateKeyData)
        : privateKeyData;

      await this.backend.set(`otp_${walletAddress}_${prekey.keyId}`, {
        keyId: prekey.keyId,
        publicKey: Array.from(prekey.publicKey),
        privateKey: dataToStore,
      });

      // Update OTP key list
      const otpList = await this.backend.get(`otp_list_${walletAddress}`) || [];
      if (!otpList.includes(prekey.keyId)) {
        otpList.push(prekey.keyId);
        await this.backend.set(`otp_list_${walletAddress}`, otpList);
      }

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to store one-time prekey: ${error}`,
        'Failed to save one-time key'
      ));
    }
  }

  /**
   * Get and remove one-time prekey
   */
  async getOneTimePreKey(walletAddress: string): Promise<Result<OneTimePreKey | null>> {
    try {
      const otpList = await this.backend.get(`otp_list_${walletAddress}`) || [];
      if (otpList.length === 0) {
        return createResult.success(null);
      }

      // Get the first available OTP key
      const keyId = otpList[0];
      const stored = await this.backend.get(`otp_${walletAddress}_${keyId}`);
      
      if (!stored) {
        // Remove from list if not found
        otpList.shift();
        await this.backend.set(`otp_list_${walletAddress}`, otpList);
        return this.getOneTimePreKey(walletAddress); // Recursive call
      }

      // Remove from list and storage
      otpList.shift();
      await this.backend.set(`otp_list_${walletAddress}`, otpList);
      await this.backend.delete(`otp_${walletAddress}_${keyId}`);

      return createResult.success({
        keyId: stored.keyId,
        publicKey: new Uint8Array(stored.publicKey),
      });
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to get one-time prekey: ${error}`,
        'Failed to load one-time key'
      ));
    }
  }

  /**
   * Store session state
   */
  async storeSession(sessionId: string, session: SessionState): Promise<Result<void>> {
    try {
      // Serialize session state
      const serialized = {
        sessionId: session.sessionId,
        rootKey: Array.from(session.rootKey),
        sendingChainKey: Array.from(session.sendingChainKey),
        receivingChainKey: Array.from(session.receivingChainKey),
        sendingRatchetKey: {
          publicKey: Array.from(await CryptoUtils.exportKey(session.sendingRatchetKey.publicKey)),
          privateKey: await crypto.subtle.exportKey('jwk', session.sendingRatchetKey.privateKey),
        },
        receivingRatchetKey: session.receivingRatchetKey ? Array.from(session.receivingRatchetKey) : null,
        previousCounter: session.previousCounter,
        messageNumber: session.messageNumber,
        receivedMessageNumbers: Array.from(session.receivedMessageNumbers),
        skippedMessageKeys: Array.from(session.skippedMessageKeys.entries()).map(([key, value]) => ({
          key,
          messageKey: Array.from(value.messageKey),
          counter: value.counter,
          timestamp: value.timestamp,
        })),
      };

      // Encrypt if encryption key is available
      const dataToStore = this.encryptionKey
        ? await this.encryptData(serialized)
        : serialized;

      await this.backend.set(`session_${sessionId}`, dataToStore);

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to store session: ${error}`,
        'Failed to save session'
      ));
    }
  }

  /**
   * Load session state
   */
  async loadSession(sessionId: string): Promise<Result<SessionState | null>> {
    try {
      const stored = await this.backend.get(`session_${sessionId}`);
      if (!stored) {
        return createResult.success(null);
      }

      // Decrypt if needed
      const serialized = this.encryptionKey
        ? await this.decryptData(stored)
        : stored;

      // Deserialize session state
      const sendingRatchetKey = {
        publicKey: await CryptoUtils.importKey(
          new Uint8Array(serialized.sendingRatchetKey.publicKey),
          'ECDH',
          []
        ),
        privateKey: await crypto.subtle.importKey(
          'jwk',
          serialized.sendingRatchetKey.privateKey,
          {
            name: 'ECDH',
            namedCurve: 'P-256',
          },
          true,
          ['deriveBits', 'deriveKey']
        ),
      };

      const session: SessionState = {
        sessionId: serialized.sessionId,
        rootKey: new Uint8Array(serialized.rootKey),
        sendingChainKey: new Uint8Array(serialized.sendingChainKey),
        receivingChainKey: new Uint8Array(serialized.receivingChainKey),
        sendingRatchetKey,
        receivingRatchetKey: serialized.receivingRatchetKey ? new Uint8Array(serialized.receivingRatchetKey) : undefined,
        previousCounter: serialized.previousCounter,
        messageNumber: serialized.messageNumber,
        receivedMessageNumbers: new Set(serialized.receivedMessageNumbers),
        skippedMessageKeys: new Map(serialized.skippedMessageKeys.map((item: any) => [
          item.key,
          {
            messageKey: new Uint8Array(item.messageKey),
            counter: item.counter,
            timestamp: item.timestamp,
          },
        ])),
      };

      return createResult.success(session);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to load session: ${error}`,
        'Failed to load session'
      ));
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<Result<void>> {
    try {
      await this.backend.delete(`session_${sessionId}`);
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to delete session: ${error}`,
        'Failed to delete session'
      ));
    }
  }

  /**
   * Clear all stored keys
   */
  async clearAll(): Promise<Result<void>> {
    try {
      await this.backend.clear();
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to clear storage: ${error}`,
        'Failed to clear key storage'
      ));
    }
  }

  /**
   * Encrypt data for storage
   */
  private async encryptData(data: any): Promise<any> {
    if (!this.encryptionKey) {
      return data;
    }

    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      this.encryptionKey,
      plaintext
    );

    return {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
    };
  }

  /**
   * Decrypt data from storage
   */
  private async decryptData(data: any): Promise<any> {
    if (!this.encryptionKey || !data.encrypted) {
      return data;
    }

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(data.iv),
      },
      this.encryptionKey,
      new Uint8Array(data.encrypted)
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
}

// Export singleton instance
let keyStorageInstance: KeyStorage | null = null;

export function getKeyStorage(): KeyStorage {
  if (!keyStorageInstance) {
    keyStorageInstance = new KeyStorage();
  }
  return keyStorageInstance;
}

export async function initializeKeyStorage(password?: string): Promise<Result<KeyStorage>> {
  const storage = getKeyStorage();
  const result = await storage.initialize(password);
  if (!result.success) {
    return createResult.error(result.error!);
  }
  return createResult.success(storage);
} 