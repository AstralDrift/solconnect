use anyhow::Result;
use prost::Message;
use solchat_protocol::{ChatMessage, AckMessage, AckStatus, WalletAddress};
use std::time::Duration;

// Testing is like debugging - it's what you should have done in the first place

#[tokio::test]
async fn test_chat_message_serialization() -> Result<()> {
    let sender = WalletAddress::test_address(1);
    let recipient = WalletAddress::test_address(2);
    let payload = b"Hello from integration test!".to_vec();
    let signature = b"test_signature_12345".to_vec();
    
    let chat_msg = ChatMessage::new(&sender, &recipient, payload.clone(), signature);
    let msg_id = chat_msg.id.clone();
    
    // Test protobuf serialization
    let encoded = chat_msg.encode_to_vec();
    assert!(!encoded.is_empty());
    
    // Test deserialization
    let decoded: ChatMessage = Message::decode(&encoded[..])?;
    assert_eq!(decoded.id, msg_id);
    assert_eq!(decoded.encrypted_payload, payload);
    assert_eq!(decoded.sender_wallet, sender.to_string());
    assert_eq!(decoded.recipient_wallet, recipient.to_string());
    
    println!("✅ Chat message serialization test passed");
    Ok(())
}

#[tokio::test]
async fn test_ack_message_creation() -> Result<()> {
    let ref_id = "msg_12345".to_string();
    
    // Test different ack types
    let delivered = AckMessage::delivered(ref_id.clone());
    assert_eq!(delivered.ref_message_id, ref_id);
    assert_eq!(delivered.status(), AckStatus::Delivered);
    assert!(!delivered.id.is_empty());
    
    let failed = AckMessage::failed(ref_id.clone());
    assert_eq!(failed.status(), AckStatus::Failed);
    
    let expired = AckMessage::expired(ref_id.clone());
    assert_eq!(expired.status(), AckStatus::Expired);
    
    let rejected = AckMessage::rejected(ref_id.clone());
    assert_eq!(rejected.status(), AckStatus::Rejected);
    
    // Test serialization
    let encoded = delivered.encode_to_vec();
    let decoded: AckMessage = Message::decode(&encoded[..])?;
    assert_eq!(decoded.ref_message_id, ref_id);
    assert_eq!(decoded.status(), AckStatus::Delivered);
    
    println!("✅ Ack message creation test passed");
    Ok(())
}

#[tokio::test]
async fn test_message_validation() -> Result<()> {
    let sender = WalletAddress::test_address(1);
    let recipient = WalletAddress::test_address(2);
    
    // Test empty payload validation
    let empty_payload = vec![];
    let signature = b"test_signature".to_vec();
    let empty_msg = ChatMessage::new(&sender, &recipient, empty_payload, signature);
    
    // Empty payload should be detectable
    assert!(empty_msg.encrypted_payload.is_empty());
    
    // Test TTL expiry
    let payload = b"This message will expire".to_vec();
    let signature = b"test_signature".to_vec();
    let mut expired_msg = ChatMessage::new(&sender, &recipient, payload, signature);
    
    // Set message to have expired 1 hour ago
    expired_msg.timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() - 3600; // 1 hour ago
    expired_msg.ttl = 1800; // 30 minutes TTL
    
    assert!(expired_msg.is_expired());
    
    // Test non-expired message
    let fresh_payload = b"Fresh message".to_vec();
    let fresh_signature = b"fresh_signature".to_vec();
    let fresh_msg = ChatMessage::new(&sender, &recipient, fresh_payload, fresh_signature);
    assert!(!fresh_msg.is_expired()); // No TTL set, so never expires
    
    println!("✅ Message validation test passed");
    Ok(())
}

#[tokio::test]
async fn test_protobuf_compatibility() -> Result<()> {
    // Test that our protobuf messages are compatible across versions
    let sender = WalletAddress::test_address(1);
    let recipient = WalletAddress::test_address(2);
    let payload = b"Compatibility test".to_vec();
    let signature = b"test_signature".to_vec();
    
    let msg = ChatMessage::new(&sender, &recipient, payload, signature);
    
    // Test that we can encode and decode without data loss
    let encoded = msg.encode_to_vec();
    let decoded: ChatMessage = Message::decode(&encoded[..])?;
    
    assert_eq!(decoded.id, msg.id);
    assert_eq!(decoded.sender_wallet, msg.sender_wallet);
    assert_eq!(decoded.recipient_wallet, msg.recipient_wallet);
    assert_eq!(decoded.encrypted_payload, msg.encrypted_payload);
    assert_eq!(decoded.signature, msg.signature);
    assert_eq!(decoded.timestamp, msg.timestamp);
    assert_eq!(decoded.ttl, msg.ttl);
    
    println!("✅ Protobuf compatibility test passed");
    Ok(())
}

