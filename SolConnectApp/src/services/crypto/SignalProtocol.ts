/**
 * Signal Protocol Implementation for SolConnect
 * Implements Double Ratchet algorithm for end-to-end encryption
 */

import { Logger } from '../monitoring/Logger';
import { createResult, Result, SolConnectError, ErrorCode } from '../../types/errors';
import { KeyStorage } from './KeyStorage';
import { CryptoUtils } from './CryptoUtils';

export interface PreKeyBundle {
  walletAddress: string;
  identityKey: Uint8Array;          // Ed25519 public key
  signedPreKey: SignedPreKey;
  oneTimePreKey?: OneTimePreKey;   // Optional one-time prekey
  signature: Uint8Array;            // Signature of bundle
}

export interface SignedPreKey {
  keyId: number;
  publicKey: Uint8Array;           // X25519 public key
  signature: Uint8Array;           // Ed25519 signature
  timestamp: number;
}

export interface OneTimePreKey {
  keyId: number;
  publicKey: Uint8Array;           // X25519 public key
}

export interface SessionState {
  sessionId: string;
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingRatchetKey: CryptoKeyPair;
  receivingRatchetKey?: Uint8Array;
  previousCounter: number;
  messageNumber: number;
  receivedMessageNumbers: Set<number>;
  skippedMessageKeys: Map<string, SkippedMessageKey>;
}

interface SkippedMessageKey {
  messageKey: Uint8Array;
  counter: number;
  timestamp: number;
}

export interface EncryptedMessage {
  header: MessageHeader;
  ciphertext: Uint8Array;
  mac: Uint8Array;
}

export interface MessageHeader {
  dhPublicKey: Uint8Array;         // Current ratchet public key
  previousChainLength: number;     // Number of messages in previous chain
  messageNumber: number;           // Message number in current chain
}

export interface SignalProtocolConfig {
  maxSkippedMessages: number;
  maxStoredSessions: number;
  prekeyRotationInterval: number;  // Hours
  sessionTimeout: number;          // Hours
}

const DEFAULT_CONFIG: SignalProtocolConfig = {
  maxSkippedMessages: 1000,
  maxStoredSessions: 100,
  prekeyRotationInterval: 24 * 7,  // 1 week
  sessionTimeout: 24 * 30,          // 30 days
};

/**
 * Signal Protocol implementation with Double Ratchet
 */
export class SignalProtocol {
  private logger = new Logger('SignalProtocol');
  private keyStorage: KeyStorage;
  private config: SignalProtocolConfig;
  private sessions = new Map<string, SessionState>();
  private readonly INFO_ROOT = new TextEncoder().encode('SolConnect_Root');
  private readonly INFO_CHAIN = new TextEncoder().encode('SolConnect_Chain');
  private readonly INFO_MSG = new TextEncoder().encode('SolConnect_Message');
  
