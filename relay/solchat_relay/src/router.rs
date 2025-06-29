use anyhow::Result;
use quinn::{SendStream, RecvStream};
use solchat_protocol::messages::{ChatMessage, AckMessage, AckStatus, ReadReceipt, PingMessage, PongMessage};
use solchat_protocol::WalletAddress;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing::{info, warn, error, debug};
use crate::metrics::Metrics;

/// Maximum number of queued messages per recipient
const MAX_QUEUED_MESSAGES: usize = 100;

/// Enum to represent all routable message types
#[derive(Clone, Debug)]
pub enum RelayMessage {
    Chat(ChatMessage),
    Ack(AckMessage),
    ReadReceipt(ReadReceipt),
    Ping(PingMessage),
    Pong(PongMessage),
}

/// Message to be routed
#[derive(Clone, Debug)]
pub struct RoutableMessage {
    pub message: RelayMessage,
    pub sender_addr: SocketAddr,
}

/// Connection information for a connected client
#[derive(Clone)]
pub struct ClientConnection {
    pub wallet_address: WalletAddress,
    pub send_channel: mpsc::Sender<RoutableMessage>,
    pub connected_at: std::time::Instant,
}

/// Message router that handles routing messages between connected clients
pub struct MessageRouter {
    /// Map of wallet addresses to their connections
    connections: Arc<RwLock<HashMap<String, ClientConnection>>>,
    
    /// Queued messages for offline recipients
    message_queue: Arc<RwLock<HashMap<String, Vec<RoutableMessage>>>>,
    
    /// Metrics for monitoring
    metrics: Arc<Metrics>,
}

