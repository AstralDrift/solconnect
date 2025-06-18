use serde::{Deserialize, Serialize};
use std::fmt;

// TODO: buy more SOL for coffee ☕

pub mod crypto;
pub mod messages;

// Re-export the new protobuf message types
pub use messages::{ChatMessage, AckMessage, AckStatus};

/// Solana wallet address used for identity and encryption
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct WalletAddress(pub [u8; 32]);

impl WalletAddress {
    pub fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }
    
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
    
    /// Create a test wallet address for development
    pub fn test_address(seed: u8) -> Self {
        let mut bytes = [0u8; 32];
        bytes[0] = seed;
        Self(bytes)
    }
}

impl fmt::Display for WalletAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", bs58::encode(&self.0).into_string())
    }
}

/// Encrypted message container with metadata
/// DEPRECATED: Use ChatMessage from protobuf instead
#[deprecated(note = "Use ChatMessage from protobuf schema")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub sender: WalletAddress,
    pub recipient: WalletAddress,
    pub payload: Vec<u8>,
    pub nonce: [u8; 24],
    pub timestamp: u64,
    pub message_id: String,
}

impl EncryptedMessage {
    pub fn new(
        sender: WalletAddress,
        recipient: WalletAddress,
        payload: Vec<u8>,
    ) -> Self {
        let nonce = [0u8; 24]; // TODO: Generate random nonce
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let message_id = format!("msg_{}", uuid::Uuid::new_v4());
        
        Self {
            sender,
            recipient,
            payload,
            nonce,
            timestamp,
            message_id,
        }
    }
    
    pub fn size(&self) -> usize {
        self.payload.len()
    }
}

/// Protocol message types
/// DEPRECATED: Use protobuf message types instead
#[deprecated(note = "Use protobuf message types")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProtocolMessage {
    Chat(EncryptedMessage),
    Ping { timestamp: u64 },
    Pong { timestamp: u64 },
    Ack { message_id: String },
}

impl ProtocolMessage {
    pub fn ping() -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Self::Ping { timestamp }
    }
    
    pub fn pong(timestamp: u64) -> Self {
        Self::Pong { timestamp }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ping_protocol() {
        let ping = ProtocolMessage::ping();
        
        match ping {
            ProtocolMessage::Ping { timestamp } => {
                assert!(timestamp > 0);
                let pong = ProtocolMessage::pong(timestamp);
                
                match pong {
                    ProtocolMessage::Pong { timestamp: pong_ts } => {
                        assert_eq!(timestamp, pong_ts);
                    }
                    _ => panic!("Expected pong message"),
                }
            }
            _ => panic!("Expected ping message"),
        }
    }
    
    #[test]
    fn test_wallet_address_creation() {
        let addr = WalletAddress::test_address(42);
        assert_eq!(addr.as_bytes()[0], 42);
        assert_eq!(addr.as_bytes()[1..], [0u8; 31]);
    }
    
    #[test]
    fn test_encrypted_message_creation() {
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let payload = b"Hello, Solana!".to_vec();
        
        let msg = EncryptedMessage::new(sender.clone(), recipient.clone(), payload.clone());
        
        assert_eq!(msg.sender, sender);
        assert_eq!(msg.recipient, recipient);
        assert_eq!(msg.payload, payload);
        assert_eq!(msg.size(), 14);
        assert!(!msg.message_id.is_empty());
    }
    
    #[test]
    fn test_new_protobuf_messages() {
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let payload = b"Hello, protobuf!".to_vec();
        let signature = b"fake_signature".to_vec();
        
        let chat_msg = ChatMessage::new(&sender, &recipient, payload.clone(), signature);
        assert!(!chat_msg.id.is_empty());
        assert_eq!(chat_msg.encrypted_payload, payload);
        
        let ack_msg = AckMessage::delivered(chat_msg.id.clone());
        assert_eq!(ack_msg.ref_message_id, chat_msg.id);
        assert_eq!(ack_msg.status(), AckStatus::Delivered);
    }
} 