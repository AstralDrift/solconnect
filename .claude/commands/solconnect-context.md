# SolConnect Deep Context Priming

## Architecture Overview
RUN `eza SolConnectApp/src --tree --level 3`
RUN `eza core/solchat_protocol/src --tree --level 2`

## Core Service Analysis
READ @SolConnectApp/src/services/SolConnectSDK.ts
READ @SolConnectApp/src/services/MessageBus.ts  
READ @SolConnectApp/src/services/storage/MessageStorage.ts
READ @SolConnectApp/src/services/transport/MessageTransport.ts

## React Architecture
READ @SolConnectApp/src/components/MessageBubble.tsx
READ @SolConnectApp/src/store/slices/messagesSlice.ts
READ @SolConnectApp/src/hooks/useSolConnect.ts

## Protocol & Encryption
READ @core/solchat_protocol/src/lib.rs
READ @SolConnectApp/src/services/crypto/CryptoService.ts

## Testing Patterns
READ @SolConnectApp/src/services/__tests__/SolConnectSDK.test.ts
READ @SolConnectApp/src/components/__tests__/MessageBubble.test.tsx

## Key Context Points
- **Message Flow**: SolConnectSDK → MessageBus → MessageTransport → WebSocket Relay
- **Encryption**: End-to-end with ChaCha20-Poly1305, X25519 key exchange
- **Storage**: IndexedDB through MessageStorage service
- **State**: Redux with RTK, React hooks for components
- **Testing**: Jest + React Testing Library + mocked services
- **Solana**: Wallet-based identity, optional on-chain message audit
- **Mobile**: React Native compatibility maintained throughout