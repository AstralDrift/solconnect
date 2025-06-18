#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wallet_login() {
        let mut sdk = SolChatSdk::new();
        let result = sdk.wallet_login().unwrap();
        assert!(result.starts_with("So1"));
        assert_eq!(sdk.wallet_address, Some(result.clone()));
    }

    #[test]
    fn test_session_flow() {
        let mut sdk = SolChatSdk::new();
        sdk.wallet_login().unwrap();
        
        let peer = "So11111111111111111111111111111111111111112";
        let session = sdk.start_session(peer).unwrap();
        assert_eq!(session.peer_wallet, peer);
        assert!(session.session_id.starts_with("session_"));
        
        // Test sending message
        sdk.send_encrypted_message(&session, "Hello!").unwrap();
        
        // Test polling messages
        let messages = sdk.poll_messages(&session);
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].sender_wallet, sdk.wallet_address.unwrap());
        assert!(messages[0].ciphertext.starts_with("ENCRYPTED:"));
    }

    #[test]
    fn test_error_handling() {
        let mut sdk = SolChatSdk::new();
        
        // Should fail without login
        let result = sdk.start_session("peer");
        assert!(matches!(result, Err(SdkError::WalletError { .. })));
        
        // Should fail sending without login
        let session = Session {
            session_id: "test".to_string(),
            peer_wallet: "peer".to_string(),
        };
        let result = sdk.send_encrypted_message(&session, "test");
        assert!(matches!(result, Err(SdkError::WalletError { .. })));
    }

    #[test]
    fn test_message_queue() {
        let mut sdk = SolChatSdk::new();
        sdk.wallet_login().unwrap();
        
        let session = sdk.start_session("peer").unwrap();
        
        // Send multiple messages
        sdk.send_encrypted_message(&session, "Message 1").unwrap();
        sdk.send_encrypted_message(&session, "Message 2").unwrap();
        sdk.send_encrypted_message(&session, "Message 3").unwrap();
        
        // Poll messages
        let messages = sdk.poll_messages(&session);
        assert_eq!(messages.len(), 3);
        
        // Queue should be empty after polling
        let messages = sdk.poll_messages(&session);
        assert_eq!(messages.len(), 0);
    }

    #[test]
    fn test_mock_encryption() {
        let plaintext = "Hello, World!";
        let encrypted = mock_encrypt(plaintext);
        assert!(encrypted.starts_with("ENCRYPTED:"));
        
        let decrypted = mock_decrypt(&encrypted);
        assert_eq!(decrypted, plaintext);
    }
} 