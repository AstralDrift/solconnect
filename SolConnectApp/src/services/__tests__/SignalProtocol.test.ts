/**
 * Tests for Signal Protocol implementation
 */

import { SignalProtocol, initializeSignalProtocol } from '../crypto/SignalProtocol';
import { KeyStorage, initializeKeyStorage } from '../crypto/KeyStorage';
import { EncryptionService, initializeEncryptionService } from '../crypto/EncryptionService';
import { CryptoUtils } from '../crypto/CryptoUtils';

// Mock crypto.subtle for Node.js environment
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto;
}

describe('Signal Protocol', () => {
  let keyStorage: KeyStorage;
  let signalProtocol: SignalProtocol;

  beforeEach(async () => {
    // Initialize key storage
    const keyStorageResult = await initializeKeyStorage();
    expect(keyStorageResult.success).toBe(true);
    keyStorage = keyStorageResult.data!;

    // Initialize Signal Protocol
    const signalResult = await initializeSignalProtocol(keyStorage);
    expect(signalResult.success).toBe(true);
    signalProtocol = signalResult.data!;
  });

  afterEach(async () => {
    // Clean up
    await keyStorage.clearAll();
  });

  describe('Key Generation', () => {
    it('should generate identity keys', async () => {
      const walletAddress = 'test-wallet-1';
      const result = await signalProtocol.initialize(walletAddress);
      
      expect(result.success).toBe(true);
      
      // Check identity key was created
      const identityResult = await keyStorage.getIdentityKeyPair(walletAddress);
      expect(identityResult.success).toBe(true);
      expect(identityResult.data).toBeDefined();
    });

    it('should create prekey bundle', async () => {
      const walletAddress = 'test-wallet-2';
      await signalProtocol.initialize(walletAddress);
      
      const bundleResult = await signalProtocol.createPreKeyBundle(walletAddress);
      
      expect(bundleResult.success).toBe(true);
      expect(bundleResult.data).toBeDefined();
      expect(bundleResult.data!.walletAddress).toBe(walletAddress);
      expect(bundleResult.data!.identityKey).toBeInstanceOf(Uint8Array);
      expect(bundleResult.data!.signedPreKey).toBeDefined();
      expect(bundleResult.data!.signature).toBeInstanceOf(Uint8Array);
    });
  });

  describe('Session Establishment', () => {
    it('should establish session between two wallets', async () => {
      const wallet1 = 'alice-wallet';
      const wallet2 = 'bob-wallet';

      // Initialize both wallets
      await signalProtocol.initialize(wallet1);
      await signalProtocol.initialize(wallet2);

      // Create prekey bundles
      const bundle1Result = await signalProtocol.createPreKeyBundle(wallet1);
      const bundle2Result = await signalProtocol.createPreKeyBundle(wallet2);
      
      expect(bundle1Result.success).toBe(true);
      expect(bundle2Result.success).toBe(true);

      // Establish sessions
      const session1Result = await signalProtocol.establishSession(wallet1, bundle2Result.data!);
      const session2Result = await signalProtocol.establishSession(wallet2, bundle1Result.data!);
      
      expect(session1Result.success).toBe(true);
      expect(session2Result.success).toBe(true);

      // Check session info
      const info1 = await signalProtocol.getSessionInfo(session1Result.data!);
      const info2 = await signalProtocol.getSessionInfo(session2Result.data!);
      
      expect(info1.data?.established).toBe(true);
      expect(info2.data?.established).toBe(true);
    });
  });

  describe('Message Encryption/Decryption', () => {
    it('should encrypt and decrypt messages', async () => {
      const wallet1 = 'alice-wallet';
      const wallet2 = 'bob-wallet';
      const message = 'Hello, encrypted world!';
      const messageBytes = new TextEncoder().encode(message);

      // Setup sessions
      await signalProtocol.initialize(wallet1);
      await signalProtocol.initialize(wallet2);
      
      const bundle2Result = await signalProtocol.createPreKeyBundle(wallet2);
      const sessionResult = await signalProtocol.establishSession(wallet1, bundle2Result.data!);
      
      expect(sessionResult.success).toBe(true);
      const sessionId = sessionResult.data!;

      // Encrypt message
      const encryptResult = await signalProtocol.encryptMessage(sessionId, messageBytes);
      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data).toBeDefined();
      
      // Setup reverse session for decryption
      const bundle1Result = await signalProtocol.createPreKeyBundle(wallet1);
      await signalProtocol.establishSession(wallet2, bundle1Result.data!);

      // Decrypt message
      const decryptResult = await signalProtocol.decryptMessage(sessionId, encryptResult.data!);
      expect(decryptResult.success).toBe(true);
      
      const decryptedMessage = new TextDecoder().decode(decryptResult.data!);
      expect(decryptedMessage).toBe(message);
    });

    it('should handle multiple messages with ratcheting', async () => {
      const wallet1 = 'alice-wallet';
      const wallet2 = 'bob-wallet';
      const messages = ['Message 1', 'Message 2', 'Message 3'];

      // Setup sessions
      await signalProtocol.initialize(wallet1);
      await signalProtocol.initialize(wallet2);
      
      const bundle2Result = await signalProtocol.createPreKeyBundle(wallet2);
      const bundle1Result = await signalProtocol.createPreKeyBundle(wallet1);
      
      const session1 = await signalProtocol.establishSession(wallet1, bundle2Result.data!);
      const session2 = await signalProtocol.establishSession(wallet2, bundle1Result.data!);
      
      const sessionId = session1.data!;

      // Send and receive multiple messages
      for (const msg of messages) {
        const msgBytes = new TextEncoder().encode(msg);
        
        // Encrypt
        const encryptResult = await signalProtocol.encryptMessage(sessionId, msgBytes);
        expect(encryptResult.success).toBe(true);
        
        // Decrypt
        const decryptResult = await signalProtocol.decryptMessage(sessionId, encryptResult.data!);
        expect(decryptResult.success).toBe(true);
        
        const decrypted = new TextDecoder().decode(decryptResult.data!);
        expect(decrypted).toBe(msg);
      }
    });
  });
});

