# Claude Code Integration Guide for SolConnect

## Project Overview

SolConnect is a decentralized, end-to-end encrypted messaging application built on the Solana blockchain. It provides secure peer-to-peer communication with wallet-based identity verification, supporting both web (Next.js) and mobile (React Native) platforms.

### Key Technologies
- **Frontend**: Next.js 14, React 18, React Native, TypeScript
- **Backend**: Rust (core protocol), Node.js (WebSocket relay)
- **Blockchain**: Solana Web3.js, Anchor Framework
- **Encryption**: ChaCha20-Poly1305, X25519 key exchange
- **Testing**: Jest, React Testing Library
- **Styling**: Tailwind CSS, Glass morphism design

## Architecture Overview

```
SolConnect/
├── apps/solchat_mobile/     # React Native mobile application
├── core/solchat_protocol/   # Rust protocol implementation
├── SolConnectApp/           # Next.js web application (main app)
├── relay/solchat_relay/     # Rust WebSocket relay server
├── mobile/solchat_sdk/      # Mobile SDK (Rust + FFI)
└── docs/                    # Architecture Decision Records (ADRs)
```

### Core Components

1. **SolConnect SDK** (`SolConnectApp/src/services/SolConnectSDK.ts`)
   - Main API for messaging operations
   - Manages wallet connections and chat sessions
   - Handles encryption/decryption

2. **Message Bus** (`SolConnectApp/src/services/MessageBus.ts`)
   - Coordinates message flow between components
   - Manages queuing and retry logic

3. **WebSocket Relay** (`SolConnectApp/relay.js`)
   - Real-time message broadcasting
   - Connection management

4. **Protocol Layer** (`core/solchat_protocol/`)
   - Rust implementation of core messaging protocol
   - Protocol buffer definitions

## Key Conventions and Patterns

### Code Organization

#### TypeScript/JavaScript
- **Components**: React components in `src/components/`
- **Screens**: Page-level components in `src/screens/`
- **Services**: Business logic in `src/services/`
- **Types**: TypeScript interfaces in `src/types/`
- **Hooks**: Custom React hooks in `src/hooks/`
- **Store**: Redux state management in `src/store/`

#### Rust
- **Workspace**: Multi-crate workspace structure
- **Protocol**: Core protocol in `core/solchat_protocol/`
- **Relay**: WebSocket server in `relay/solchat_relay/`
- **SDK**: Mobile SDK in `mobile/solchat_sdk/`

### Naming Conventions

#### TypeScript/React
```typescript
// Components: PascalCase
export const MessageBubble: React.FC<Props> = () => {}

// Hooks: camelCase with 'use' prefix
export const useSolConnect = () => {}

// Types/Interfaces: PascalCase
interface ChatSession {
  sessionId: string;
  peerWallet: string;
}

// Constants: UPPER_SNAKE_CASE
const MAX_MESSAGE_SIZE = 10240;

// Functions: camelCase
async function sendMessage(text: string) {}
```

#### Rust
```rust
// Modules: snake_case
mod crypto;

// Structs/Enums: PascalCase
struct MessageHandler;
enum MessageType { Chat, Ack }

// Functions: snake_case
fn handle_message() {}

// Constants: UPPER_SNAKE_CASE
const MAX_BUFFER_SIZE: usize = 1024;
```

### Error Handling

#### TypeScript - Enhanced Error System
```typescript
// Use Result<T> pattern with enhanced error types
type Result<T> = { success: true; data: T } | { success: false; error: SolConnectError };

// Error categories and recovery strategies
enum ErrorCategory { NETWORK, CRYPTO, VALIDATION, AUTH, SYSTEM }

// Enhanced error factory methods
const error = ErrorFactory.walletConnectionFailed(
  'Extension not available',
  originalError,
  { walletType: 'phantom', timestamp: Date.now() }
);

// Error recovery patterns
if (!result.success) {
  const error = result.error;
  
  // Check recovery strategy
  switch (error.getRecoveryStrategy()) {
    case 'retry':
      // Automatic retry with exponential backoff
      break;
    case 'manual':
      // User action required
      showUserPrompt(error.userMessage);
      break;
    case 'none':
      // Fatal error
      logFatalError(error);
      break;
  }
  
  // Access error chain for debugging
  const errorChain = error.getErrorChain();
  errorChain.forEach(err => console.log(err.message));
}

// Retry utilities
const retryUtility = RetryUtility.forNetworkOperations();
const result = await retryUtility.execute(
  async () => await sdk.sendMessage(sessionId, text),
  {
    onRetry: (error, attempt) => console.log(`Retry ${attempt}: ${error.message}`),
    shouldRetry: (error) => error.recoverable
  }
);

// Circuit breaker pattern
const circuitBreaker = CircuitBreaker.forNetworkOperations();
const result = await circuitBreaker.execute(async () => {
  return await messageBus.sendMessage(session, plaintext);
});
```

#### Rust - Standard Error Handling
```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum SolChatError {
    #[error("Protocol error: {0}")]
    Protocol(String),
    #[error("Network error: {0}")]
    Network(#[from] std::io::Error),
}
```

### State Management

- **Redux Toolkit**: Used for global state management
- **Slices**: Organized by feature (auth, messages, rooms)
- **React Context**: Used for theme and local UI state

### Testing Patterns

#### Unit Tests
```typescript
// Component tests
describe('MessageBubble', () => {
  it('should render message content', () => {
    const { getByText } = render(<MessageBubble message="Hello" />);
    expect(getByText('Hello')).toBeInTheDocument();
  });
});

// Service tests with mocks
jest.mock('@/services/transport/MessageTransport');
```