#[tokio::test]
async fn test_message_size_limits() -> Result<()> {
    let sender = WalletAddress::test_address(1);
    let recipient = WalletAddress::test_address(2);
    
    // Test various message sizes
    let sizes = vec![64, 1024, 16384, 65536]; // 64B, 1KB, 16KB, 64KB
    
    for size in sizes {
        let payload = vec![42u8; size];
        let signature = b"test_signature".to_vec();
        
        let msg = ChatMessage::new(&sender, &recipient, payload.clone(), signature);
        
        // Verify message can be serialized
        let encoded = msg.encode_to_vec();
        assert!(!encoded.is_empty());
        
        // Verify it can be deserialized
        let decoded: ChatMessage = Message::decode(&encoded[..])?;
        assert_eq!(decoded.encrypted_payload.len(), size);
        assert_eq!(decoded.encrypted_payload, payload);
    }
    
    println!("✅ Message size limits test passed");
    Ok(())
}

#[tokio::test]
async fn test_concurrent_message_processing() -> Result<()> {
    let num_messages = 100;
    
    // Simulate concurrent message processing
    let mut tasks = vec![];
    
    for i in 0..num_messages {
        let task = tokio::spawn(async move {
            let sender = WalletAddress::test_address((i % 10) as u8);
            let recipient = WalletAddress::test_address(((i + 1) % 10) as u8);
            let payload = format!("Message {}", i).into_bytes();
            let signature = format!("sig_{}", i).into_bytes();
            
            let payload_len = payload.len();
            let msg = ChatMessage::new(&sender, &recipient, payload, signature);
            let encoded = msg.encode_to_vec();
            
            // Verify message can be processed
            let decoded: ChatMessage = Message::decode(&encoded[..])?;
            assert_eq!(decoded.encrypted_payload.len(), payload_len);
            
            // Create acknowledgment
            let ack = AckMessage::delivered(msg.id);
            let ack_encoded = ack.encode_to_vec();
            assert!(!ack_encoded.is_empty());
            
            Ok::<(), anyhow::Error>(())
        });
        
        tasks.push(task);
    }
    
    // Wait for all tasks to complete
    for task in tasks {
        task.await??;
    }
    
    println!("✅ Concurrent message processing test passed ({} messages)", num_messages);
    Ok(())
}

#[tokio::test]
async fn test_message_with_attachment() -> Result<()> {
    let sender = WalletAddress::test_address(1);
    let recipient = WalletAddress::test_address(2);
    let payload = b"Message with attachment".to_vec();
    let signature = b"test_signature".to_vec();
    
    let msg = ChatMessage::new(&sender, &recipient, payload, signature)
        .with_attachment("https://example.com/file.jpg".to_string())
        .with_ttl(3600); // 1 hour TTL
    
    assert!(msg.attachment_url.is_some());
    assert_eq!(msg.attachment_url.as_ref().unwrap(), "https://example.com/file.jpg");
    assert_eq!(msg.ttl, 3600);
    assert!(!msg.is_expired());
    
    // Test serialization with attachment
    let encoded = msg.encode_to_vec();
    let decoded: ChatMessage = Message::decode(&encoded[..])?;
    
    assert!(decoded.attachment_url.is_some());
    assert_eq!(decoded.attachment_url.unwrap(), "https://example.com/file.jpg");
    assert_eq!(decoded.ttl, 3600);
    
    println!("✅ Message with attachment test passed");
    Ok(())
}

#[cfg(test)]
mod stress_tests {
    use super::*;
    
    #[tokio::test]
    #[ignore] // Only run with --ignored flag
    async fn test_large_message_batch() -> Result<()> {
        let batch_size = 1000;
        let message_size = 4096; // 4KB messages
        
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        
        let start = std::time::Instant::now();
        
        for i in 0..batch_size {
            let payload = vec![((i % 256) as u8); message_size];
            let signature = format!("sig_{}", i).into_bytes();
            
            let msg = ChatMessage::new(&sender, &recipient, payload, signature);
            let encoded = msg.encode_to_vec();
            
            // Verify each message
            let decoded: ChatMessage = Message::decode(&encoded[..])?;
            assert_eq!(decoded.encrypted_payload.len(), message_size);
        }
        
        let duration = start.elapsed();
        let throughput = batch_size as f64 / duration.as_secs_f64();
        
        println!("✅ Large message batch test passed: {} messages in {:.2}s ({:.0} msg/s)", 
                 batch_size, duration.as_secs_f64(), throughput);
        
        Ok(())
    }
} 