describe('Encryption Service', () => {
  let encryptionService: EncryptionService;
  const wallet1 = 'alice-wallet';
  const wallet2 = 'bob-wallet';

  beforeEach(async () => {
    const result = await initializeEncryptionService(wallet1);
    expect(result.success).toBe(true);
    encryptionService = result.data!;
  });

  afterEach(async () => {
    await encryptionService.cleanup();
  });

  describe('Message Interceptor', () => {
    it('should encrypt messages transparently', async () => {
      const interceptor = encryptionService.createMessageInterceptor();
      const session = {
        session_id: `${wallet1}:${wallet2}`,
        peer_wallet: wallet2,
        sharedKey: new Uint8Array(32)
      };
      const plaintext = 'Secret message';

      // Test beforeSend (encryption)
      const encryptResult = await interceptor.beforeSend!(session, plaintext);
      expect(encryptResult.success).toBe(true);
      
      const encrypted = encryptResult.data!;
      expect(encrypted).not.toBe(plaintext);
      
      // Parse encrypted payload
      const payload = JSON.parse(encrypted);
      expect(payload.version).toBe(1);
      expect(payload.senderWallet).toBe(wallet1);
      expect(payload.encryptedMessage).toBeDefined();
    });

    it('should include prekey bundle in first message', async () => {
      const interceptor = encryptionService.createMessageInterceptor();
      const session = {
        session_id: `${wallet1}:${wallet2}`,
        peer_wallet: wallet2,
        sharedKey: new Uint8Array(32)
      };

      // First message should include prekey bundle
      const encryptResult = await interceptor.beforeSend!(session, 'First message');
      expect(encryptResult.success).toBe(true);
      
      const payload = JSON.parse(encryptResult.data!);
      expect(payload.preKeyBundle).toBeDefined();
      expect(payload.preKeyBundle.walletAddress).toBe(wallet1);
    });
  });

  describe('Session Management', () => {
    it('should report session status', async () => {
      const infoResult = await encryptionService.getSessionInfo(wallet2);
      
      expect(infoResult.success).toBe(true);
      expect(infoResult.data).toBeDefined();
      expect(infoResult.data!.established).toBe(false);
    });

    it('should delete sessions', async () => {
      const deleteResult = await encryptionService.deleteSession(wallet2);
      expect(deleteResult.success).toBe(true);
    });
  });
});

