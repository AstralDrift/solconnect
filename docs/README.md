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
- Rust 1.70+ with Android/iOS targets
- Node.js 18+
- Expo CLI
- Android Studio / Xcode (for mobile development)
- k3d (for local devnet)

### Build & Test

```bash
# Install Rust targets for mobile
rustup target add aarch64-apple-ios aarch64-linux-android armv7-linux-androideabi

# Build and test all Rust components
cargo build --all
cargo test --all

# Set up mobile app
cd apps/solchat_mobile
npm install
npm run type-check

# Run mobile app (requires Expo dev tools)
npm start
```

### Run Local DevNet

```bash
# Start k3d cluster for testing
k3d cluster create solconnect-devnet --config infra/devnet-k3d.yaml

# Build and run relay server
cargo run -p solchat_relay -- --listen 0.0.0.0:4433 --devnet

# In another terminal, test the mobile app
cd apps/solchat_mobile && npm run android
```

## Project Structure

- `core/solchat_protocol/` - Core messaging protocol and encryption
- `relay/solchat_relay/` - QUIC-based message relay server  
- `mobile/solchat_sdk/` - Rust SDK with FFI bindings for mobile
- `apps/solchat_mobile/` - React Native mobile application
- `infra/` - Kubernetes and deployment configurations
- `docs/` - Architecture Decision Records and documentation

## Key Features

- **Wallet-Only Identity**: No separate accounts - your Solana wallet IS your identity
- **End-to-End Encryption**: Double ratchet protocol with forward secrecy
- **Hardware Security**: Solana Mobile Seed Vault integration for key operations
- **QUIC Protocol**: Low-latency, mobile-optimized transport layer
- **Cross-Platform**: iOS and Android via React Native + Rust FFI
- **Devnet Ready**: Easy local development with k3d + Kubernetes

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
2. Run tests: `cargo test --all`
3. Update mobile app in `apps/solchat_mobile/`
4. Test integration with local relay server
5. Deploy to devnet using k3d cluster

---

*Built with ❤️ for the Solana ecosystem* 