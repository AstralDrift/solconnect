# SolConnect Development Context

## Quick Start Guide for Developers

### Understanding the Codebase

SolConnect is a decentralized messaging app with a layered architecture. Here's what you need to know:

#### Key Directories
```
SolConnectApp/
├── src/
│   ├── services/          # Core SDK and business logic
│   │   ├── SolConnectSDK.ts    # Main SDK entry point
│   │   ├── MessageBus.ts       # Message coordination
│   │   ├── transport/          # Network layer
│   │   └── protocol/           # Message protocol
│   ├── screens/           # UI screens (React components)
│   ├── components/        # Reusable UI components
│   ├── hooks/            # React hooks for SDK integration
│   ├── types/            # TypeScript type definitions
│   └── store/            # Redux state management
├── pages/                # Next.js pages (routing)
├── relay.js             # WebSocket relay server
└── test/                # Test files
```

### Development Workflow

#### 1. Setting Up Your Environment
```bash
# Install dependencies
npm install

# Start local Solana validator (in terminal 1)
solana-test-validator --reset

# Start relay server (in terminal 2)
npm run relay

# Start development server (in terminal 3)
npm run dev
```

#### 2. Common Development Tasks

**Adding a New Feature:**
1. Start with the SDK layer (`src/services/`)
2. Add types to `src/types/`
3. Create/update React hooks in `src/hooks/`
4. Build UI components in `src/components/`
5. Wire up screens in `src/screens/`

**Testing Your Changes:**
```bash
# Run all tests
npm test

# Run specific test file
npm test -- SolConnectSDK.test.ts

# Run tests in watch mode
npm test -- --watch
```

**Checking Code Quality:**
```bash
# TypeScript type checking
npm run tsc

# ESLint
npm run lint

# Security audit
npm run security:check
```

### Architecture Decisions

#### Why This Structure?

1. **Layered Architecture**: Clear separation between UI, business logic, and network layers
2. **SDK Pattern**: All core functionality wrapped in a single SDK for easy integration
3. **Error Handling**: Unified error system with user-friendly messages
4. **Transport Abstraction**: Easy to swap between WebSocket, QUIC, or other transports

#### Key Design Patterns

1. **Result Type**: All async operations return `Result<T>` for consistent error handling
```typescript
const result = await sdk.sendMessage(sessionId, text);
if (result.success) {
  console.log('Sent:', result.data);
} else {
  console.error('Error:', result.error);
}
```

2. **Message Bus**: Central coordination point for all messaging operations
3. **Protocol Handler**: Manages message format and acknowledgments
4. **Transport Layer**: Abstract interface for different network protocols

### Common Pitfalls & Solutions

#### 1. WebSocket Connection Issues
**Problem**: "Failed to connect to relay server"
**Solution**: 
- Ensure relay server is running: `npm run relay`
- Check if port 8080 is available
- Verify WebSocket URL in environment

#### 2. TypeScript Errors
**Problem**: Type mismatches when adding new features
**Solution**:
- Always define types in `src/types/` first
- Use the `Result<T>` type for async operations
- Run `npm run tsc` frequently during development

#### 3. State Management
**Problem**: UI not updating after actions
**Solution**:
- Use the provided hooks (`useSolConnect`, `useSession`, `useMessages`)
- Don't bypass the SDK layer
- Check Redux DevTools for state updates

### Testing Guidelines

#### Unit Tests
- Test individual functions/methods
- Mock external dependencies
- Focus on edge cases and error scenarios

Example:
```typescript
describe('SolConnectSDK', () => {
  it('should handle connection failure gracefully', async () => {
    const sdk = new SolConnectSDK({ relayEndpoint: 'ws://invalid' });
    const result = await sdk.initialize();
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.CONNECTION_FAILED);
  });
});
```

#### Integration Tests
- Test complete flows (send message → receive → acknowledge)
- Use real WebSocket connections
- Verify encryption/decryption

### Performance Considerations

#### Message Handling
- Messages are processed in batches
- Automatic retry with exponential backoff
- Connection pooling for multiple sessions

#### Memory Management
- Clean up subscriptions when components unmount
- Limit message history in memory
- Use pagination for large chat histories

### Security Best Practices

1. **Never log sensitive data** (private keys, unencrypted messages)
2. **Validate all inputs** before processing
3. **Use the error system** for user-facing messages
4. **Keep dependencies updated** with `npm audit fix`

### Debugging Tips

#### Enable Debug Logging
```typescript
// In your code
const sdk = new SolConnectSDK({
  relayEndpoint: 'ws://localhost:8080',
  enableLogging: true  // Enables debug logs
});
```

#### Chrome DevTools
1. Network tab: Monitor WebSocket frames
2. Console: Filter by `[SolConnect]` prefix
3. Redux DevTools: Track state changes

#### Common Log Patterns
```
[SolConnectSDK] Initializing...
[MessageBus] Connecting to relay...
[WebSocketTransport] Connection established
[MessageHandler] Processing message: <id>
```

### Contributing Guidelines

1. **Branch Naming**: `feature/description` or `fix/issue-description`
2. **Commit Messages**: Use conventional commits (feat:, fix:, docs:, etc.)
3. **Pull Requests**: Include tests and update documentation
4. **Code Review**: Address all feedback before merging

### Useful Commands Reference

```bash
# Development
npm run dev              # Start Next.js dev server
npm run relay            # Start WebSocket relay
npm run mobile           # Start Expo for mobile

# Testing & Quality
npm test                 # Run all tests
npm run tsc             # TypeScript checking
npm run lint            # ESLint
npm run security:check  # Security audit

# Building
npm run build           # Production build
npm run start           # Start production server

# Maintenance
npm audit fix           # Fix security issues
npm update             # Update dependencies
```

### Getting Help

1. **Check the Spec**: `SPEC.md` for technical details
2. **Read the Code**: Well-commented source files
3. **Run Tests**: Tests demonstrate usage patterns
4. **Debug Logs**: Enable logging for detailed info

### Next Steps for New Contributors

1. Run the demo: `./demo.sh`
2. Read through `SPEC.md`
3. Explore the SDK: `src/services/SolConnectSDK.ts`
4. Try adding a simple feature
5. Write tests for your changes
6. Submit a PR!

Remember: The codebase prioritizes clarity and maintainability. When in doubt, choose the more explicit, well-documented approach. 