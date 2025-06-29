# SolConnect

A secure, decentralized messaging application built on Solana blockchain with end-to-end encryption.

> 🤖 **AI-Powered Development**: SolConnect features a revolutionary **Universal AI Agent Heaven** framework with self-improving documentation, intelligent code assistance, and cross-LLM compatibility. [**Get Started with AI Agents →**](docs/AI_AGENT_GUIDE.md)

## Features

### 💬 **Core Messaging**
- 🔐 **End-to-End Encryption**: Messages are encrypted using state-of-the-art cryptography
- 🌐 **Web & Mobile**: Cross-platform support with React Native and Next.js
- ⚡ **Real-time Messaging**: WebSocket-based relay for instant message delivery
- 🎯 **Solana Integration**: Built on Solana blockchain for decentralized identity
- 🎨 **Modern UI**: Beautiful, responsive design with glass morphism effects

### 🤖 **AI Agent Heaven Framework**
- 🌍 **Universal AI Support**: Works with Claude, GPT-4, Gemini Pro, and local models
- 🧬 **Self-Improving Systems**: Documentation and patterns that evolve with the codebase
- 🎯 **Agent Specialization**: Specialized agents for crypto, UI, storage, and network development
- 📚 **Living Documentation**: Architecture diagrams and guides that stay current automatically
- 🔄 **Cross-Agent Learning**: Knowledge sharing between different AI platforms

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

### 🤖 AI Agent Quick Start

**New to AI-assisted development?** SolConnect's AI Agent Heaven framework can dramatically accelerate your development:

```bash
# Setup AI agent system (choose your platform)
./ai-agent-heaven-universal/setup.sh --platform claude    # For Claude/Cursor
./ai-agent-heaven-universal/setup.sh --platform gpt4     # For GPT-4/ChatGPT
./ai-agent-heaven-universal/setup.sh --platform gemini   # For Gemini Pro
./ai-agent-heaven-universal/setup.sh --platform local    # For local models

# Get intelligent assistance
./ai-agent-heaven-universal/agent --feature "Add message reactions"
./ai-agent-heaven-universal/agent --debug "WebSocket connection issues"
./ai-agent-heaven-universal/agent --analyze "src/services/crypto/"
```

**📚 AI Agent Documentation:**
- [**AI Agent Guide**](docs/AI_AGENT_GUIDE.md) - Start here for AI-powered development
- [**Setup Instructions**](docs/AI_AGENT_SETUP.md) - Platform-specific configuration
- [**Self-Improving Systems**](docs/SELF_IMPROVING_SYSTEMS.md) - How the living documentation works

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

### 🤖 AI-Powered Contributing

**Recommended**: Use SolConnect's AI Agent system for faster, higher-quality contributions:

1. **Setup AI Agent**: Follow the [AI Agent Setup Guide](docs/AI_AGENT_SETUP.md)
2. **Choose Specialization**: Pick crypto, UI, storage, or network focus
3. **AI-Assisted Development**: Use intelligent code assistance and pattern recognition
4. **Leverage Self-Improving Systems**: Benefit from evolved patterns and living documentation

### 📋 Standard Contributing Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. **Leverage AI agents** for development and testing
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### 📚 Development Resources

- [**AI Agent Guide**](docs/AI_AGENT_GUIDE.md) - AI-powered development introduction
- [**Developer Workflows**](docs/DEVELOPER_WORKFLOWS.md) - AI-integrated development processes  
- [**Intelligence Systems**](docs/INTELLIGENCE_SYSTEMS.md) - Advanced AI features
- [**CLAUDE.md**](CLAUDE.md) - Comprehensive development guide

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