describe('Crypto Utils', () => {
  describe('Key Generation', () => {
    it('should generate Ed25519 keypair', async () => {
      const keypair = await CryptoUtils.generateEd25519KeyPair();
      
      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeDefined();
      expect(keypair.privateKey).toBeDefined();
    });

    it('should generate X25519 keypair', async () => {
      const keypair = await CryptoUtils.generateX25519KeyPair();
      
      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeDefined();
      expect(keypair.privateKey).toBeDefined();
    });
  });

  describe('ECDH', () => {
    it('should perform key agreement', async () => {
      const keypair1 = await CryptoUtils.generateX25519KeyPair();
      const keypair2 = await CryptoUtils.generateX25519KeyPair();
      
      const pubkey1 = await CryptoUtils.exportKey(keypair1.publicKey);
      const pubkey2 = await CryptoUtils.exportKey(keypair2.publicKey);
      
      const shared1 = await CryptoUtils.performECDH(keypair1.privateKey, pubkey2);
      const shared2 = await CryptoUtils.performECDH(keypair2.privateKey, pubkey1);
      
      // Shared secrets should be equal
      expect(shared1).toEqual(shared2);
    });
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt with AES-GCM', async () => {
      const key = CryptoUtils.generateRandomBytes(32);
      const plaintext = new TextEncoder().encode('Test message');
      const associatedData = new TextEncoder().encode('metadata');
      
      // Encrypt
      const encryptResult = await CryptoUtils.encryptAESGCM(plaintext, key, associatedData);
      expect(encryptResult.success).toBe(true);
      
      const { ciphertext, tag, iv } = encryptResult.data!;
      
      // Decrypt
      const decryptResult = await CryptoUtils.decryptAESGCM(ciphertext, key, tag, associatedData, iv);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(plaintext);
    });

    it('should fail decryption with wrong key', async () => {
      const key1 = CryptoUtils.generateRandomBytes(32);
      const key2 = CryptoUtils.generateRandomBytes(32);
      const plaintext = new TextEncoder().encode('Test message');
      
      const encryptResult = await CryptoUtils.encryptAESGCM(plaintext, key1);
      expect(encryptResult.success).toBe(true);
      
      const { ciphertext, tag, iv } = encryptResult.data!;
      
      const decryptResult = await CryptoUtils.decryptAESGCM(ciphertext, key2, tag, undefined, iv);
      expect(decryptResult.success).toBe(false);
    });
  });

  describe('Key Derivation', () => {
    it('should derive keys with HKDF', async () => {
      const input = CryptoUtils.generateRandomBytes(32);
      const salt = CryptoUtils.generateRandomBytes(32);
      const info = new TextEncoder().encode('test-info');
      
      const derived1 = await CryptoUtils.deriveKey(input, salt, info, 32);
      const derived2 = await CryptoUtils.deriveKey(input, salt, info, 32);
      
      // Should be deterministic
      expect(derived1).toEqual(derived2);
      
      // Different info should produce different keys
      const info2 = new TextEncoder().encode('different-info');
      const derived3 = await CryptoUtils.deriveKey(input, salt, info2, 32);
      expect(derived3).not.toEqual(derived1);
    });
  });
}); 