impl MessageRouter {
    pub fn new(metrics: Arc<Metrics>) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            message_queue: Arc::new(RwLock::new(HashMap::new())),
            metrics,
        }
    }
    
    /// Register a new client connection
    pub async fn register_client(
        &self,
        wallet_address: WalletAddress,
        send_channel: mpsc::Sender<RoutableMessage>,
    ) -> Result<()> {
        let wallet_str = wallet_address.to_string();
        
        let mut connections = self.connections.write().await;
        connections.insert(wallet_str.clone(), ClientConnection {
            wallet_address: wallet_address.clone(),
            send_channel: send_channel.clone(),
            connected_at: std::time::Instant::now(),
        });
        
        // Update metrics
        self.metrics.set_registered_clients(connections.len() as i64);
        
        info!("📝 Registered client: {}", wallet_str);
        
        // Check for queued messages
        drop(connections); // Release the write lock before calling deliver_queued_messages
        self.deliver_queued_messages(&wallet_str, send_channel).await?;
        
        Ok(())
    }
    
    /// Unregister a client connection
    pub async fn unregister_client(&self, wallet_address: &WalletAddress) -> Result<()> {
        let wallet_str = wallet_address.to_string();
        
        let mut connections = self.connections.write().await;
        if connections.remove(&wallet_str).is_some() {
            // Update metrics
            self.metrics.set_registered_clients(connections.len() as i64);
            info!("🔌 Unregistered client: {}", wallet_str);
        }
        
        Ok(())
    }
    
    /// Route a message to its recipient
    pub async fn route_message(
        &self,
        relay_message: RelayMessage,
        sender_addr: SocketAddr,
    ) -> Result<AckStatus> {
        match relay_message {
            RelayMessage::Chat(message) => {
                // Validate the message
                let recipient = message.recipient_wallet;
                
                let recipient_str = recipient.to_string();
                let routable = RoutableMessage {
                    message: RelayMessage::Chat(message.clone()),
                    sender_addr,
                };
                
                // Check if recipient is online
                let connections = self.connections.read().await;
                if let Some(connection) = connections.get(&recipient_str) {
                    // Recipient is online, send directly
                    match connection.send_channel.send(routable.clone()).await {
                        Ok(_) => {
                            debug!("✉️ Message routed to online recipient: {}", recipient_str);
                            self.metrics.record_message_routed();
                            Ok(AckStatus::Delivered)
                        }
                        Err(e) => {
                            error!("Failed to send to recipient channel: {}", e);
                            // Queue the message as the channel might be full
                            drop(connections);
                            self.queue_message(&recipient_str, routable).await?;
                            Ok(AckStatus::Delivered)
                        }
                    }
                } else {
                    // Recipient is offline, queue the message
                    drop(connections);
                    self.queue_message(&recipient_str, routable).await?;
                    debug!("📮 Message queued for offline recipient: {}", recipient_str);
                    Ok(AckStatus::Delivered)
                }
            },
            RelayMessage::Ack(ack_message) => {
                // Acknowledge messages are routed back to the original sender
                let original_sender = ack_message.ref_message_id.split('-').next().unwrap_or(""); // Assuming message ID contains sender
                let routable = RoutableMessage {
                    message: RelayMessage::Ack(ack_message.clone()),
                    sender_addr,
                };

                let connections = self.connections.read().await;
                if let Some(connection) = connections.get(original_sender) {
                    match connection.send_channel.send(routable.clone()).await {
                        Ok(_) => {
                            debug!("✅ Ack routed to original sender: {}", original_sender);
                            Ok(AckStatus::Delivered)
                        },
                        Err(e) => {
                            error!("Failed to send ack to original sender: {}", e);
                            Ok(AckStatus::Failed)
                        }
                    }
                } else {
                    warn!("Original sender offline, cannot route ack: {}", original_sender);
                    Ok(AckStatus::Failed)
                }
            },
            RelayMessage::ReadReceipt(read_receipt) => {
                // Read receipts are routed back to the sender of the original message
                let original_sender = read_receipt.message_id.split('-').next().unwrap_or(""); // Assuming message ID contains sender
                let routable = RoutableMessage {
                    message: RelayMessage::ReadReceipt(read_receipt.clone()),
                    sender_addr,
                };

                let connections = self.connections.read().await;
                if let Some(connection) = connections.get(original_sender) {
                    match connection.send_channel.send(routable.clone()).await {
                        Ok(_) => {
                            debug!("👀 Read receipt routed to original sender: {}", original_sender);
                            Ok(AckStatus::Delivered)
                        },
                        Err(e) => {
                            error!("Failed to send read receipt to original sender: {}", e);
                            Ok(AckStatus::Failed)
                        }
                    }
                } else {
                    warn!("Original sender offline, cannot route read receipt: {}", original_sender);
                    Ok(AckStatus::Failed)
                }
            },
            RelayMessage::Ping(ping_message) => {
                info!("Received ping from {:?}", sender_addr);
                // Pings are not routed, just acknowledged implicitly by connection staying alive
                Ok(AckStatus::Delivered)
            },
            RelayMessage::Pong(pong_message) => {
                info!("Received pong from {:?}", sender_addr);
                // Pongs are not routed
                Ok(AckStatus::Delivered)
            },
        }
    }
    
    /// Queue a message for an offline recipient
    async fn queue_message(
        &self,
        recipient: &str,
        message: RoutableMessage,
    ) -> Result<()> {
        let mut queue = self.message_queue.write().await;
        let messages = queue.entry(recipient.to_string()).or_insert_with(Vec::new);
        
        // Limit queue size to prevent memory issues
        if messages.len() >= MAX_QUEUED_MESSAGES {
            warn!("Message queue full for recipient: {}, dropping oldest message", recipient);
            messages.remove(0);
        }
        
        messages.push(message);
        self.metrics.record_message_queued();
        
        // Update queued messages metric
        let total_queued: usize = queue.values().map(|v| v.len()).sum();
        self.metrics.set_queued_messages(total_queued as i64);
        
        Ok(())
    }
    
    /// Deliver queued messages to a newly connected client
    async fn deliver_queued_messages(
        &self,
        wallet_address: &str,
        send_channel: mpsc::Sender<RoutableMessage>,
    ) -> Result<()> {
        let mut queue = self.message_queue.write().await;
        
        if let Some(mut messages) = queue.remove(wallet_address) {
            let total_messages = messages.len();
            info!("📤 Delivering {} queued messages to {}", total_messages, wallet_address);
            
            let mut delivered = 0;
            let mut failed_messages = Vec::new();
            
            for message in messages.drain(..) {
                if let Err(e) = send_channel.send(message.clone()).await {
                    error!("Failed to deliver queued message: {}", e);
                    // Collect failed messages to re-queue
                    failed_messages.push(message);
                    break;
                }
                delivered += 1;
                self.metrics.record_message_routed();
            }
            
            // Re-queue any failed messages
            if !failed_messages.is_empty() {
                queue.entry(wallet_address.to_string())
                    .or_insert_with(Vec::new)
                    .extend(failed_messages);
            }
            
            info!("✅ Delivered {}/{} queued messages", delivered, total_messages);
            
            // Update queued messages metric
            let total_queued: usize = queue.values().map(|v| v.len()).sum();
            self.metrics.set_queued_messages(total_queued as i64);
        }
        
        Ok(())
    }
    
    /// Get current connection statistics
    pub async fn get_stats(&self) -> RouterStats {
        let connections = self.connections.read().await;
        let queue = self.message_queue.read().await;
        
        let total_queued = queue.values().map(|v| v.len()).sum();
        
        RouterStats {
            connected_clients: connections.len(),
            queued_messages: total_queued,
            recipients_with_queued: queue.len(),
        }
    }
    
    /// Start a periodic task to update metrics
    pub fn start_metrics_updater(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
            
            loop {
                interval.tick().await;
                let stats = self.get_stats().await;
                self.metrics.set_registered_clients(stats.connected_clients as i64);
                self.metrics.set_queued_messages(stats.queued_messages as i64);
            }
        });
    }
}

#[derive(Debug, Clone)]
pub struct RouterStats {
    pub connected_clients: usize,
    pub queued_messages: usize,
    pub recipients_with_queued: usize,
}

use std::net::SocketAddr;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_router_registration() {
        let metrics = Arc::new(Metrics::new());
        let router = MessageRouter::new(metrics);
        let wallet = WalletAddress::test_address(1);
        let (tx, _rx) = mpsc::channel(10);
        
        router.register_client(wallet.clone(), tx).await.unwrap();
        
        let stats = router.get_stats().await;
        assert_eq!(stats.connected_clients, 1);
        
        router.unregister_client(&wallet).await.unwrap();
        
        let stats = router.get_stats().await;
        assert_eq!(stats.connected_clients, 0);
    }
    
    #[tokio::test]
    async fn test_message_queueing() {
        let metrics = Arc::new(Metrics::new());
        let router = MessageRouter::new(metrics);
        
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let message = ChatMessage::new(
            &sender,
            &recipient,
            b"Test message".to_vec(),
            b"signature".to_vec(),
        );
        
        let sender_addr = "127.0.0.1:1234".parse().unwrap();
        
        // Route message to offline recipient
        let status = router.route_message(RelayMessage::Chat(message), sender_addr).await.unwrap();
        assert_eq!(status, AckStatus::Delivered);
        
        let stats = router.get_stats().await;
        assert_eq!(stats.queued_messages, 1);
        assert_eq!(stats.recipients_with_queued, 1);
    }
}  