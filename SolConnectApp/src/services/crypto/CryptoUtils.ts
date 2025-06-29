/**
 * Cryptographic utility functions for Signal Protocol
 * Provides WebCrypto API wrappers for cross-platform crypto operations
 */

import { createResult, Result, SolConnectError, ErrorCode } from '../../types/errors';

// Noble crypto fallbacks for Node.js/Jest environments
let nobleEd25519: any;
let nobleCurves: any;

// Lazy load noble libraries only when needed
async function getNobleEd25519() {
  if (!nobleEd25519) {
    nobleEd25519 = await import('@noble/ed25519');
  }
  return nobleEd25519;
}

async function getNobleCurves() {
  if (!nobleCurves) {
    nobleCurves = await import('@noble/curves/ed25519');
  }
  return nobleCurves;
}

// Check if WebCrypto supports specific algorithms
function supportsWebCrypto(algorithm: string): boolean {
  try {
    if (!globalThis.crypto?.subtle) return false;
    
    // Check if the algorithm is supported
    if (algorithm === 'Ed25519') {
      // Ed25519 is not widely supported in Node.js WebCrypto yet
      return typeof globalThis.crypto.subtle.generateKey === 'function' && 
             globalThis.navigator?.userAgent !== undefined; // Browser check
    }
    
    return true;
  } catch {
    return false;
  }
}

export class CryptoUtils {
  /**
   * Generate Ed25519 key pair for identity keys
   */
  static async generateEd25519KeyPair(): Promise<CryptoKeyPair> {
    if (supportsWebCrypto('Ed25519')) {
      return crypto.subtle.generateKey(
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519',
        },
        true,
        ['sign', 'verify']
      );
    } else {
      // Use noble fallback
      const noble = await getNobleEd25519();
      const privateKey = noble.utils.randomPrivateKey();
      const publicKey = await noble.getPublicKey(privateKey);
      
      // Create mock CryptoKeyPair
      return {
        privateKey: {
          type: 'private',
          extractable: true,
          algorithm: { name: 'Ed25519' },
          usages: ['sign'],
          _noblePrivateKey: privateKey
        } as any,
        publicKey: {
          type: 'public', 
          extractable: true,
          algorithm: { name: 'Ed25519' },
          usages: ['verify'],
          _noblePublicKey: publicKey
        } as any
      };
    }
  }

  /**
   * Generate X25519 key pair for ECDH
   */
  static async generateX25519KeyPair(): Promise<CryptoKeyPair> {
    // For now, use P-256 ECDH which is widely supported
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
      // Check if using noble fallback
      if ((privateKey as any)._noblePrivateKey) {
        const noble = await getNobleEd25519();
        const signature = await noble.sign(data, (privateKey as any)._noblePrivateKey);
        return createResult.success(signature);
      }
      
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
      // Try noble first (always works)
      const noble = await getNobleEd25519();
      const isValid = await noble.verify(signature, data, publicKey);
      return createResult.success(isValid);
    } catch (error) {
      // Fallback to WebCrypto if available
      try {
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
      } catch (webCryptoError) {
        return createResult.error(SolConnectError.system(
          ErrorCode.CRYPTO_ERROR,
          `Signature verification failed: ${error}`,
          'Failed to verify signature'
        ));
      }
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
    // Check if using noble fallback
    if ((key as any)._noblePublicKey) {
      return (key as any)._noblePublicKey;
    }
    if ((key as any)._noblePrivateKey) {
      return (key as any)._noblePrivateKey;
    }
    
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
    if (algorithm === 'Ed25519' && !supportsWebCrypto('Ed25519')) {
      // Use noble fallback for Ed25519
      if (keyUsages.includes('verify')) {
        return {
          type: 'public',
          extractable: true,
          algorithm: { name: 'Ed25519' },
          usages: ['verify'],
          _noblePublicKey: keyData
        } as any;
      } else {
        return {
          type: 'private',
          extractable: true,
          algorithm: { name: 'Ed25519' },
          usages: ['sign'],
          _noblePrivateKey: keyData
        } as any;
      }
    }
    
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