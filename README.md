# SolConnect

A secure, decentralized messaging application built on Solana blockchain with end-to-end encryption.

## Features

- 🔐 **End-to-End Encryption**: Messages are encrypted using state-of-the-art cryptography
- 🌐 **Web & Mobile**: Cross-platform support with React Native and Next.js
- ⚡ **Real-time Messaging**: WebSocket-based relay for instant message delivery
- 🎯 **Solana Integration**: Built on Solana blockchain for decentralized identity
- 🎨 **Modern UI**: Beautiful, responsive design with glass morphism effects

## Architecture

```
SolConnect/
├── apps/
│   └── solchat_mobile/     # React Native mobile app
├── core/
│   └── solchat_protocol/   # Core protocol implementation (Rust)
├── SolConnectApp/          # Next.js web application
├── relay/                  # WebSocket relay server
└── mobile/                 # Mobile SDK
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- Rust (for core protocol)
- Solana CLI tools
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/micahoates/SolConnect.git
   cd SolConnect
   ```

2. **Install dependencies**
   ```bash
   # Install Rust dependencies
   cargo build
   
   # Install Node.js dependencies
   cd SolConnectApp
   npm install
   ```

3. **Start the development environment**
   ```bash
   # Terminal 1: Start Solana test validator
   solana-test-validator --reset
   
   # Terminal 2: Start WebSocket relay
   cd SolConnectApp
   node relay.js
   
   # Terminal 3: Start Next.js development server
   cd SolConnectApp
   npm run dev
   ```

4. **Access the application**
   - Web app: http://localhost:3000
   - Relay server: ws://localhost:8080
   - Solana RPC: http://127.0.0.1:8899

## Development

### Project Structure

- **`SolConnectApp/`**: Next.js web application
  - `pages/`: Next.js routing
  - `src/screens/`: React components
  - `src/components/`: Reusable UI components
  - `relay.ts`: WebSocket relay server

- **`core/solchat_protocol/`**: Rust protocol implementation
  - `src/`: Core protocol logic
  - `proto/`: Protocol buffer definitions

- **`mobile/`**: React Native mobile application
  - `app/`: Mobile app screens
  - `solchat_sdk/`: Mobile SDK

### Available Scripts

```bash
# Web Development
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run start        # Start production server

# Mobile Development
npm run android      # Start Android development
npm run ios          # Start iOS development
npm run mobile       # Start mobile development client

# Testing
npm run test         # Run tests
npm run tsc          # TypeScript type checking
npm run lint         # ESLint checking

# Relay Server
npm run relay        # Start WebSocket relay server
```

## Security

SolConnect implements several security measures:

- **End-to-End Encryption**: All messages are encrypted using X25519 key exchange and ChaCha20-Poly1305
- **Decentralized Identity**: User identities are tied to Solana wallet addresses
- **No Server Storage**: Messages are not stored on servers, only relayed
- **Forward Secrecy**: Each session uses unique encryption keys

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 Issues: [GitHub Issues](https://github.com/micahoates/SolConnect/issues)

## Roadmap

- [ ] Group chat functionality
- [ ] File sharing with encryption
- [ ] Voice and video calls
- [ ] Cross-chain messaging
- [ ] Mobile app store releases
- [ ] Advanced privacy features

---

Built with ❤️ by the SolConnect team 