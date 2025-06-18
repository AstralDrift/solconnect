# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Web Application (SolConnectApp/)
```bash
# Development
npm run dev          # Start Next.js development server on http://localhost:3000
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # ESLint checking
npm run tsc          # TypeScript type checking
npm run test         # Run Jest tests

# Relay Server
npm run relay        # Start WebSocket relay server on ws://localhost:8080
node relay.js        # Alternative relay server start (JS version)
```

### Rust Components
```bash
# Build all workspace members
cargo build

# Run tests
cargo test
cargo test --all      # Test all workspace components

# Specific components
cd core/solchat_protocol && cargo build
cd relay/solchat_relay && cargo run
cd mobile/solchat_sdk && cargo build --target aarch64-linux-android
```

### Mobile Development
```bash
cd apps/solchat_mobile
npm install
npm start            # Start Expo development server
npm run android      # Run on Android
npm run ios          # Run on iOS
```

### Development Environment Setup
```bash
# Terminal 1: Start Solana test validator
solana-test-validator --reset

# Terminal 2: Start WebSocket relay
cd SolConnectApp && npm run relay

# Terminal 3: Start web application
cd SolConnectApp && npm run dev
```

## Architecture Overview

SolConnect is a decentralized messaging application built on Solana with a multi-platform architecture:

### Core Components
- **`core/solchat_protocol/`**: Rust-based protocol implementation with Protocol Buffers for message serialization
- **`SolConnectApp/`**: Next.js web application with React components and WebSocket integration
- **`apps/solchat_mobile/`**: React Native mobile application
- **`relay/solchat_relay/`**: Rust WebSocket relay server for message routing
- **`mobile/solchat_sdk/`**: Mobile SDK with FFI bindings for React Native

### Key Technologies
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Mobile**: React Native, Expo
- **Backend**: Rust, WebSocket (via `ws` library for dev relay)
- **Cryptography**: X25519 key exchange, ChaCha20-Poly1305 encryption via `tweetnacl`
- **Blockchain**: Solana Web3.js for wallet integration
- **Serialization**: Protocol Buffers for efficient message format

### Message Protocol
The application uses Protocol Buffers with two main message types:
- `ChatMessage`: Encrypted messages with metadata (ID, sender/recipient wallets, timestamp, TTL, signature)
- `AckMessage`: Delivery acknowledgments with status (DELIVERED, FAILED, EXPIRED, REJECTED)

### Cryptographic Design
- Wallet-based identity: Solana wallet addresses serve as user identities
- End-to-end encryption using X25519 key derivation from Ed25519 wallet keys
- Double ratchet protocol implementation for forward secrecy
- Hardware security integration via Solana Mobile Seed Vault

### Development Patterns
- TypeScript throughout with strict type checking
- Redux Toolkit for state management (`src/store/`)
- Component-based architecture with reusable UI components
- WebSocket real-time communication with room-based message routing
- Cross-platform compatibility between web and mobile using shared SDK logic

### Project Structure
```
SolConnect/
├── SolConnectApp/          # Next.js web app (main development focus)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── screens/        # Page-level components
│   │   ├── store/          # Redux state management
│   │   └── types/          # TypeScript type definitions
│   ├── pages/              # Next.js routing
│   └── relay.ts            # Development WebSocket relay
├── core/solchat_protocol/  # Rust protocol implementation
├── apps/solchat_mobile/    # React Native mobile app
├── relay/solchat_relay/    # Production Rust relay server
└── mobile/solchat_sdk/     # Mobile SDK with FFI
```

## Performance Considerations
The project includes compute unit (CU) profiling for Solana operations. Profile scripts are available in `SolConnectApp/scripts/` for monitoring on-chain performance.