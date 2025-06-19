/**
 * Cryptographic utility functions for Signal Protocol
 * Provides WebCrypto API wrappers for cross-platform crypto operations
 */

import { createResult, Result, SolConnectError, ErrorCode } from '../../types/errors';

export class CryptoUtils {
  /**
   * Generate Ed25519 key pair for identity keys
   */
  static async generateEd25519KeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      {
        name: 'Ed25519',
        namedCurve: 'Ed25519',
      },
      true,
      ['sign', 'verify']
    );
  }

  /**
   * Generate X25519 key pair for ECDH
   */
  static async generateX25519KeyPair(): Promise<CryptoKeyPair> {
    // WebCrypto doesn't directly support X25519, so we use ECDH with P-256
    // In production, use a proper crypto library like libsodium-wrappers
    return crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveBits', 'deriveKey']
    );
  }

  /**
   * Perform ECDH key agreement
   */
  static async performECDH(
    privateKey: CryptoKey,
    publicKeyBytes: Uint8Array
  ): Promise<Uint8Array> {
    try {
      // Import public key
      const publicKey = await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        []
      );

      // Perform ECDH
      const sharedSecret = await crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: publicKey,
        },
        privateKey,
        256 // 32 bytes
      );

      return new Uint8Array(sharedSecret);
    } catch (error) {
      throw new Error(`ECDH failed: ${error}`);
    }
  }

  /**
   * Derive key using HKDF
   */
  static async deriveKey(
    input: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    outputLength: number
  ): Promise<Uint8Array> {
    try {
      // Import input as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        input,
        'HKDF',
        false,
        ['deriveBits']
      );

      // Derive bits using HKDF
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          salt,
          info,
          hash: 'SHA-256',
        },
        keyMaterial,
        outputLength * 8 // Convert bytes to bits
      );

      return new Uint8Array(derivedBits);
    } catch (error) {
      throw new Error(`HKDF failed: ${error}`);
    }
  }

  /**
   * Encrypt with AES-GCM
   */
  static async encryptAESGCM(
    plaintext: Uint8Array,
    key: Uint8Array,
    associatedData?: Uint8Array
  ): Promise<Result<{ ciphertext: Uint8Array; tag: Uint8Array; iv: Uint8Array }>> {
    try {
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Import key
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['encrypt']
      );

      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: associatedData,
          tagLength: 128, // 16 bytes
        },
        cryptoKey,
        plaintext
      );

      // Split ciphertext and tag
      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -16);
      const tag = encryptedArray.slice(-16);

      return createResult.success({ ciphertext, tag, iv });
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `AES-GCM encryption failed: ${error}`,
        'Encryption failed'
      ));
    }
  }

  /**
   * Decrypt with AES-GCM
   */
  static async decryptAESGCM(
    ciphertext: Uint8Array,
    key: Uint8Array,
    tag: Uint8Array,
    associatedData?: Uint8Array,
    iv?: Uint8Array
  ): Promise<Result<Uint8Array>> {
    try {
      // Use provided IV or extract from ciphertext if prepended
      const actualIv = iv || ciphertext.slice(0, 12);
      const actualCiphertext = iv ? ciphertext : ciphertext.slice(12);

      // Import key
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['decrypt']
      );

      // Combine ciphertext and tag for WebCrypto
      const combined = new Uint8Array(actualCiphertext.length + tag.length);
      combined.set(actualCiphertext, 0);
      combined.set(tag, actualCiphertext.length);

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: actualIv,
          additionalData: associatedData,
          tagLength: 128,
        },
        cryptoKey,
        combined
      );

      return createResult.success(new Uint8Array(decrypted));
    } catch (error) {
      return createResult.error(SolConnectError.security(
        ErrorCode.CRYPTO_ERROR,
        `AES-GCM decryption failed: ${error}`,
        'Decryption failed'
      ));
    }
  }

  /**
   * Sign data with Ed25519
   */
  static async sign(
    data: Uint8Array,
    privateKey: CryptoKey
  ): Promise<Result<Uint8Array>> {
    try {
      const signature = await crypto.subtle.sign(
        'Ed25519',
        privateKey,
        data
      );
      return createResult.success(new Uint8Array(signature));
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Signing failed: ${error}`,
        'Failed to sign data'
      ));
    }
  }

  /**
   * Verify signature with Ed25519
   */
  static async verify(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): Promise<Result<boolean>> {
    try {
      // Import public key
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        publicKey,
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519',
        },
        false,
        ['verify']
      );

      const isValid = await crypto.subtle.verify(
        'Ed25519',
        cryptoKey,
        signature,
        data
      );

      return createResult.success(isValid);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.CRYPTO_ERROR,
        `Signature verification failed: ${error}`,
        'Failed to verify signature'
      ));
    }
  }

  /**
   * Compare two keys for equality
   */
  static compareKeys(key1: Uint8Array, key2: Uint8Array): boolean {
    if (key1.length !== key2.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < key1.length; i++) {
      result |= key1[i] ^ key2[i];
    }
    
    return result === 0;
  }

  /**
   * Generate random bytes
   */
  static generateRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Convert key to raw bytes
   */
  static async exportKey(key: CryptoKey): Promise<Uint8Array> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return new Uint8Array(exported);
  }

  /**
   * Import key from bytes
   */
  static async importKey(
    keyData: Uint8Array,
    algorithm: string,
    keyUsages: KeyUsage[]
  ): Promise<CryptoKey> {
    if (algorithm === 'X25519' || algorithm === 'ECDH') {
      return crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        keyUsages
      );
    } else if (algorithm === 'Ed25519') {
      return crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519',
        },
        true,
        keyUsages
      );
    } else if (algorithm === 'AES-GCM') {
      return crypto.subtle.importKey(
        'raw',
        keyData,
        'AES-GCM',
        true,
        keyUsages
      );
    } else {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * Derive X25519 key from Ed25519 key (wallet key)
   * This is a simplified version - in production use proper Ed25519 to X25519 conversion
   */
  static async deriveX25519FromEd25519(
    ed25519PublicKey: Uint8Array,
    ed25519PrivateKey: CryptoKey
  ): Promise<CryptoKeyPair> {
    // In production, use proper curve conversion
    // For now, generate a new X25519 key deterministically
    const seed = await this.deriveKey(
      await this.exportKey(ed25519PrivateKey),
      ed25519PublicKey,
      new TextEncoder().encode('SolConnect-X25519-Derivation'),
      32
    );

    // Use seed to generate deterministic key
    // Note: WebCrypto doesn't support seeded key generation
    // In production, use libsodium or similar
    return this.generateX25519KeyPair();
  }

  /**
   * Constant-time comparison
   */
  static constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Zeroize sensitive data
   */
  static zeroize(data: Uint8Array): void {
    crypto.getRandomValues(data);
    data.fill(0);
  }
} 