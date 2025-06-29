use anyhow::Result;
use clap::Parser;
use hyper::{Body, Request, Response, Server};
use hyper::service::{make_service_fn, service_fn};
use quinn::{Endpoint, ServerConfig};
use solchat_protocol::messages::{ChatMessage, AckMessage, ReadReceipt, PingMessage, PongMessage};
use solchat_protocol::WalletAddress;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, warn, error, debug, span, Level};
use tokio::sync::mpsc;

pub mod metrics;
pub mod router;

use metrics::Metrics;
use router::{MessageRouter, RoutableMessage, RelayMessage};

// This is where the magic (and the bugs) happen

#[derive(Parser)]
#[command(name = "solchat_relay")]
#[command(about = "SolConnect QUIC message relay server")]
struct Args {
    #[arg(long, default_value = "0.0.0.0:4433")]
    listen: SocketAddr,
    
    #[arg(long, default_value = "0.0.0.0:8080")]
    metrics_addr: SocketAddr,
    
    #[arg(long)]
    devnet: bool,
}

#[derive(Clone)]
struct AppState {
    metrics: Arc<Metrics>,
    router: Arc<MessageRouter>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    
    let args = Args::parse();
    let metrics = Arc::new(Metrics::new());
    let router = Arc::new(MessageRouter::new(metrics.clone()));
    
    // Start the metrics updater task
    router.clone().start_metrics_updater();
    
    let state = AppState {
        metrics: metrics.clone(),
        router,
    };
    
    info!(
        "🚀 Starting SolConnect relay server on {} (devnet: {}, metrics: {})",
        args.listen, args.devnet, args.metrics_addr
    );
    
    // Start metrics HTTP server
    let metrics_server = start_metrics_server(args.metrics_addr, metrics.clone());
    
    // Start QUIC server
    let server_config = configure_server()?;
    let endpoint = Endpoint::server(server_config, args.listen)?;
    
    info!("✅ QUIC server listening on {}", args.listen);
    info!("📊 Metrics server listening on {}/metrics", args.metrics_addr);
    
    let quic_server = async move {
        while let Some(conn) = endpoint.accept().await {
            let state = state.clone();
            tokio::spawn(handle_connection(conn, state));
        }
    };
    
    // Run both servers concurrently
    tokio::select! {
        _ = metrics_server => error!("Metrics server stopped"),
        _ = quic_server => error!("QUIC server stopped"),
    }
    
    Ok(())
}

async fn start_metrics_server(addr: SocketAddr, metrics: Arc<Metrics>) -> Result<()> {
    let make_svc = make_service_fn(move |_conn| {
        let metrics = metrics.clone();
        async move {
            Ok::<_, Infallible>(service_fn(move |req| {
                let metrics = metrics.clone();
                handle_metrics_request(req, metrics)
            }))
        }
    });
    
    let server = Server::bind(&addr).serve(make_svc);
    server.await.map_err(Into::into)
}

