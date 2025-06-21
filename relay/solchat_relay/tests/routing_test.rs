use anyhow::Result;
use solchat_protocol::{ChatMessage, WalletAddress};
use solchat_relay::router::{MessageRouter, RoutableMessage};
use std::sync::Arc;
use tokio::sync::mpsc;
use std::net::SocketAddr;

#[tokio::test]
async fn test_message_routing_between_clients() -> Result<()> {
    // Create router with metrics
    let metrics = Arc::new(solchat_relay::metrics::Metrics::new());
    let router = Arc::new(MessageRouter::new(metrics));
    
    // Create two test wallets
    let alice = WalletAddress::test_address(1);
    let bob = WalletAddress::test_address(2);
    
    // Create channels for both clients
    let (alice_tx, mut alice_rx) = mpsc::channel::<RoutableMessage>(10);
    let (bob_tx, mut bob_rx) = mpsc::channel::<RoutableMessage>(10);
    
    // Register both clients
    router.register_client(alice.clone(), alice_tx).await?;
    router.register_client(bob.clone(), bob_tx).await?;
    
    // Alice sends a message to Bob
    let message = ChatMessage::new(
        &alice,
        &bob,
        b"Hello Bob!".to_vec(),
        b"alice_signature".to_vec(),
    );
    
    let sender_addr: SocketAddr = "127.0.0.1:1234".parse()?;
    
    // Route the message
    let status = router.route_message(message.clone(), sender_addr).await?;
    assert_eq!(status, solchat_protocol::AckStatus::Delivered);
    
    // Bob should receive the message
    let received = bob_rx.recv().await.expect("Bob should receive message");
    assert_eq!(received.message.id, message.id);
    assert_eq!(received.message.encrypted_payload, b"Hello Bob!".to_vec());
    
    // Verify stats
    let stats = router.get_stats().await;
    assert_eq!(stats.connected_clients, 2);
    assert_eq!(stats.queued_messages, 0);
    
    Ok(())
}

#[tokio::test]
async fn test_message_queueing_for_offline_recipient() -> Result<()> {
    let metrics = Arc::new(solchat_relay::metrics::Metrics::new());
    let router = Arc::new(MessageRouter::new(metrics));
    
    let alice = WalletAddress::test_address(1);
    let bob = WalletAddress::test_address(2);
    
    // Only register Alice
    let (alice_tx, _alice_rx) = mpsc::channel::<RoutableMessage>(10);
    router.register_client(alice.clone(), alice_tx).await?;
    
    // Alice sends a message to offline Bob
    let message = ChatMessage::new(
        &alice,
        &bob,
        b"Hello offline Bob!".to_vec(),
        b"alice_signature".to_vec(),
    );
    
    let sender_addr: SocketAddr = "127.0.0.1:1234".parse()?;
    
    // Route the message - should be queued
    let status = router.route_message(message.clone(), sender_addr).await?;
    assert_eq!(status, solchat_protocol::AckStatus::Delivered);
    
    // Verify message is queued
    let stats = router.get_stats().await;
    assert_eq!(stats.queued_messages, 1);
    
    // Now Bob comes online
    let (bob_tx, mut bob_rx) = mpsc::channel::<RoutableMessage>(10);
    router.register_client(bob.clone(), bob_tx).await?;
    
    // Bob should receive the queued message
    let received = bob_rx.recv().await.expect("Bob should receive queued message");
    assert_eq!(received.message.encrypted_payload, b"Hello offline Bob!".to_vec());
    
    // Queue should be empty now
    let stats = router.get_stats().await;
    assert_eq!(stats.queued_messages, 0);
    
    Ok(())
}

#[tokio::test]
async fn test_multiple_queued_messages_delivery() -> Result<()> {
    let metrics = Arc::new(solchat_relay::metrics::Metrics::new());
    let router = Arc::new(MessageRouter::new(metrics));
    
    let alice = WalletAddress::test_address(1);
    let bob = WalletAddress::test_address(2);
    
    // Only register Alice
    let (alice_tx, _alice_rx) = mpsc::channel::<RoutableMessage>(10);
    router.register_client(alice.clone(), alice_tx).await?;
    
    let sender_addr: SocketAddr = "127.0.0.1:1234".parse()?;
    
    // Send 3 messages to offline Bob
    for i in 0..3 {
        let message = ChatMessage::new(
            &alice,
            &bob,
            format!("Message {}", i).as_bytes().to_vec(),
            b"alice_signature".to_vec(),
        );
        
        let status = router.route_message(message, sender_addr).await?;
        assert_eq!(status, solchat_protocol::AckStatus::Delivered);
    }
    
    // Verify 3 messages are queued
    let stats = router.get_stats().await;
    assert_eq!(stats.queued_messages, 3);
    
    // Bob comes online
    let (bob_tx, mut bob_rx) = mpsc::channel::<RoutableMessage>(10);
    router.register_client(bob.clone(), bob_tx).await?;
    
    // Bob should receive all 3 messages
    for i in 0..3 {
        let received = bob_rx.recv().await.expect("Bob should receive message");
        assert_eq!(
            received.message.encrypted_payload,
            format!("Message {}", i).as_bytes().to_vec()
        );
    }
    
    // Queue should be empty
    let stats = router.get_stats().await;
    assert_eq!(stats.queued_messages, 0);
    
    Ok(())
} 