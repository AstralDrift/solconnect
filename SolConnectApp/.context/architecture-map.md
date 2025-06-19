# SolConnect Architecture Map

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Next.js Pages  │  React Screens  │  Components  │  Hooks   │
├─────────────────────────────────────────────────────────────┤
│                    SolConnect SDK Layer                      │
├─────────────────────────────────────────────────────────────┤
│  MessageBus  │  Storage  │  Protocol  │  Transport  │ Crypto │
├─────────────────────────────────────────────────────────────┤
│              Infrastructure Layer (External)                 │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Relay  │  Solana RPC  │  Local Storage  │  Rust  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Key Directories

### `/src/services/` - Core Business Logic
```
services/
├── SolConnectSDK.ts      # Main SDK entry point
├── MessageBus.ts         # Message coordination
├── storage/
│   └── MessageStorage.ts # Persistence layer
├── transport/
│   └── MessageTransport.ts # Network abstractions
└── protocol/
    ├── MessageHandler.ts  # Protocol implementation
    └── ProtocolBuffers.ts # Message formats
```

### `/src/screens/` - UI Screens
```
screens/
├── LoginScreen.tsx       # Wallet connection
├── ChatListScreen.tsx    # Chat list view
├── ChatThreadScreen.tsx  # Message thread
└── SettingsScreen.tsx    # Storage management
```

### `/src/components/` - Reusable UI
```
components/
├── ErrorBoundary.tsx     # Error handling
├── Toast.tsx            # Notifications
├── MessageBubble.tsx    # Message display
└── TypingIndicator.tsx  # UI feedback
```

## 🔄 Data Flow

### Sending Messages
```
User Input
    ↓
ChatThreadScreen
    ↓
SolConnectSDK.sendMessage()
    ↓
MessageBus.sendMessage()
    ↓
[Encryption] → MessageStorage.storeMessage()
    ↓
Transport.send()
    ↓
WebSocket Relay
```

### Receiving Messages
```
WebSocket Relay
    ↓
Transport.onMessage()
    ↓
MessageHandler.processMessage()
    ↓
MessageBus (decrypt)
    ↓
MessageStorage.storeMessage()
    ↓
SDK subscription callback
    ↓
UI Update
```

## 🔑 Key Interfaces

### Core Types (`/src/types/`)
```typescript
interface Message {
  sender_wallet: string;
  ciphertext: string;
  timestamp: string;
  session_id?: string;
}

interface ChatSession {
  session_id: string;
  peer_wallet: string;
  sharedKey: Uint8Array;
}

interface Result<T> {
  success: boolean;
  data?: T;
  error?: SolConnectError;
}
```

## 🎯 Entry Points

### Web Application
- **Dev Server**: `pages/_app.js` → `npm run dev`
- **Production**: `next build && next start`

### SDK Initialization
```typescript
const sdk = await initializeSDK({
  relayEndpoint: 'ws://localhost:8080',
  enableLogging: true
});
```

### Message Bus
```typescript
const bus = await initializeMessageBus({
  relayEndpoint: 'ws://localhost:8080',
  enablePersistence: true
});
```

## 🔌 External Dependencies

### Critical
- `next`: Web framework
- `react`: UI library
- `@solana/web3.js`: Blockchain integration
- `ws`: WebSocket client/server

### Storage
- `localStorage`: Web persistence
- `@react-native-async-storage`: Mobile persistence

### Security
- `tweetnacl`: Cryptography (temporary)
- Future: `@noble/curves` for production crypto

## 🚀 Quick Commands

```bash
# Development
npm run dev          # Start web app
npm run relay        # Start relay server

# Quality
npm run tsc          # Type check
npm run lint         # Lint code
npm audit           # Security check

# Testing
npm test            # Run tests
```

## 🔧 Configuration

### Environment Variables
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Solana endpoint
- `NEXT_PUBLIC_RELAY_URL`: WebSocket relay URL
- `NODE_ENV`: development/production

### Key Files
- `package.json`: Dependencies and scripts
- `next.config.js`: Next.js configuration
- `tsconfig.json`: TypeScript configuration
- `relay.js`: WebSocket relay server

## 🎨 UI Routes

- `/` → Login screen
- `/chats` → Chat list
- `/thread/:peerId` → Chat thread
- `/settings` → Settings & storage

## 📊 State Management

### Global State (Zustand)
- Auth state: `store/slices/auth.ts`
- Messages: `store/slices/messages.ts`
- Rooms: `store/slices/rooms.ts`

### Local State (React)
- UI state in components
- Form inputs
- Loading states

## 🔒 Security Layers

1. **Transport**: TLS/WSS (production)
2. **Application**: End-to-end encryption
3. **Storage**: Local encryption (planned)
4. **Identity**: Solana wallet signatures 