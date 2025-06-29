import { CryptoUtils } from '../CryptoUtils';
import { SignalProtocol } from '../SignalProtocol';
import { KeyStorage } from '../KeyStorage';

// Simple in-memory backend for KeyStorage (avoids indexedDB/localStorage)
class MemoryBackend {
  private store: Record<string, any> = {};
  async get(key: string) { return this.store[key]; }
  async set(key: string, value: any) { this.store[key] = value; }
  async delete(key: string) { delete this.store[key]; }
  async clear() { this.store = {}; }
  async keys() { return Object.keys(this.store); }
}

describe('CryptoUtils – core operations', () => {
  it('generates Ed25519 key pairs', async () => {
    const keyPair = await CryptoUtils.generateEd25519KeyPair();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
  });

  it('signs and verifies data with Ed25519', async () => {
    const keyPair = await CryptoUtils.generateEd25519KeyPair();
    const data = new TextEncoder().encode('test message');
    
    const signResult = await CryptoUtils.sign(data, keyPair.privateKey);
    expect(signResult.success).toBe(true);
    
    const publicKeyBytes = await CryptoUtils.exportKey(keyPair.publicKey);
    const verifyResult = await CryptoUtils.verify(data, signResult.data!, publicKeyBytes);
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data).toBe(true);
  });

  it('encrypts and decrypts with AES-GCM', async () => {
    const key = CryptoUtils.generateRandomBytes(32);
    const plaintext = new TextEncoder().encode('secret message');
    
    const encResult = await CryptoUtils.encryptAESGCM(plaintext, key);
    expect(encResult.success).toBe(true);
    
    const decResult = await CryptoUtils.decryptAESGCM(
      encResult.data!.ciphertext,
      key,
      encResult.data!.tag,
      undefined,
      encResult.data!.iv
    );
    expect(decResult.success).toBe(true);
    
    const decrypted = new TextDecoder().decode(decResult.data!);
    expect(decrypted).toBe('secret message');
  });

  it('derives keys with HKDF', async () => {
    const input = CryptoUtils.generateRandomBytes(32);
    const salt = CryptoUtils.generateRandomBytes(16);
    const info = new TextEncoder().encode('test-derivation');
    
    const derived = await CryptoUtils.deriveKey(input, salt, info, 32);
    expect(derived).toHaveLength(32);
    
    // Same input should produce same output
    const derived2 = await CryptoUtils.deriveKey(input, salt, info, 32);
    expect(derived).toEqual(derived2);
  });
});

describe('SignalProtocol – end-to-end encryption', () => {
  let aliceKeyStorage: KeyStorage;
  let bobKeyStorage: KeyStorage;
  let aliceProtocol: SignalProtocol;
  let bobProtocol: SignalProtocol;

  const aliceWallet = 'alice_wallet_123';
  const bobWallet = 'bob_wallet_456';

  beforeEach(async () => {
    // Set up separate key storages for Alice and Bob
    aliceKeyStorage = new KeyStorage(new MemoryBackend() as any);
    bobKeyStorage = new KeyStorage(new MemoryBackend() as any);
    
    await aliceKeyStorage.initialize();
    await bobKeyStorage.initialize();

    aliceProtocol = new SignalProtocol(aliceKeyStorage);
    bobProtocol = new SignalProtocol(bobKeyStorage);
  });

  it('creates prekey bundles successfully', async () => {
    // Initialize protocols
    const aliceInit = await aliceProtocol.initialize(aliceWallet);
    expect(aliceInit.success).toBe(true);

    const bobInit = await bobProtocol.initialize(bobWallet);
    expect(bobInit.success).toBe(true);

    // Create prekey bundles
    const aliceBundle = await aliceProtocol.createPreKeyBundle(aliceWallet);
    expect(aliceBundle.success).toBe(true);
    expect(aliceBundle.data?.walletAddress).toBe(aliceWallet);
    expect(aliceBundle.data?.identityKey).toBeDefined();
    expect(aliceBundle.data?.signedPreKey).toBeDefined();

    const bobBundle = await bobProtocol.createPreKeyBundle(bobWallet);
    expect(bobBundle.success).toBe(true);
    expect(bobBundle.data?.walletAddress).toBe(bobWallet);
  });

  it('establishes sessions and encrypts/decrypts messages', async () => {
    // Initialize protocols
    await aliceProtocol.initialize(aliceWallet);
    await bobProtocol.initialize(bobWallet);

    // Create bundles
    const aliceBundle = await aliceProtocol.createPreKeyBundle(aliceWallet);
    const bobBundle = await bobProtocol.createPreKeyBundle(bobWallet);

    // Establish sessions
    const aliceSessionResult = await aliceProtocol.establishSession(aliceWallet, bobBundle.data!);
    expect(aliceSessionResult.success).toBe(true);
    
    const bobSessionResult = await bobProtocol.establishSession(bobWallet, aliceBundle.data!);
    expect(bobSessionResult.success).toBe(true);

    // Alice encrypts a message
    const plaintext = new TextEncoder().encode('Hello Bob, this is encrypted!');
    const encryptResult = await aliceProtocol.encryptMessage(aliceSessionResult.data!, plaintext);
    expect(encryptResult.success).toBe(true);
    expect(encryptResult.data?.ciphertext).toBeDefined();
    expect(encryptResult.data?.header).toBeDefined();

    // Bob decrypts the message
    const decryptResult = await bobProtocol.decryptMessage(bobSessionResult.data!, encryptResult.data!);
    expect(decryptResult.success).toBe(true);
    
    const decrypted = new TextDecoder().decode(decryptResult.data!);
    expect(decrypted).toBe('Hello Bob, this is encrypted!');
  });

  it('handles multiple messages in sequence', async () => {
    // Initialize and establish sessions
    await aliceProtocol.initialize(aliceWallet);
    await bobProtocol.initialize(bobWallet);
    
    const aliceBundle = await aliceProtocol.createPreKeyBundle(aliceWallet);
    const bobBundle = await bobProtocol.createPreKeyBundle(bobWallet);
    
    const aliceSession = await aliceProtocol.establishSession(aliceWallet, bobBundle.data!);
    const bobSession = await bobProtocol.establishSession(bobWallet, aliceBundle.data!);

    // Send multiple messages
    const messages = ['Message 1', 'Message 2', 'Message 3'];
    
    for (const msg of messages) {
      const plaintext = new TextEncoder().encode(msg);
      const encrypted = await aliceProtocol.encryptMessage(aliceSession.data!, plaintext);
      expect(encrypted.success).toBe(true);
      
      const decrypted = await bobProtocol.decryptMessage(bobSession.data!, encrypted.data!);
      expect(decrypted.success).toBe(true);
      
      const decryptedText = new TextDecoder().decode(decrypted.data!);
      expect(decryptedText).toBe(msg);
    }
  });
}); 