#### Integration Tests
```typescript
// End-to-end message flow tests
it('should send and receive encrypted messages', async () => {
  const sdk = new SolConnectSDK();
  await sdk.initialize();
  // ... test implementation
});
```

## Common Tasks and Workflows

### Development Setup

1. **Install Dependencies**
   ```bash
   # Rust toolchain
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Node.js dependencies
   cd SolConnectApp && npm install
   
   # Build Rust components
   cargo build --workspace
   ```

2. **Start Development Environment**
   ```bash
   # Terminal 1: Solana validator
   solana-test-validator --reset
   
   # Terminal 2: WebSocket relay
   cd SolConnectApp && npm run relay
   
   # Terminal 3: Next.js dev server
   cd SolConnectApp && npm run dev
   ```

### Adding New Features

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Add React Component**
   - Create component in `src/components/`
   - Add tests in `src/components/__tests__/`
   - Update exports in component index

3. **Add Service Logic**
   - Implement in `src/services/`
   - Follow Result<T> pattern for errors
   - Add unit tests

4. **Update Types**
   - Add interfaces to `src/types/`
   - Update relevant store slices

### Debugging

1. **Enable Debug Logging**
   ```typescript
   // In browser console
   localStorage.setItem('DEBUG', 'solconnect:*');
   ```

2. **Monitor WebSocket Traffic**
   - Browser DevTools → Network → WS tab
   - Check relay server logs

3. **Inspect Redux State**
   - Use Redux DevTools Extension
   - Check action dispatches

### Performance Optimization

1. **React Component Optimization**
   ```typescript
   // Use React.memo for expensive components
   export const MessageList = React.memo(({ messages }) => {
     // Component implementation
   });
   
   // Use useMemo for expensive computations
   const sortedMessages = useMemo(() => 
     messages.sort((a, b) => a.timestamp - b.timestamp),
     [messages]
   );
   ```

2. **Message Batching**
   - Messages are batched in 100ms windows
   - Reduces WebSocket overhead

## Testing Procedures

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test MessageBubble.test.tsx

# Run Rust tests
cargo test --workspace
```

### Test Categories

1. **Unit Tests** (`*.test.ts`, `*.test.tsx`)
   - Component rendering
   - Service logic
   - Utility functions

2. **Integration Tests** (`*.integration.test.ts`)
   - Message flow
   - Encryption/decryption
   - WebSocket communication

3. **E2E Tests** (planned)
   - Full user workflows
   - Cross-browser testing

### Writing Tests

#### Component Test Example
```typescript
import { render, fireEvent } from '@testing-library/react';
import { MessageInput } from '@/components/MessageInput';

describe('MessageInput', () => {
  it('should call onSend when Enter is pressed', () => {
    const onSend = jest.fn();
    const { getByRole } = render(<MessageInput onSend={onSend} />);
    
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 13 });
    
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
});
```

#### Service Test Example
```typescript
import { SolConnectSDK } from '@/services/SolConnectSDK';
import { MessageTransport } from '@/services/transport/MessageTransport';

jest.mock('@/services/transport/MessageTransport');

describe('SolConnectSDK', () => {
  it('should initialize transport on connect', async () => {
    const sdk = new SolConnectSDK();
    const result = await sdk.initialize();
    
    expect(result.success).toBe(true);
    expect(MessageTransport).toHaveBeenCalled();
  });
});
```

## Deployment

### Development
```bash
# Local development
npm run dev

# Mobile development
npm run mobile
```

### Production
```bash
# Build for production
npm run build

# Run production server
npm run start

# Docker deployment
docker build -t solconnect .
docker run -p 3000:3000 solconnect
```

## Security Considerations

1. **Never commit sensitive data**
   - Private keys
   - API secrets
   - User data

2. **Always validate input**
   - Sanitize user messages
   - Validate wallet addresses
   - Check message sizes

3. **Use secure dependencies**
   - Regular `npm audit`
   - Dependabot alerts
   - Lock file commits

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check relay server is running
   - Verify NEXT_PUBLIC_RELAY_URL
   - Check browser console for errors

2. **Wallet Connection Issues**
   - Ensure wallet extension installed
   - Check network (devnet/mainnet)
   - Clear browser storage

3. **Build Failures**
   - Clear `.next/` directory
   - Delete `node_modules/` and reinstall
   - Check Node.js version (≥18)

### Debug Commands

```bash
# Check Node version
node --version  # Should be ≥18

# Check Rust version
rustc --version  # Should be recent stable

# Clear all caches
rm -rf .next node_modules
npm install
npm run dev

# Check port availability
lsof -i :3000  # Web server
lsof -i :8080  # Relay server
```

## Contributing Guidelines

1. **Code Style**
   - Run `npm run lint` before committing
   - Follow existing patterns
   - Add JSDoc comments for public APIs

2. **Commit Messages**
   - Use conventional commits
   - Format: `type(scope): description`
   - Examples:
     - `feat(chat): add message reactions`
     - `fix(relay): handle reconnection`
     - `docs(readme): update setup instructions`

3. **Pull Requests**
   - Create from feature branches
   - Include tests for new features
   - Update documentation
   - Request review from team

## Resources

- [Project README](./README.md)
- [Technical Specification](./SolConnectApp/SPEC.md)
- [Architecture Decision Records](./docs/)
- [Solana Documentation](https://docs.solana.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Native Documentation](https://reactnative.dev)

## Contact

For questions or support:
- GitHub Issues: [Project Issues](https://github.com/yourusername/solconnect/issues)
- Team Discord: [Join Discord](https://discord.gg/solconnect)