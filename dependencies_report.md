# SolConnect Dependencies Report

## Overview
SolConnect is a multi-platform decentralized messaging application with components in Rust, TypeScript/JavaScript, and deployment infrastructure. This report catalogues all dependencies found across the repository.

## Language Runtimes

### Node.js (JavaScript/TypeScript)
- **Required Version**: Node.js 18+ (inferred from package.json engines and modern dependencies)
- **Package Manager**: npm (package-lock.json files present, no yarn.lock in project roots)
- **Projects**: 5 distinct Node.js projects

### Rust
- **Required Version**: Rust 1.81.0+ (specified in Dockerfile)
- **Package Manager**: Cargo
- **Workspace Structure**: 4 Cargo.toml files (1 workspace root, 3 sub-projects)

## OS-Level Dependencies

### System Packages (from Dockerfiles)
- **libssl-dev**: OpenSSL development libraries
- **clang**: C language family frontend for LLVM  
- **cmake**: Cross-platform build system
- **pkg-config**: Package configuration system
- **protobuf-compiler**: Protocol Buffers compiler

### Development Tools
- **Docker**: Container runtime (Dockerfile and Dockerfile.dev present)
- **k3d**: Kubernetes in Docker (devnet-k3d.yaml configuration)
- **kubectl**: Kubernetes CLI (implied by k3d usage)
- **Solana CLI**: Blockchain development tools (referenced in scripts)

## Node.js Dependencies by Project

### 1. SolConnectApp (Main Web Application)
**Location**: `/SolConnectApp/package.json`
**Type**: Next.js + Expo hybrid application
**Key Dependencies**:
- next: 14.1.0
- react: 18.2.0
- expo: ~53.0.10
- @solana/web3.js: ^1.95.1
- tweetnacl: ^1.0.3 (cryptography)
- ws: ^8.18.2 (WebSocket server)

### 2. Mobile Application 
**Location**: `/apps/solchat_mobile/package.json`
**Type**: React Native with Expo
**Key Dependencies**:
- expo: ~49.0.15
- react-native: 0.72.6
- @solana-mobile/mobile-wallet-adapter-protocol: ^2.0.0
- @solana/web3.js: ^1.87.6

### 3. Encrypted Chat Module
**Location**: `/encrypted-chat/package.json`
**Type**: Expo Router application
**Key Dependencies**:
- expo: ~53.0.10
- react: 19.0.0
- react-native: 0.79.3
- expo-crypto: ~14.1.5

### 4. Mobile Demo
**Location**: `/mobile/app/package.json`
**Type**: React Native with Webpack
**Key Dependencies**:
- react-native: 0.72.6
- @solana/web3.js: ^1.87.6
- webpack: ^5.89.0

## Rust Dependencies by Project

### 1. Core Protocol (`core/solchat_protocol`)
**Purpose**: Core messaging protocol implementation
**Key Dependencies**:
- Cryptography: ed25519-dalek, x25519-dalek, aes-gcm, hkdf
- Serialization: prost (Protocol Buffers), serde_json
- Utilities: uuid, bs58

### 2. Relay Server (`relay/solchat_relay`)
**Purpose**: QUIC-based message relay server
**Key Dependencies**:
- Network: quinn (QUIC), hyper (HTTP server)
- Metrics: prometheus
- Async: tokio
- CLI: clap

### 3. Mobile SDK (`mobile/solchat_sdk`)
**Purpose**: Mobile FFI bindings
**Key Dependencies**:
- Core protocol (internal dependency)
- Cryptography: Same as core protocol
- FFI: cdylib, staticlib crate types

### 4. Workspace Root (`Cargo.toml`)
**Purpose**: Workspace coordination
**Shared Dependencies**:
- tokio: 1.0 (async runtime)
- serde: 1.0 (serialization)
- prost: 0.12 (Protocol Buffers)
- quinn: 0.10 (QUIC protocol)

## Configuration Files

### Environment Configuration
- **No .env files found** (environment variables managed externally)
- Default configurations in scripts (e.g., `SOLANA_RPC_URL=https://api.devnet.solana.com`)

### Build Configuration
- **TypeScript**: 4 tsconfig.json files across projects
- **Next.js**: 2 next.config.js files
- **Expo**: 4 app.json files for mobile apps
- **Webpack**: 1 webpack.config.js for web builds
- **ESLint**: 2 eslint.config.js files
- **Tailwind**: 1 tailwind.config.js
- **Babel**: Multiple babel.config.js files

### Infrastructure
- **Kubernetes**: devnet-k3d.yaml for development cluster
- **Docker**: Dockerfile (production) and Dockerfile.dev (development)

## Development Scripts

### Setup Scripts
- `SolConnectApp/demo.sh`: Complete demo environment setup
- `SolConnectApp/scripts/profile.sh`: Performance profiling

### Package Scripts (from package.json)
**Common across projects**:
- `dev`/`start`: Development servers
- `build`: Production builds  
- `lint`: Code linting
- `test`: Test execution
- `android`/`ios`: Mobile platform builds

## Version Constraints Summary

### Critical Version Requirements
- **Rust**: >=1.81.0 (from Dockerfile)
- **Node.js**: >=18.0.0 (inferred from modern dependencies)
- **React**: 18.2.0 - 19.0.0 (varies by project)
- **React Native**: 0.72.6 - 0.79.3 (varies by project)
- **Expo SDK**: 49 - 53 (varies by project)
- **Solana Web3.js**: 1.87.6 - 1.95.1 (varies by project)

### Development Tools
- **uniffi-cli**: 0.29.2 (for Rust FFI bindings)
- **k3s**: v1.28.8-k3s1 (Kubernetes distribution)

## Lock Files Present
- **Cargo.lock**: Root workspace (pinned Rust dependencies)
- **package-lock.json**: 4 files (SolConnectApp, apps/solchat_mobile, encrypted-chat projects)
- **yarn.lock**: 1 file (mobile/app only)

## Special Considerations

### Mobile Development
- Requires Android Studio (Android development)
- Requires Xcode (iOS development)  
- Solana Mobile Stack integration
- Hardware security module support

### Blockchain Integration
- Solana CLI tools required
- Test validator for local development
- Devnet/Mainnet RPC access

### Containerization
- Multi-stage Docker builds
- Development and production variants
- Kubernetes deployment ready

### Performance Monitoring
- Compute unit profiling for Solana operations
- Prometheus metrics in relay server
- Custom profiling scripts