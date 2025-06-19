# SolConnect Technical Specification

## Overview

SolConnect is a decentralized, end-to-end encrypted messaging application built on the Solana blockchain. It provides secure peer-to-peer communication with wallet-based identity verification.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Web App (Next.js)  │  Mobile App (React Native)           │
├─────────────────────────────────────────────────────────────┤
│                    SolConnect SDK (TypeScript)              │
├─────────────────────────────────────────────────────────────┤
│  Message Bus  │  Protocol Handler  │  Transport Layer       │
├─────────────────────────────────────────────────────────────┤
│                    WebSocket Relay Server                    │
├─────────────────────────────────────────────────────────────┤
│                    Solana Blockchain                         │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **SolConnect SDK** (`src/services/SolConnectSDK.ts`)
- Main entry point for all messaging operations
- Manages wallet connections and chat sessions
- Handles message encryption/decryption
- Provides unified API for frontend applications

#### 2. **Message Bus** (`src/services/MessageBus.ts`)
- Coordinates message flow between components
- Manages message queuing and retry logic
- Handles transport selection and failover
- Implements encryption/decryption pipeline

#### 3. **Transport Layer** (`src/services/transport/MessageTransport.ts`)
- Abstract transport interface for message delivery
- WebSocket implementation for real-time messaging
- QUIC transport (planned) for improved performance
- Connection management and reconnection logic

#### 4. **Protocol Handler** (`src/services/protocol/MessageHandler.ts`)
- Implements message protocol specification
- Handles message types: chat, ack, ping/pong
- Manages message acknowledgments and retries
- Tracks connection quality metrics

#### 5. **Error System** (`src/types/errors.ts`)
- Unified error handling across all layers
- User-friendly error messages
- Error recovery mechanisms
- Comprehensive error categorization

## Message Flow

### Sending Messages
1. User composes message in UI
2. SDK validates and prepares message
3. Message Bus applies encryption (if enabled)
4. Protocol Handler formats message
5. Transport Layer sends via WebSocket
6. Relay server broadcasts to recipient
7. Acknowledgment flows back through stack

### Receiving Messages
1. Transport Layer receives from WebSocket
2. Protocol Handler validates format
3. Message Bus decrypts (if encrypted)
4. SDK delivers to UI handler
5. UI updates with new message
6. Acknowledgment sent to sender

## Security Model

### Encryption
- **Algorithm**: ChaCha20-Poly1305
- **Key Exchange**: X25519 (planned)
- **Key Derivation**: HKDF with session-specific salt
- **Forward Secrecy**: Per-session ephemeral keys

### Authentication
- **Identity**: Solana wallet address
- **Verification**: Signature-based authentication
- **Session Management**: JWT tokens (planned)

## Data Models

### Core Types

```typescript
interface ChatSession {
  session_id: string;
  peer_wallet: string;
  sharedKey: Uint8Array;
}

interface Message {
  sender_wallet: string;
  ciphertext: string;
  timestamp: string;
  session_id?: string;
}

interface DeliveryReceipt {
  messageId: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'failed';
}
```

## Network Protocol

### WebSocket Messages
```json
{
  "type": "chat|ack|ping|pong",
  "roomId": "session_id",
  "message": "encrypted_content",
  "sender": "wallet_address",
  "timestamp": "ISO8601",
  "messageId": "unique_id"
}
```

### Connection Quality
- **Excellent**: < 50ms RTT
- **Good**: < 100ms RTT  
- **Fair**: < 200ms RTT
- **Poor**: < 500ms RTT
- **Unusable**: >= 500ms RTT

## Configuration

### Environment Variables
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Solana RPC endpoint
- `NEXT_PUBLIC_RELAY_URL`: WebSocket relay server URL
- `NODE_ENV`: development | production

### SDK Configuration
```typescript
interface SDKConfig {
  relayEndpoint: string;
  solanaRpcUrl?: string;
  networkType?: 'devnet' | 'mainnet' | 'testnet';
  enableLogging?: boolean;
}
```

## Performance Considerations

### Message Size Limits
- Maximum message size: 10KB
- Maximum attachment size: 5MB (planned)
- Rate limiting: 60 messages/minute

### Connection Management
- Automatic reconnection with exponential backoff
- Connection pooling for multiple sessions
- Heartbeat interval: 30 seconds

## Testing Strategy

### Unit Tests
- Component isolation with mocks
- Error scenario coverage
- Protocol compliance validation

### Integration Tests
- End-to-end message flow
- Network failure scenarios
- Encryption/decryption verification

### Performance Tests
- Message throughput benchmarks
- Connection stability under load
- Memory usage profiling

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic messaging functionality
- ✅ WebSocket transport
- ✅ Error handling system
- ⏳ Complete encryption implementation

### Phase 2 (Next)
- 🔲 QUIC transport implementation
- 🔲 Group chat support
- 🔲 Message persistence
- 🔲 File sharing

### Phase 3 (Future)
- 🔲 Voice/video calls
- 🔲 Cross-chain messaging
- 🔲 Decentralized relay network
- 🔲 Smart contract integration

## API Reference

### SDK Methods

```typescript
// Initialize SDK
await sdk.initialize(): Promise<Result<void>>

// Wallet operations
await sdk.connectWallet(): Promise<Result<WalletInfo>>
await sdk.disconnectWallet(): Promise<Result<void>>

// Session management
await sdk.startSession(config: SessionConfig): Promise<Result<ChatSession>>
await sdk.endSession(sessionId: string): Promise<Result<void>>

// Messaging
await sdk.sendMessage(sessionId: string, text: string): Promise<Result<DeliveryReceipt>>
sdk.subscribeToMessages(sessionId: string, handler: MessageHandler): Result<Subscription>
```

## Deployment

### Development
```bash
npm run dev          # Start development server
npm run relay        # Start relay server
npm run test         # Run test suite
```

### Production
```bash
npm run build        # Build for production
npm run start        # Start production server
```

### Docker
```dockerfile
# Development container
docker-compose -f docker-compose.dev.yml up

# Production deployment
docker build -t solconnect .
docker run -p 3000:3000 solconnect
```

## Monitoring

### Metrics
- Message delivery rate
- Average latency
- Connection uptime
- Error rates by category

### Logging
- Structured JSON logging
- Log levels: debug, info, warn, error
- Correlation IDs for request tracking

## Compliance & Privacy

### Data Handling
- No message storage on servers
- End-to-end encryption by default
- Minimal metadata collection
- GDPR compliance considerations

### Security Audits
- Regular dependency updates
- Automated vulnerability scanning
- Penetration testing (planned)
- Code security reviews 