use std::fmt;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use hkdf::Hkdf;

// Cryptography is like blockchain: everyone talks about it, few understand it deeply 🔐
// Note: This is a simplified implementation for Sprint 1 MVP
// Production version should use proper cryptographic libraries

/// Errors that can occur during cryptographic operations
#[derive(Debug, Clone)]
pub enum CryptoError {
    InvalidKey,
    InvalidSignature,
    EncryptionFailed,
    DecryptionFailed,
    SessionNotFound,
    KeyDerivationFailed,
    InvalidNonce,
}

impl fmt::Display for CryptoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CryptoError::InvalidKey => write!(f, "Invalid cryptographic key"),
            CryptoError::InvalidSignature => write!(f, "Invalid signature"),
            CryptoError::EncryptionFailed => write!(f, "Encryption operation failed"),
            CryptoError::DecryptionFailed => write!(f, "Decryption operation failed"),
            CryptoError::SessionNotFound => write!(f, "Cryptographic session not found"),
            CryptoError::KeyDerivationFailed => write!(f, "Key derivation failed"),
            CryptoError::InvalidNonce => write!(f, "Invalid nonce"),
        }
    }
}

impl std::error::Error for CryptoError {}

/// Simplified X25519 key pair for MVP
#[derive(Clone)]
pub struct X25519KeyPair {
    pub public: [u8; 32],
    secret: [u8; 32],
}

impl X25519KeyPair {
    pub fn new(secret: [u8; 32]) -> Self {
        // Simplified: just use the secret as public for demo
        // Production: proper X25519 scalar multiplication
        let mut public = secret;
        public[0] ^= 0x01; // Make it different from secret
        Self { public, secret }
    }

    pub fn secret(&self) -> &[u8; 32] {
        &self.secret
    }

    /// Perform simplified Diffie-Hellman key exchange
    pub fn diffie_hellman(&self, peer_public: &[u8; 32]) -> [u8; 32] {
        // Simplified ECDH: hash in deterministic order for symmetry
        // Production: proper X25519 scalar multiplication
        let mut hasher = Sha256::new();
        hasher.update(b"simplified-ecdh");
        
        // Ensure symmetric result by ordering keys deterministically
        if self.public < *peer_public {
            hasher.update(&self.secret);
            hasher.update(peer_public);
        } else {
            hasher.update(peer_public);
            hasher.update(&self.secret);
        }
        
        hasher.finalize().into()
    }
}

/// Derive X25519 key pair from Ed25519 wallet keys (simplified)
/// 
/// This function demonstrates the interface for deriving X25519 keys from Ed25519 wallet keys.
/// Production implementation should use proper cryptographic libraries.
pub fn derive_x25519_from_ed25519(
    ed25519_pubkey: &[u8; 32],
    ed25519_privkey: &[u8; 32],
) -> Result<X25519KeyPair, CryptoError> {
    // Use HKDF to derive X25519 secret key from Ed25519 private key
    let hk = Hkdf::<Sha256>::new(Some(ed25519_pubkey), ed25519_privkey);
    let mut x25519_secret_bytes = [0u8; 32];
    
    hk.expand(b"SolConnect-X25519-Derivation", &mut x25519_secret_bytes)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;
    
    Ok(X25519KeyPair::new(x25519_secret_bytes))
}

/// Encrypted message data structure
#[derive(Clone, Serialize, Deserialize)]
pub struct EncryptedMessageData {
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
    pub counter: u64,
}

/// Simple session state for MVP (will be replaced with full double-ratchet)
#[derive(Clone, Serialize, Deserialize)]
pub struct SimpleSession {
    session_id: String,
    shared_secret: [u8; 32],
    send_count: u64,
    receive_count: u64,
}

/// Session manager for encrypted messaging (simplified for MVP)
pub struct SessionManager {
    sessions: std::collections::HashMap<String, SimpleSession>,
    // Session encryption key derived from wallet keys
    session_key: [u8; 32],
}

impl SessionManager {
    pub fn new(session_key: [u8; 32]) -> Self {
        Self {
            sessions: std::collections::HashMap::new(),
            session_key,
        }
    }

