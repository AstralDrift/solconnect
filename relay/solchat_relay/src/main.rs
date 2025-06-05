use anyhow::Result;
use clap::Parser;
use quinn::{Endpoint, ServerConfig};
use solchat_protocol::{ProtocolMessage, WalletAddress};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{info, warn, error};

// This is not a drill

#[derive(Parser)]
#[command(name = "solchat_relay")]
#[command(about = "SolConnect QUIC message relay server")]
struct Args {
    #[arg(long, default_value = "0.0.0.0:4433")]
    listen: SocketAddr,
    
    #[arg(long)]
    devnet: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    
    let args = Args::parse();
    
    info!(
        "🚀 Starting SolConnect relay server on {} (devnet: {})",
        args.listen, args.devnet
    );
    
    let server_config = configure_server()?;
    let endpoint = Endpoint::server(server_config, args.listen)?;
    
    info!("✅ QUIC server listening on {}", args.listen);
    
    while let Some(conn) = endpoint.accept().await {
        tokio::spawn(handle_connection(conn));
    }
    
    Ok(())
}

fn configure_server() -> Result<ServerConfig> {
    let cert = rcgen::generate_simple_self_signed(vec!["localhost".into()])?;
    let cert_der = cert.serialize_der()?;
    let priv_key = cert.serialize_private_key_der();
    
    let cert_chain = vec![rustls::Certificate(cert_der)];
    let key_der = rustls::PrivateKey(priv_key);
    
    let server_config = rustls::ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(cert_chain, key_der)?;
    
    Ok(ServerConfig::with_crypto(Arc::new(server_config)))
}

async fn handle_connection(conn: quinn::Connecting) {
    match conn.await {
        Ok(connection) => {
            info!("🔗 New connection from {}", connection.remote_address());
            
            while let Ok((mut send, mut recv)) = connection.accept_bi().await {
                tokio::spawn(async move {
                    if let Err(e) = echo_messages(&mut send, &mut recv).await {
                        error!("Echo error: {}", e);
                    }
                });
            }
        }
        Err(e) => {
            warn!("Connection failed: {}", e);
        }
    }
}

async fn echo_messages(
    send: &mut quinn::SendStream,
    recv: &mut quinn::RecvStream,
) -> Result<()> {
    let mut buf = [0u8; 8192];
    
    while let Some(len) = recv.read(&mut buf).await? {
        if len == 0 {
            break;
        }
        
        let data = &buf[..len];
        
        // Parse and echo the message
        match serde_json::from_slice::<ProtocolMessage>(data) {
            Ok(ProtocolMessage::Ping { timestamp }) => {
                let pong = ProtocolMessage::pong(timestamp);
                let response = serde_json::to_vec(&pong)?;
                send.write_all(&response).await?;
                info!("📡 Ping-pong: {}", timestamp);
            }
            Ok(msg) => {
                // Echo back any other message
                send.write_all(data).await?;
                info!("🔄 Echoed {} bytes", len);
            }
            Err(e) => {
                warn!("Failed to parse message: {}", e);
                // Still echo raw bytes for debugging
                send.write_all(data).await?;
            }
        }
    }
    
    send.finish().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_echo_1kb_payload() {
        let test_data = vec![42u8; 1024]; // 1KB payload
        
        // Create a mock protocol message
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let msg = solchat_protocol::EncryptedMessage::new(
            sender,
            recipient,
            test_data.clone(),
        );
        let protocol_msg = ProtocolMessage::Chat(msg);
        
        let serialized = serde_json::to_vec(&protocol_msg).unwrap();
        assert!(serialized.len() > 1024); // Should be larger due to metadata
        
        // Verify message can be deserialized
        let deserialized: ProtocolMessage = serde_json::from_slice(&serialized).unwrap();
        match deserialized {
            ProtocolMessage::Chat(encrypted_msg) => {
                assert_eq!(encrypted_msg.payload, test_data);
                assert_eq!(encrypted_msg.size(), 1024);
            }
            _ => panic!("Expected chat message"),
        }
    }
    
    #[test]
    fn test_server_config_creation() {
        let config = configure_server();
        assert!(config.is_ok());
    }
} 