async fn handle_metrics_request(
    req: Request<Body>,
    metrics: Arc<Metrics>,
) -> Result<Response<Body>, Infallible> {
    match req.uri().path() {
        "/metrics" => {
            match metrics.export_metrics() {
                Ok(body) => Ok(Response::builder()
                    .header("Content-Type", "text/plain; version=0.0.4")
                    .body(Body::from(body))
                    .unwrap()),
                Err(e) => {
                    error!("Failed to export metrics: {}", e);
                    Ok(Response::builder()
                        .status(500)
                        .body(Body::from("Internal Server Error"))
                        .unwrap())
                }
            }
        }
        "/health" => Ok(Response::new(Body::from("OK"))),
        _ => Ok(Response::builder()
            .status(404)
            .body(Body::from("Not Found"))
            .unwrap()),
    }
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

async fn handle_connection(conn: quinn::Connecting, state: AppState) {
    let connection_start = Instant::now();
    
    match conn.await {
        Ok(connection) => {
            let remote_addr = connection.remote_address();
            state.metrics.increment_connections();
            
            let conn_span = span!(Level::INFO, "connection", remote = %remote_addr);
            let _enter = conn_span.enter();
            
            info!("🔗 New connection established");
            
            // Create a channel for sending messages to this client
            let (tx, mut rx) = mpsc::channel::<RoutableMessage>(100);
            
            // Handle incoming streams and outgoing messages concurrently
            let incoming_state = state.clone();
            let outgoing_state = state.clone();
            let connection_clone = connection.clone();
            
            let incoming_task = tokio::spawn(async move {
                while let Ok((mut send, mut recv)) = connection.accept_bi().await {
                    let state = incoming_state.clone();
                    let tx = tx.clone();
                    let addr = remote_addr;
                    tokio::spawn(async move {
                        if let Err(e) = handle_stream(&mut send, &mut recv, state, tx, addr).await {
                            error!("Stream error: {}", e);
                        }
                    });
                }
            });
            
            // Task to handle outgoing messages
            let outgoing_task = tokio::spawn(async move {
                while let Some(routable_msg) = rx.recv().await {
                    match connection_clone.open_bi().await {
                        Ok((mut send, _recv)) => {
                            let msg_bytes = prost::Message::encode_to_vec(&routable_msg.message);
                            if let Err(e) = send.write_all(&msg_bytes).await {
                                error!("Failed to forward message: {}", e);
                            } else {
                                if let Err(e) = send.finish().await {
                                    error!("Failed to finish stream: {}", e);
                                }
                                outgoing_state.metrics.record_bytes_sent(msg_bytes.len());
                                debug!("📨 Forwarded message to recipient");
                            }
                        }
                        Err(e) => {
                            error!("Failed to open stream for message forwarding: {}", e);
                        }
                    }
                }
            });
            
            // Wait for either task to complete
            tokio::select! {
                _ = incoming_task => {
                    debug!("Incoming task completed");
                }
                _ = outgoing_task => {
                    debug!("Outgoing task completed");
                }
            }
            
            let duration = connection_start.elapsed().as_secs_f64();
            state.metrics.record_connection_duration(duration);
            state.metrics.decrement_connections();
            
            info!("🔌 Connection closed (duration: {:.2}s)", duration);
        }
        Err(e) => {
            warn!("Connection failed: {}", e);
        }
    }
}

async fn handle_stream(
    send: &mut quinn::SendStream,
    recv: &mut quinn::RecvStream,
    state: AppState,
    client_tx: mpsc::Sender<RoutableMessage>,
    remote_addr: SocketAddr,
) -> Result<()> {
    let mut buf = [0u8; 65536]; // 64KB buffer
    
    while let Some(len) = recv.read(&mut buf).await? {
        if len == 0 {
            break;
        }
        
        let start_time = Instant::now();
        let data = &buf[..len];
        
        state.metrics.record_bytes_received(len);
        
        debug!("📨 Received {} bytes", len);
        
        let relay_message = if let Ok(chat_msg) = prost::Message::decode(data) {
            RelayMessage::Chat(chat_msg)
        } else if let Ok(ack_msg) = prost::Message::decode(data) {
            RelayMessage::Ack(ack_msg)
        } else if let Ok(read_receipt_msg) = prost::Message::decode(data) {
            RelayMessage::ReadReceipt(read_receipt_msg)
        } else if let Ok(ping_msg) = prost::Message::decode(data) {
            RelayMessage::Ping(ping_msg)
        } else if let Ok(pong_msg) = prost::Message::decode(data) {
            RelayMessage::Pong(pong_msg)
        } else {
            warn!("Failed to decode incoming message as any known type");
            state.metrics.record_message_failed();
            return Ok(());
        };

        if let Err(e) = state.router.route_message(relay_message, remote_addr).await {
            error!("Failed to route message: {}", e);
            state.metrics.record_message_failed();
        } else {
            let duration = start_time.elapsed().as_secs_f64();
            state.metrics.record_latency(duration);
            state.metrics.record_message_processed(len, "RoutedMessage");
        }
    }
    
    send.finish().await?;
    Ok(())
}



#[cfg(test)]
mod tests {
    use super::*;
    use solchat_protocol::WalletAddress;

    #[tokio::test]
    async fn test_chat_message_processing() {
        let sender = WalletAddress::test_address(1);
        let recipient = WalletAddress::test_address(2);
        let payload = b"Hello, QUIC!".to_vec();
        let signature = b"fake_signature".to_vec();
        
        let chat_msg = ChatMessage::new(&sender, &recipient, payload, signature);
        
        // Verify message can be encoded/decoded
        let encoded = prost::Message::encode_to_vec(&chat_msg);
        let decoded: ChatMessage = prost::Message::decode(&encoded[..]).unwrap();
        
        assert_eq!(decoded.id, chat_msg.id);
        assert_eq!(decoded.sender_wallet, chat_msg.sender_wallet);
        assert_eq!(decoded.encrypted_payload, chat_msg.encrypted_payload);
    }
    
    #[test]
    fn test_metrics_creation() {
        let metrics = Metrics::new();
        let exported = metrics.export_metrics().unwrap();
        assert!(exported.contains("solchat_messages_processed_total"));
    }
    
    #[test]
    fn test_server_config_creation() {
        let config = configure_server();
        assert!(config.is_ok());
    }
} 