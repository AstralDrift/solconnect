// Auto-generated protobuf types
// Don't edit this by hand unless you enjoy pain and suffering
pub mod proto {
    include!(concat!(env!("OUT_DIR"), "/solchat.message.rs"));
}

use crate::WalletAddress;
use std::time::{SystemTime, UNIX_EPOCH};

pub use proto::{ChatMessage, AckMessage, AckStatus, HandshakeRequest, HandshakeResponse, ReadReceipt};

/// Conversion helpers for protobuf types
impl ChatMessage {
    pub fn new(
        sender: &WalletAddress,
        recipient: &WalletAddress,
        encrypted_payload: Vec<u8>,
        signature: Vec<u8>,
    ) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            id: format!("msg_{}", uuid::Uuid::new_v4()),
            sender_wallet: sender.to_string(),
            recipient_wallet: recipient.to_string(),
            timestamp,
            encrypted_payload,
            attachment_url: None,
            ttl: 0, // No expiry by default
            signature,
        }
    }
    
    pub fn with_ttl(mut self, ttl_seconds: u32) -> Self {
        self.ttl = ttl_seconds;
        self
    }
    
    pub fn with_attachment(mut self, url: String) -> Self {
        self.attachment_url = Some(url);
        self
    }
    
    pub fn sender(&self) -> Result<WalletAddress, String> {
        let decoded = bs58::decode(&self.sender_wallet)
            .into_vec()
            .map_err(|e| format!("Invalid sender wallet: {}", e))?;
        
        if decoded.len() != 32 {
            return Err("Invalid wallet address length".to_string());
        }
        
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&decoded);
        Ok(WalletAddress::new(bytes))
    }
    
    pub fn recipient(&self) -> Result<WalletAddress, String> {
        let decoded = bs58::decode(&self.recipient_wallet)
            .into_vec()
            .map_err(|e| format!("Invalid recipient wallet: {}", e))?;
        
        if decoded.len() != 32 {
            return Err("Invalid wallet address length".to_string());
        }
        
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&decoded);
        Ok(WalletAddress::new(bytes))
    }
    
    pub fn is_expired(&self) -> bool {
        if self.ttl == 0 {
            return false;
        }
        
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
            
        now > self.timestamp + self.ttl as u64
    }
}

impl AckMessage {
    pub fn new(ref_message_id: String, status: AckStatus) -> Self {
        Self {
            id: format!("ack_{}", uuid::Uuid::new_v4()),
            ref_message_id,
            status: status.into(),
        }
    }
    
    pub fn delivered(ref_message_id: String) -> Self {
        Self::new(ref_message_id, AckStatus::Delivered)
    }
    
    pub fn failed(ref_message_id: String) -> Self {
        Self::new(ref_message_id, AckStatus::Failed)
    }
    
    pub fn expired(ref_message_id: String) -> Self {
        Self::new(ref_message_id, AckStatus::Expired)
    }
    
    pub fn rejected(ref_message_id: String) -> Self {
        Self::new(ref_message_id, AckStatus::Rejected)
    }
}

impl HandshakeRequest {
    pub fn new(wallet: &WalletAddress, signature: Vec<u8>) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            wallet_address: wallet.to_string(),
            timestamp,
            signature,
            version: "1.0.0".to_string(),
        }
    }
    
    pub fn wallet(&self) -> Result<WalletAddress, String> {
        let decoded = bs58::decode(&self.wallet_address)
            .into_vec()
            .map_err(|e| format!("Invalid wallet address: {}", e))?;
        
        if decoded.len() != 32 {
            return Err("Invalid wallet address length".to_string());
        }
        
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&decoded);
        Ok(WalletAddress::new(bytes))
    }
    
    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        // Handshake requests expire after 30 seconds
        now > self.timestamp + 30
    }
}

impl HandshakeResponse {
    pub fn success() -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            success: true,
            error: None,
            timestamp,
        }
    }
    
    pub fn failure(message: String) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            success: false,
            error: Some(message),
            timestamp,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_message_creation() {
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let payload = b"Hello, blockchain!".to_vec();
        let signature = b"fake_signature".to_vec();
        
        let msg = ChatMessage::new(&sender, &recipient, payload.clone(), signature.clone());
        
        assert!(!msg.id.is_empty());
        assert_eq!(msg.encrypted_payload, payload);
        assert_eq!(msg.signature, signature);
        assert_eq!(msg.ttl, 0);
        assert!(!msg.is_expired());
        
        // Test conversion back
        assert_eq!(msg.sender().unwrap(), sender);
        assert_eq!(msg.recipient().unwrap(), recipient);
    }
    
    #[test]
    fn test_message_expiry() {
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let payload = b"Expired message".to_vec();
        let signature = b"fake_signature".to_vec();
        
        let mut msg = ChatMessage::new(&sender, &recipient, payload, signature);
        
        // Set timestamp to 1 hour ago and TTL to 30 minutes
        msg.timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() - 3600; // 1 hour ago
        msg.ttl = 1800; // 30 minutes
        
        assert!(msg.is_expired());
    }
    
    #[test]
    fn test_ack_message_creation() {
        let ref_id = "msg_12345".to_string();
        
        let delivered = AckMessage::delivered(ref_id.clone());
        assert_eq!(delivered.ref_message_id, ref_id);
        assert_eq!(delivered.status(), AckStatus::Delivered);
        
        let failed = AckMessage::failed(ref_id.clone());
        assert_eq!(failed.status(), AckStatus::Failed);
    }
} 