  constructor(keyStorage: KeyStorage, config?: Partial<SignalProtocolConfig>) {
    this.keyStorage = keyStorage;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize Signal Protocol for a wallet
   */
  async initialize(walletAddress: string): Promise<Result<void>> {
    try {
      this.logger.info('Initializing Signal Protocol', { walletAddress });

      // Generate identity key if not exists
      const identityResult = await this.keyStorage.getIdentityKeyPair(walletAddress);
      if (!identityResult.success) {
        // Generate new identity key from wallet
        const generateResult = await this.generateIdentityKey(walletAddress);
        if (!generateResult.success) {
          return generateResult;
        }
      }

      // Generate initial prekeys
      const prekeyResult = await this.generatePreKeys(walletAddress);
      if (!prekeyResult.success) {
        return prekeyResult;
      }

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize Signal Protocol', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to initialize Signal Protocol: ${error}`,
        'Encryption initialization failed'
      ));
    }
  }

  /**
   * Create a prekey bundle for sharing with other users
   */
  async createPreKeyBundle(walletAddress: string): Promise<Result<PreKeyBundle>> {
    try {
      // Get identity key
      const identityResult = await this.keyStorage.getIdentityKeyPair(walletAddress);
      if (!identityResult.success || !identityResult.data) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Identity key not found',
          'Encryption keys not initialized'
        ));
      }

      // Get signed prekey
      const signedPrekeyResult = await this.keyStorage.getSignedPreKey(walletAddress);
      if (!signedPrekeyResult.success || !signedPrekeyResult.data) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Signed prekey not found',
          'Encryption keys not available'
        ));
      }

      // Get one-time prekey (optional)
      const oneTimePrekeyResult = await this.keyStorage.getOneTimePreKey(walletAddress);
      
      // Create bundle
      const bundle: PreKeyBundle = {
        walletAddress,
        identityKey: identityResult.data.publicKey,
        signedPreKey: signedPrekeyResult.data,
        oneTimePreKey: oneTimePrekeyResult.success ? oneTimePrekeyResult.data : undefined,
        signature: new Uint8Array(64), // Will be signed by wallet
      };

      // Sign the bundle
      const signResult = await this.signPreKeyBundle(bundle, identityResult.data);
      if (!signResult.success) {
        return signResult;
      }

      return createResult.success(bundle);
    } catch (error) {
      this.logger.error('Failed to create prekey bundle', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to create prekey bundle: ${error}`,
        'Failed to prepare encryption keys'
      ));
    }
  }

  /**
   * Establish a session with another user using their prekey bundle
   */
  async establishSession(
    myWalletAddress: string,
    theirBundle: PreKeyBundle
  ): Promise<Result<string>> {
    try {
      const sessionId = this.getSessionId(myWalletAddress, theirBundle.walletAddress);
      
      // Verify bundle signature
      const verifyResult = await this.verifyPreKeyBundle(theirBundle);
      if (!verifyResult.success) {
        return createResult.error(SolConnectError.security(
          ErrorCode.CRYPTO_ERROR,
          'Invalid prekey bundle signature',
          'Cannot verify peer encryption keys'
        ));
      }

      // Get my identity key
      const myIdentityResult = await this.keyStorage.getIdentityKeyPair(myWalletAddress);
      if (!myIdentityResult.success || !myIdentityResult.data) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          'Identity key not found',
          'Your encryption keys not found'
        ));
      }

      // Generate ephemeral key for X3DH
      const ephemeralKey = await CryptoUtils.generateX25519KeyPair();

      // Perform X3DH key agreement
      const x3dhResult = await this.performX3DH(
        myIdentityResult.data,
        ephemeralKey,
        theirBundle
      );
      if (!x3dhResult.success || !x3dhResult.data) {
        return createResult.error(x3dhResult.error!);
      }

      // Initialize Double Ratchet
      const sessionState: SessionState = {
        sessionId,
        rootKey: x3dhResult.data.sharedSecret,
        sendingChainKey: new Uint8Array(32),
        receivingChainKey: new Uint8Array(32),
        sendingRatchetKey: await CryptoUtils.generateX25519KeyPair(),
        receivingRatchetKey: theirBundle.signedPreKey.publicKey,
        previousCounter: 0,
        messageNumber: 0,
        receivedMessageNumbers: new Set(),
        skippedMessageKeys: new Map(),
      };

      // Derive initial chain keys
      const kdfResult = await this.ratchetRootKey(
        sessionState.rootKey,
        sessionState.sendingRatchetKey,
        sessionState.receivingRatchetKey!
      );
      if (!kdfResult.success || !kdfResult.data) {
        return createResult.error(kdfResult.error!);
      }

      sessionState.rootKey = kdfResult.data.rootKey;
      sessionState.sendingChainKey = kdfResult.data.chainKey;

      // Store session
      this.sessions.set(sessionId, sessionState);
      const storeResult = await this.keyStorage.storeSession(sessionId, sessionState);
      if (!storeResult.success) {
        return createResult.error(storeResult.error!);
      }

      this.logger.info('Session established', { sessionId });
      return createResult.success(sessionId);
    } catch (error) {
      this.logger.error('Failed to establish session', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to establish session: ${error}`,
        'Failed to establish encrypted session'
      ));
    }
  }

  /**
   * Encrypt a message using Double Ratchet
   */
  async encryptMessage(
    sessionId: string,
    plaintext: Uint8Array
  ): Promise<Result<EncryptedMessage>> {
    try {
      // Get session state
      const session = await this.getSession(sessionId);
      if (!session) {
        return createResult.error(SolConnectError.security(
          ErrorCode.CRYPTO_ERROR,
          'Session not found',
          'No encrypted session found'
        ));
      }

      // Derive message key
      const messageKeyResult = await this.deriveMessageKey(session.sendingChainKey);
      if (!messageKeyResult.success || !messageKeyResult.data) {
        return createResult.error(messageKeyResult.error!);
      }

      // Update chain key
      session.sendingChainKey = await this.deriveNextChainKey(session.sendingChainKey);

      // Create header
      const header: MessageHeader = {
        dhPublicKey: session.sendingRatchetKey.publicKey,
        previousChainLength: session.previousCounter,
        messageNumber: session.messageNumber,
      };

      // Encrypt message
      const encryptResult = await CryptoUtils.encryptAESGCM(
        plaintext,
        messageKeyResult.data,
        this.createAssociatedData(header)
      );
      if (!encryptResult.success || !encryptResult.data) {
        return createResult.error(encryptResult.error!);
      }

      // Create encrypted message
      const encryptedMessage: EncryptedMessage = {
        header,
        ciphertext: encryptResult.data.ciphertext,
        mac: encryptResult.data.tag,
      };

      // Update session state
      session.messageNumber++;
      await this.keyStorage.storeSession(sessionId, session);

      return createResult.success(encryptedMessage);
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
   * Decrypt a message using Double Ratchet
   */
  async decryptMessage(
    sessionId: string,
    encryptedMessage: EncryptedMessage
  ): Promise<Result<Uint8Array>> {
    try {
      // Get session state
      const session = await this.getSession(sessionId);
      if (!session) {
        return createResult.error(SolConnectError.security(
          ErrorCode.CRYPTO_ERROR,
          'Session not found',
          'No encrypted session found'
        ));
      }

      // Try to decrypt with skipped message keys first
      const skippedResult = await this.trySkippedMessageKeys(session, encryptedMessage);
      if (skippedResult.success && skippedResult.data) {
        return skippedResult;
      }

      // Check if we need to perform DH ratchet
      if (!session.receivingRatchetKey || 
          !CryptoUtils.compareKeys(encryptedMessage.header.dhPublicKey, session.receivingRatchetKey)) {
        const ratchetResult = await this.performDHRatchet(session, encryptedMessage.header);
        if (!ratchetResult.success) {
          return ratchetResult;
        }
      }

      // Skip messages if needed
      if (encryptedMessage.header.messageNumber > session.messageNumber) {
        const skipResult = await this.skipMessages(
          session,
          encryptedMessage.header.messageNumber - session.messageNumber
        );
        if (!skipResult.success) {
          return skipResult;
        }
      }

      // Derive message key
      const messageKeyResult = await this.deriveMessageKey(session.receivingChainKey);
      if (!messageKeyResult.success || !messageKeyResult.data) {
        return createResult.error(messageKeyResult.error!);
      }

      // Update chain key
      session.receivingChainKey = await this.deriveNextChainKey(session.receivingChainKey);

      // Decrypt message
      const decryptResult = await CryptoUtils.decryptAESGCM(
        encryptedMessage.ciphertext,
        messageKeyResult.data,
        encryptedMessage.mac,
        this.createAssociatedData(encryptedMessage.header)
      );
      if (!decryptResult.success) {
        return decryptResult;
      }

      // Update session state
      session.messageNumber = encryptedMessage.header.messageNumber + 1;
      session.receivedMessageNumbers.add(encryptedMessage.header.messageNumber);
      await this.keyStorage.storeSession(sessionId, session);

      return decryptResult;
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
   * Perform X3DH key agreement
   */
  private async performX3DH(
    myIdentity: CryptoKeyPair,
    myEphemeral: CryptoKeyPair,
    theirBundle: PreKeyBundle
  ): Promise<Result<{ sharedSecret: Uint8Array }>> {
    try {
      // DH1: myIdentity -> theirIdentity
      const dh1 = await CryptoUtils.performECDH(myIdentity.privateKey, theirBundle.identityKey);
      
      // DH2: myEphemeral -> theirIdentity  
      const dh2 = await CryptoUtils.performECDH(myEphemeral.privateKey, theirBundle.identityKey);
      
      // DH3: myEphemeral -> theirSignedPreKey
      const dh3 = await CryptoUtils.performECDH(myEphemeral.privateKey, theirBundle.signedPreKey.publicKey);
      
      // DH4: myEphemeral -> theirOneTimePreKey (if available)
      let dh4: Uint8Array | undefined;
      if (theirBundle.oneTimePreKey) {
        dh4 = await CryptoUtils.performECDH(myEphemeral.privateKey, theirBundle.oneTimePreKey.publicKey);
      }

      // Combine DH results
      const input = new Uint8Array(
        32 + // FF pattern
        dh1.length + 
        dh2.length + 
        dh3.length + 
        (dh4?.length || 0)
      );
      
      let offset = 0;
      input.fill(0xFF, 0, 32); // X3DH pattern
      offset += 32;
      
      input.set(dh1, offset);
      offset += dh1.length;
      
      input.set(dh2, offset);
      offset += dh2.length;
      
      input.set(dh3, offset);
      offset += dh3.length;
      
      if (dh4) {
        input.set(dh4, offset);
      }

      // Derive shared secret using HKDF
      const sharedSecret = await CryptoUtils.deriveKey(
        input,
        new Uint8Array(0), // No salt
        new TextEncoder().encode('Signal_X3DH_Shared_Secret'),
        32
      );

      return createResult.success({ sharedSecret });
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `X3DH key agreement failed: ${error}`,
        'Key exchange failed'
      ));
    }
  }

  /**
   * Perform Diffie-Hellman ratchet step
   */
  private async performDHRatchet(
    session: SessionState,
    header: MessageHeader
  ): Promise<Result<void>> {
    try {
      // Store previous counter
      session.previousCounter = session.messageNumber;
      session.messageNumber = 0;

      // Update receiving ratchet key
      session.receivingRatchetKey = header.dhPublicKey;

      // Perform DH and update root key
      const dhResult = await CryptoUtils.performECDH(
        session.sendingRatchetKey.privateKey,
        session.receivingRatchetKey
      );

      const kdfResult = await this.ratchetRootKey(
        session.rootKey,
        session.sendingRatchetKey,
        session.receivingRatchetKey
      );
      if (!kdfResult.success || !kdfResult.data) {
        return createResult.error(kdfResult.error!);
      }

      session.rootKey = kdfResult.data.rootKey;
      session.receivingChainKey = kdfResult.data.chainKey;

      // Generate new sending ratchet key
      session.sendingRatchetKey = await CryptoUtils.generateX25519KeyPair();

      // Derive new sending chain key
      const sendKdfResult = await this.ratchetRootKey(
        session.rootKey,
        session.sendingRatchetKey,
        session.receivingRatchetKey
      );
      if (!sendKdfResult.success || !sendKdfResult.data) {
        return createResult.error(sendKdfResult.error!);
      }

      session.rootKey = sendKdfResult.data.rootKey;
      session.sendingChainKey = sendKdfResult.data.chainKey;

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `DH ratchet failed: ${error}`,
        'Key ratchet failed'
      ));
    }
  }

  /**
   * Ratchet the root key and derive a new sending/receiving chain key.
   */
  private async ratchetRootKey(
    rootKey: Uint8Array,
    ourRatchetKey: CryptoKeyPair,
    theirRatchetKey: Uint8Array
  ): Promise<Result<{ rootKey: Uint8Array; chainKey: Uint8Array }>> {
    try {
      // Perform DH between our private and their public
      const dh = await CryptoUtils.performECDH(
        ourRatchetKey.privateKey,
        theirRatchetKey
      );

      // Derive 64-byte output: first 32 = new root, last 32 = chain
      const derived = await CryptoUtils.deriveKey(
        dh,
        rootKey, // use previous root as salt to mix forward secrecy
        this.INFO_ROOT,
        64
      );

      const newRoot = derived.slice(0, 32);
      const chainKey = derived.slice(32);
      return createResult.success({ rootKey: newRoot, chainKey });
    } catch (error) {
      return createResult.error(
        SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          `Root ratchet failed: ${error}`,
          'Encryption key ratchet failed'
        )
      );
    }
  }

  /**
   * Derive a message key from chain key.
   */
  private async deriveMessageKey(chainKey: Uint8Array): Promise<Result<Uint8Array>> {
    try {
      const mk = await CryptoUtils.deriveKey(
        chainKey,
        new Uint8Array(0),
        this.INFO_MSG,
        32
      );
      return createResult.success(mk);
    } catch (error) {
      return createResult.error(
        SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          `Derive message key failed: ${error}`,
          'Encryption failed'
        )
      );
    }
  }

  /**
   * Derive next chain key from current chain key.
   */
  private async deriveNextChainKey(chainKey: Uint8Array): Promise<Uint8Array> {
    // Using HKDF with different info string
    return await CryptoUtils.deriveKey(
      chainKey,
      new Uint8Array(0),
      this.INFO_CHAIN,
      32
    );
  }

  /**
   * Handle skipped messages keys up to maxSkippedMessages.
   */
  private async skipMessages(
    session: SessionState,
    count: number
  ): Promise<Result<void>> {
    try {
      for (let i = 0; i < count; i++) {
        const msgKeyRes = await this.deriveMessageKey(session.receivingChainKey);
        if (!msgKeyRes.success) return createResult.error(msgKeyRes.error!);
        const msgKey = msgKeyRes.data!;

        const keyId = this.getSkippedKeyId(session.receivingRatchetKey!, session.messageNumber + i);
        session.skippedMessageKeys.set(keyId, {
          messageKey: msgKey,
          counter: session.messageNumber + i,
          timestamp: Date.now(),
        });

        // Advance chain key
        session.receivingChainKey = await this.deriveNextChainKey(session.receivingChainKey);

        // Enforce limit
        if (session.skippedMessageKeys.size > this.config.maxSkippedMessages) {
          const oldest = [...session.skippedMessageKeys.keys()][0];
          session.skippedMessageKeys.delete(oldest);
        }
      }
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(
        SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          `Skip messages failed: ${error}`,
          'Failed to handle skipped messages'
        )
      );
    }
  }

  /**
   * Try previously-derived skipped keys for out-of-order message.
   */
  private async trySkippedMessageKeys(
    session: SessionState,
    encryptedMessage: EncryptedMessage
  ): Promise<Result<Uint8Array | null>> {
    const keyId = this.getSkippedKeyId(
      encryptedMessage.header.dhPublicKey,
      encryptedMessage.header.messageNumber
    );
    const entry = session.skippedMessageKeys.get(keyId);
    if (!entry) return createResult.success(null);

    // Attempt decryption
    const ad = this.createAssociatedData(encryptedMessage.header);
    const decRes = await CryptoUtils.decryptAESGCM(
      encryptedMessage.ciphertext,
      entry.messageKey,
      encryptedMessage.mac,
      ad
    );

    // Regardless of success, remove key
    session.skippedMessageKeys.delete(keyId);

    return decRes.success ? decRes : createResult.success(null);
  }

  private getSkippedKeyId(dhPub: Uint8Array, counter: number): string {
    return `${Buffer.from(dhPub).toString('hex')}_${counter}`;
  }

  /**
   * Create associated data for AEAD
   */
  private createAssociatedData(header: MessageHeader): Uint8Array {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({
      dhPublicKey: Array.from(header.dhPublicKey),
      previousChainLength: header.previousChainLength,
      messageNumber: header.messageNumber,
    }));
    return data;
  }

  /**
   * Clean up old skipped keys
   */
  private cleanupSkippedKeys(session: SessionState): void {
    const now = Date.now();
    const maxAge = this.config.sessionTimeout * 60 * 60 * 1000;

    for (const [key, value] of session.skippedMessageKeys.entries()) {
      if (now - value.timestamp > maxAge) {
        session.skippedMessageKeys.delete(key);
      }
    }
  }

  /**
   * Generate identity key from wallet
   */
  private async generateIdentityKey(walletAddress: string): Promise<Result<void>> {
    try {
      // In production, this would derive from wallet's Ed25519 key
      // For now, generate a new key
      const identityKey = await CryptoUtils.generateEd25519KeyPair();
      
      const storeResult = await this.keyStorage.storeIdentityKeyPair(
        walletAddress,
        identityKey
      );
      
      return storeResult;
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to generate identity key: ${error}`,
        'Failed to generate encryption keys'
      ));
    }
  }

  /**
   * Generate prekeys for a wallet
   */
  private async generatePreKeys(walletAddress: string): Promise<Result<void>> {
    try {
      // Generate signed prekey
      const signedPreKey = await CryptoUtils.generateX25519KeyPair();
      const signedPrekeyData: SignedPreKey = {
        keyId: 1,
        publicKey: signedPreKey.publicKey,
        signature: new Uint8Array(64), // Will be signed by identity key
        timestamp: Date.now(),
      };

      // Sign the prekey
      const identityResult = await this.keyStorage.getIdentityKeyPair(walletAddress);
      if (identityResult.success && identityResult.data) {
        const signResult = await CryptoUtils.sign(
          signedPreKey.publicKey,
          identityResult.data.privateKey
        );
        if (signResult.success && signResult.data) {
          signedPrekeyData.signature = signResult.data;
        }
      }

      // Store signed prekey
      const storeSignedResult = await this.keyStorage.storeSignedPreKey(
        walletAddress,
        signedPrekeyData,
        signedPreKey
      );
      if (!storeSignedResult.success) {
        return storeSignedResult;
      }

      // Generate one-time prekeys
      const oneTimePrekeys: OneTimePreKey[] = [];
      for (let i = 0; i < 10; i++) {
        const otpKey = await CryptoUtils.generateX25519KeyPair();
        oneTimePrekeys.push({
          keyId: i + 1,
          publicKey: otpKey.publicKey,
        });
        
        await this.keyStorage.storeOneTimePreKey(
          walletAddress,
          { keyId: i + 1, publicKey: otpKey.publicKey },
          otpKey
        );
      }

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to generate prekeys: ${error}`,
        'Failed to generate encryption keys'
      ));
    }
  }

  /**
   * Sign a prekey bundle
   */
  private async signPreKeyBundle(
    bundle: PreKeyBundle,
    identityKey: CryptoKeyPair
  ): Promise<Result<PreKeyBundle>> {
    try {
      // Create bundle data to sign
      const bundleData = new TextEncoder().encode(JSON.stringify({
        walletAddress: bundle.walletAddress,
        identityKey: Array.from(bundle.identityKey),
        signedPreKey: {
          keyId: bundle.signedPreKey.keyId,
          publicKey: Array.from(bundle.signedPreKey.publicKey),
          timestamp: bundle.signedPreKey.timestamp,
        },
        oneTimePreKey: bundle.oneTimePreKey ? {
          keyId: bundle.oneTimePreKey.keyId,
          publicKey: Array.from(bundle.oneTimePreKey.publicKey),
        } : undefined,
      }));

      const signResult = await CryptoUtils.sign(bundleData, identityKey.privateKey);
      if (!signResult.success || !signResult.data) {
        return createResult.error(signResult.error!);
      }

      bundle.signature = signResult.data;
      return createResult.success(bundle);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to sign prekey bundle: ${error}`,
        'Failed to sign encryption keys'
      ));
    }
  }

  /**
   * Verify a prekey bundle signature
   */
  private async verifyPreKeyBundle(bundle: PreKeyBundle): Promise<Result<boolean>> {
    try {
      const bundleData = new TextEncoder().encode(JSON.stringify({
        walletAddress: bundle.walletAddress,
        identityKey: Array.from(bundle.identityKey),
        signedPreKey: {
          keyId: bundle.signedPreKey.keyId,
          publicKey: Array.from(bundle.signedPreKey.publicKey),
          timestamp: bundle.signedPreKey.timestamp,
        },
        oneTimePreKey: bundle.oneTimePreKey ? {
          keyId: bundle.oneTimePreKey.keyId,
          publicKey: Array.from(bundle.oneTimePreKey.publicKey),
        } : undefined,
      }));

      return CryptoUtils.verify(bundleData, bundle.signature, bundle.identityKey);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Failed to verify prekey bundle: ${error}`,
        'Failed to verify encryption keys'
      ));
    }
  }

  /**
   * Get or load session
   */
  private async getSession(sessionId: string): Promise<SessionState | null> {
    // Check memory cache first
    const cached = this.sessions.get(sessionId);
    if (cached) {
      return cached;
    }

    // Load from storage
    const loadResult = await this.keyStorage.loadSession(sessionId);
    if (loadResult.success && loadResult.data) {
      this.sessions.set(sessionId, loadResult.data);
      return loadResult.data;
    }

    return null;
  }

  /**
   * Get session ID for two wallets
   */
  private getSessionId(wallet1: string, wallet2: string): string {
    // Ensure consistent session ID regardless of order
    const sorted = [wallet1, wallet2].sort();
    return `${sorted[0]}:${sorted[1]}`;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<Result<void>> {
    this.sessions.delete(sessionId);
    return this.keyStorage.deleteSession(sessionId);
  }

  /**
   * Get session info
   */
  async getSessionInfo(sessionId: string): Promise<Result<{
    established: boolean;
    messagesSent: number;
    messagesReceived: number;
    lastActivity: Date;
  }>> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return createResult.success({
        established: false,
        messagesSent: 0,
        messagesReceived: 0,
        lastActivity: new Date(0),
      });
    }

    return createResult.success({
      established: true,
      messagesSent: session.messageNumber,
      messagesReceived: session.receivedMessageNumbers.size,
      lastActivity: new Date(), // Would track this in production
    });
  }
}

// Export singleton instance
let signalProtocolInstance: SignalProtocol | null = null;

export function getSignalProtocol(): SignalProtocol {
  if (!signalProtocolInstance) {
    throw new Error('SignalProtocol not initialized. Call initializeSignalProtocol first.');
  }
  return signalProtocolInstance;
}

export async function initializeSignalProtocol(
  keyStorage: KeyStorage,
  config?: Partial<SignalProtocolConfig>
): Promise<Result<SignalProtocol>> {
  try {
    signalProtocolInstance = new SignalProtocol(keyStorage, config);
    return createResult.success(signalProtocolInstance);
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.CRYPTO_ERROR,
      `Failed to initialize Signal Protocol: ${error}`,
      'Failed to initialize encryption'
    ));
  }
} 