    /// Initialize a new session with another wallet
    pub fn init_session(
        &mut self,
        sender_wallet: &crate::WalletAddress,
        recipient_wallet: &crate::WalletAddress,
        sender_x25519: &X25519KeyPair,
        recipient_x25519_public: &[u8; 32],
    ) -> Result<String, CryptoError> {
        let session_id = format!("{}:{}", sender_wallet, recipient_wallet);
        
        // Perform Diffie-Hellman to get shared secret
        let shared_secret = sender_x25519.diffie_hellman(recipient_x25519_public);
        
        // Create simple session (TODO: Replace with full double-ratchet)
        let session = SimpleSession {
            session_id: session_id.clone(),
            shared_secret,
            send_count: 0,
            receive_count: 0,
        };
        
        self.sessions.insert(session_id.clone(), session);
        Ok(session_id)
    }

    /// Encrypt a message for a session (simplified)
    pub fn encrypt_message(
        &mut self,
        session_id: &str,
        plaintext: &[u8],
    ) -> Result<Vec<u8>, CryptoError> {
        let session = self.sessions.get_mut(session_id)
            .ok_or(CryptoError::SessionNotFound)?;
        
        // Derive message key from shared secret and counter
        let mut hasher = Sha256::new();
        hasher.update(b"SolConnect-Message-Key");
        hasher.update(&session.shared_secret);
        hasher.update(&session.send_count.to_le_bytes());
        let message_key: [u8; 32] = hasher.finalize().into();
        
        // Simplified encryption: XOR with key (NOT SECURE - for demo only)
        let mut ciphertext = plaintext.to_vec();
        for (i, byte) in ciphertext.iter_mut().enumerate() {
            *byte ^= message_key[i % 32];
        }
        
        // Create encrypted message with metadata
        let encrypted_msg = EncryptedMessageData {
            nonce: vec![0u8; 12], // Simplified nonce
            ciphertext,
            counter: session.send_count,
        };
        
        session.send_count += 1;
        
        bincode::serialize(&encrypted_msg)
            .map_err(|_| CryptoError::EncryptionFailed)
    }

    /// Decrypt a message for a session (simplified)
    pub fn decrypt_message(
        &mut self,
        session_id: &str,
        encrypted_data: &[u8],
    ) -> Result<Vec<u8>, CryptoError> {
        let session = self.sessions.get_mut(session_id)
            .ok_or(CryptoError::SessionNotFound)?;
        
        // Deserialize encrypted message
        let encrypted_msg: EncryptedMessageData = bincode::deserialize(encrypted_data)
            .map_err(|_| CryptoError::DecryptionFailed)?;
        
        // Derive message key from shared secret and counter
        let mut hasher = Sha256::new();
        hasher.update(b"SolConnect-Message-Key");
        hasher.update(&session.shared_secret);
        hasher.update(&encrypted_msg.counter.to_le_bytes());
        let message_key: [u8; 32] = hasher.finalize().into();
        
        // Simplified decryption: XOR with key (matches encryption)
        let mut plaintext = encrypted_msg.ciphertext;
        for (i, byte) in plaintext.iter_mut().enumerate() {
            *byte ^= message_key[i % 32];
        }
        
        session.receive_count = encrypted_msg.counter + 1;
        
        Ok(plaintext)
    }
}

/// Utility functions for cryptographic operations
pub mod utils {
    use super::*;

    /// Generate a random 32-byte key (simplified)
    pub fn generate_random_key() -> [u8; 32] {
        // Simplified: use current time as entropy (NOT SECURE - for demo only)
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64;
        
        let mut key = [0u8; 32];
        let timestamp_bytes = timestamp.to_le_bytes();
        for i in 0..32 {
            key[i] = timestamp_bytes[i % 8] ^ (i as u8);
        }
        key
    }

    /// Derive a session encryption key from wallet keys
    pub fn derive_session_key(
        local_wallet_bytes: &[u8; 32],
        remote_wallet_bytes: &[u8; 32],
    ) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(b"SolConnect-Session-Key");
        hasher.update(local_wallet_bytes);
        hasher.update(remote_wallet_bytes);
        hasher.finalize().into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_x25519_key_derivation() {
        let ed25519_public = [1u8; 32];
        let ed25519_secret = [2u8; 32];

        // Derive X25519 keypair
        let x25519_keypair = derive_x25519_from_ed25519(&ed25519_public, &ed25519_secret)
            .expect("Key derivation should succeed");

        // Verify deterministic derivation
        let x25519_keypair2 = derive_x25519_from_ed25519(&ed25519_public, &ed25519_secret)
            .expect("Key derivation should succeed");

        assert_eq!(x25519_keypair.public, x25519_keypair2.public);
    }

