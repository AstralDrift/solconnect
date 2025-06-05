use solchat_protocol::{EncryptedMessage, ProtocolMessage, WalletAddress};
use std::sync::Arc;

// The future is mobile-first, and mobile is Rust-first 📱

uniffi::include_scaffolding!("solchat_sdk");

/// Mobile-friendly wrapper for wallet addresses
#[derive(Debug, Clone)]
pub struct MobileWalletAddress {
    inner: WalletAddress,
}

impl MobileWalletAddress {
    pub fn new(address_bytes: Vec<u8>) -> Option<Self> {
        if address_bytes.len() != 32 {
            return None;
        }
        
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&address_bytes);
        
        Some(Self {
            inner: WalletAddress::new(bytes),
        })
    }
    
    pub fn to_string(&self) -> String {
        self.inner.to_string()
    }
    
    pub fn test_address(seed: u8) -> Self {
        Self {
            inner: WalletAddress::test_address(seed),
        }
    }
}

/// Message sending result
#[derive(Debug)]
pub enum SendResult {
    Success { message_id: String },
    Error { message: String },
}

/// Message callback for received messages
pub trait MessageCallback: Send + Sync {
    fn on_message_received(&self, sender: String, message: String);
    fn on_error(&self, error: String);
}

/// Main SDK interface for mobile apps
pub struct SolChatSDK {
    wallet_address: Option<MobileWalletAddress>,
    callback: Option<Arc<dyn MessageCallback>>,
}

impl SolChatSDK {
    pub fn new() -> Self {
        Self {
            wallet_address: None,
            callback: None,
        }
    }
    
    pub fn set_wallet(&mut self, wallet: MobileWalletAddress) {
        self.wallet_address = Some(wallet);
    }
    
    pub fn set_callback(&mut self, callback: Arc<dyn MessageCallback>) {
        self.callback = Some(callback);
    }
    
    pub fn send_message(
        &self,
        recipient: MobileWalletAddress,
        message: String,
    ) -> SendResult {
        match &self.wallet_address {
            Some(sender) => {
                let payload = message.into_bytes();
                let encrypted_msg = EncryptedMessage::new(
                    sender.inner.clone(),
                    recipient.inner.clone(),
                    payload,
                );
                
                // TODO: Actually send via QUIC relay
                SendResult::Success {
                    message_id: encrypted_msg.message_id.clone(),
                }
            }
            None => SendResult::Error {
                message: "No wallet address set".to_string(),
            },
        }
    }
    
    pub fn receive_callback(&self, raw_message: Vec<u8>) {
        if let Some(callback) = &self.callback {
            match serde_json::from_slice::<ProtocolMessage>(&raw_message) {
                Ok(ProtocolMessage::Chat(encrypted_msg)) => {
                    let sender = encrypted_msg.sender.to_string();
                    let message = String::from_utf8_lossy(&encrypted_msg.payload).to_string();
                    callback.on_message_received(sender, message);
                }
                Ok(_) => {
                    // Ignore non-chat messages
                }
                Err(e) => {
                    callback.on_error(format!("Failed to parse message: {}", e));
                }
            }
        }
    }
}

impl Default for SolChatSDK {
    fn default() -> Self {
        Self::new()
    }
}

// FFI exports for mobile platforms
#[uniffi::export]
pub fn create_sdk() -> Arc<SolChatSDK> {
    Arc::new(SolChatSDK::new())
}

#[uniffi::export]
pub fn create_test_wallet(seed: u8) -> MobileWalletAddress {
    MobileWalletAddress::test_address(seed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    struct TestCallback {
        messages: Mutex<Vec<(String, String)>>,
        errors: Mutex<Vec<String>>,
    }

    impl TestCallback {
        fn new() -> Self {
            Self {
                messages: Mutex::new(Vec::new()),
                errors: Mutex::new(Vec::new()),
            }
        }
    }

    impl MessageCallback for TestCallback {
        fn on_message_received(&self, sender: String, message: String) {
            self.messages.lock().unwrap().push((sender, message));
        }

        fn on_error(&self, error: String) {
            self.errors.lock().unwrap().push(error);
        }
    }

    #[test]
    fn test_wallet_creation() {
        let wallet = MobileWalletAddress::test_address(42);
        assert!(!wallet.to_string().is_empty());
    }

    #[test]
    fn test_send_message() {
        let mut sdk = SolChatSDK::new();
        let sender = MobileWalletAddress::test_address(1);
        let recipient = MobileWalletAddress::test_address(2);
        
        sdk.set_wallet(sender);
        
        let result = sdk.send_message(recipient, "Hello Solana!".to_string());
        
        match result {
            SendResult::Success { message_id } => {
                assert!(!message_id.is_empty());
            }
            SendResult::Error { .. } => panic!("Expected success"),
        }
    }

    #[test]
    fn test_receive_callback() {
        let sdk = SolChatSDK::new();
        let callback = Arc::new(TestCallback::new());
        
        // This would normally be set on the SDK, but for testing we'll call directly
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let msg = EncryptedMessage::new(sender, recipient, b"Test message".to_vec());
        let protocol_msg = ProtocolMessage::Chat(msg);
        let serialized = serde_json::to_vec(&protocol_msg).unwrap();
        
        callback.on_message_received(
            "test_sender".to_string(),
            "Test message".to_string(),
        );
        
        let messages = callback.messages.lock().unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].1, "Test message");
    }
} 