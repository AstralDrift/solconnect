# SolConnect 🚀

> Wallet-native, encrypted chat MVP for Solana Mobile

SolConnect enables secure, peer-to-peer messaging using Solana wallet identities as the only authentication mechanism. Built for Solana Mobile Stack with end-to-end encryption and decentralized relay infrastructure.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │◄──►│   Relay Server   │◄──►│   Mobile App    │
│  (React Native) │    │   (Rust/QUIC)    │    │  (React Native) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Mobile SDK     │    │  Core Protocol   │    │  Mobile SDK     │
│  (Rust/FFI)     │    │     (Rust)       │    │  (Rust/FFI)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Android Studio (for Android development)
- Xcode (for iOS development)
- Solana CLI tools

### Building the Mobile SDK

1. Install Rust targets:
   ```bash
   rustup target add aarch64-linux-android aarch64-apple-ios
   ```

2. Build the SDK:
   ```bash
   cd mobile/solchat_sdk
   cargo build --target aarch64-linux-android
   cargo build --target aarch64-apple-ios
   ```

### Running the Mobile App

1. Install dependencies:
   ```bash
   cd apps/solchat_mobile
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Run on Android:
   ```bash
   npm run android
   ```

4. Run on iOS:
   ```bash
   npm run ios
   ```

### Connecting to Relay

1. Start the relay server:
   ```bash
   cd relay
   cargo run
   ```

2. The mobile app will automatically connect to the relay server at `localhost:8080` in development.

## Development

### Project Structure

```
.
├── apps/
│   └── solchat_mobile/     # React Native mobile app
├── core/
│   └── solchat_protocol/   # Core protocol implementation
├── mobile/
│   └── solchat_sdk/        # Mobile SDK with FFI bindings
├── relay/                  # Relay server
└── docs/                   # Documentation
```

### Testing

1. Run Rust tests:
   ```bash
   cargo test
   ```

2. Run mobile app tests:
   ```bash
   cd apps/solchat_mobile
   npm test
   ```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Security

- All cryptographic operations are performed in Rust
- No sensitive data is stored in the mobile app
- End-to-end encryption for all messages
- Secure wallet integration via Solana Mobile Adapter

## License

MIT

## Key Features

- **Wallet-Only Identity**: No separate accounts - your Solana wallet IS your identity
- **End-to-End Encryption**: Double ratchet protocol with forward secrecy
- **Hardware Security**: Solana Mobile Seed Vault integration for key operations
- **QUIC Protocol**: Low-latency, mobile-optimized transport layer
- **Cross-Platform**: iOS and Android via React Native + Rust FFI
- **Devnet Ready**: Easy local development with k3d + Kubernetes
- **Protocol Buffers**: Efficient, versioned message serialization
- **Metrics & Monitoring**: Prometheus metrics for relay performance
- **Message TTL**: Automatic message expiration for privacy

## Message Protocol

SolConnect uses Protocol Buffers for efficient, versioned message serialization:

### 📨 ChatMessage
```protobuf
message ChatMessage {
  string id = 1;                    // Unique message ID
  string sender_wallet = 2;         // Sender's wallet address (base58)
  string recipient_wallet = 3;      // Recipient's wallet address (base58)
  uint64 timestamp = 4;             // Unix timestamp
  bytes encrypted_payload = 5;      // Encrypted message content
  optional string attachment_url = 6; // Optional file attachment
  uint32 ttl = 7;                   // Time-to-live in seconds
  bytes signature = 8;              // Ed25519 signature
}
```

### ✅ AckMessage
```protobuf
message AckMessage {
  string id = 1;                    // Unique ack ID
  string ref_message_id = 2;        // Reference to original message
  AckStatus status = 3;             // Delivery status
}

enum AckStatus {
  UNSPECIFIED = 0;
  DELIVERED = 1;
  FAILED = 2;
  EXPIRED = 3;
  REJECTED = 4;
}
```

## Relay Server Features

The relay server provides:

- **Message Routing**: Efficient QUIC-based message delivery
- **Acknowledgments**: Automatic delivery confirmations
- **Metrics**: Prometheus metrics on `/metrics` endpoint
- **Health Checks**: Simple health endpoint at `/health`
- **Message Validation**: TTL expiry and payload validation
- **Structured Logging**: Tracing with message metadata
- **Backwards Compatibility**: Support for legacy JSON messages

### Metrics Available

- `solchat_messages_processed_total` - Total messages processed
- `solchat_messages_failed_total` - Failed message processing attempts
- `solchat_bytes_received_total` - Total bytes received
- `solchat_bytes_sent_total` - Total bytes sent
- `solchat_active_connections` - Current active connections
- `solchat_message_latency_seconds` - Message processing latency
- `solchat_message_size_bytes` - Message size distribution
- `solchat_connection_duration_seconds` - Connection duration

## How Crypto Works

SolConnect uses a hybrid cryptographic system designed for mobile-first security:

### 🔑 Key Derivation
```
Ed25519 Wallet Key → HKDF-SHA256 → X25519 ECDH Key
```
Your existing Solana wallet keys are used to derive messaging keys via secure key derivation, keeping your wallet safe while enabling encrypted chat.

### 🛡️ Session Security
- **Double Ratchet Protocol**: Signal-style forward secrecy
- **Hardware Protection**: Private keys never leave Seed Vault
- **Perfect Forward Secrecy**: Compromised keys can't decrypt past messages
- **Future Secrecy**: Compromised state can't decrypt future messages

### 📱 Mobile Integration
- **Seed Vault**: Hardware-backed key operations on Solana Mobile
- **Secure Enclave**: iOS/Android hardware security modules
- **Zero-Copy**: FFI layer minimizes sensitive data exposure
- **Zeroization**: Keys automatically cleared from memory

## Development Workflow

1. Make changes to Rust core (`core/`, `relay/`, `mobile/`)
2. Update protobuf schemas in `core/solchat_protocol/proto/`
3. Run tests: `cargo test --all`
4. Test integration: `cargo test -p solchat_relay --test integration_tests`
5. Update mobile app in `apps/solchat_mobile/`
6. Test with local relay server and check metrics
7. Deploy to devnet using k3d cluster

---

*Built with ❤️ for the Solana ecosystem*