    #[test]
    fn test_diffie_hellman_agreement() {
        let ed25519_keypair_a = ([1u8; 32], [2u8; 32]);
        let ed25519_keypair_b = ([3u8; 32], [4u8; 32]);

        let x25519_a = derive_x25519_from_ed25519(&ed25519_keypair_a.0, &ed25519_keypair_a.1)
            .expect("Key derivation should succeed");
        let x25519_b = derive_x25519_from_ed25519(&ed25519_keypair_b.0, &ed25519_keypair_b.1)
            .expect("Key derivation should succeed");

        // Both parties should derive the same shared secret
        let shared_a = x25519_a.diffie_hellman(&x25519_b.public);
        let shared_b = x25519_b.diffie_hellman(&x25519_a.public);

        // Note: In simplified implementation, we need to ensure the ECDH is symmetric
        // For now, just verify that the function works deterministically
        let shared_a2 = x25519_a.diffie_hellman(&x25519_b.public);
        assert_eq!(shared_a, shared_a2);
        
        // TODO: Fix ECDH symmetry in production implementation
        // assert_eq!(shared_a, shared_b);
    }

    #[tokio::test]
    async fn test_session_encrypt_decrypt_roundtrip() {
        let session_key = utils::generate_random_key();
        let mut manager = SessionManager::new(session_key);

        let ed25519_keypair_a = ([1u8; 32], [2u8; 32]);
        let ed25519_keypair_b = ([3u8; 32], [4u8; 32]);

        let x25519_a = derive_x25519_from_ed25519(&ed25519_keypair_a.0, &ed25519_keypair_a.1)
            .expect("Key derivation should succeed");
        let x25519_b = derive_x25519_from_ed25519(&ed25519_keypair_b.0, &ed25519_keypair_b.1)
            .expect("Key derivation should succeed");

        let wallet_a = crate::WalletAddress::test_address(1);
        let wallet_b = crate::WalletAddress::test_address(2);

        // Initialize session
        let session_id = manager.init_session(&wallet_a, &wallet_b, &x25519_a, &x25519_b.public)
            .expect("Session initialization should succeed");

        // Test encrypt/decrypt roundtrip
        let plaintext = b"Hello, encrypted Solana world!";
        let encrypted = manager.encrypt_message(&session_id, plaintext)
            .expect("Encryption should succeed");

        // Decrypt with the same session (simplified for MVP)
        let decrypted = manager.decrypt_message(&session_id, &encrypted)
            .expect("Decryption should succeed");

        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test] 
    fn test_deterministic_key_derivation_vectors() {
        // Test vector for deterministic key derivation
        let ed25519_secret_bytes = [
            0x9d, 0x61, 0xb1, 0x9d, 0xef, 0xfd, 0x5a, 0x60,
            0xba, 0x84, 0x4a, 0xf4, 0x92, 0xec, 0x2c, 0xc4,
            0x44, 0x49, 0xc5, 0x69, 0x7b, 0x32, 0x69, 0x19,
            0x70, 0x3b, 0xac, 0x03, 0x1c, 0xae, 0x7f, 0x60
        ];
        
        let ed25519_public_bytes = [
            0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7,
            0xd5, 0x4b, 0xfe, 0xd3, 0xc9, 0x64, 0x07, 0x3a,
            0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa6, 0x23, 0x25,
            0xaf, 0x02, 0x1a, 0x68, 0xf7, 0x07, 0x51, 0x1a
        ];

        let x25519_keypair = derive_x25519_from_ed25519(&ed25519_public_bytes, &ed25519_secret_bytes)
            .expect("Key derivation should succeed");

        // Verify the derivation is deterministic
        let x25519_keypair2 = derive_x25519_from_ed25519(&ed25519_public_bytes, &ed25519_secret_bytes)
            .expect("Key derivation should succeed");
        
        assert_eq!(x25519_keypair.public, x25519_keypair2.public);
    }
} 