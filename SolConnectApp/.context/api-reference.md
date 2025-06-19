# API Quick Reference

## SolConnect SDK

### Initialization
```typescript
import { initializeSDK, getSDK } from './services/SolConnectSDK';

// Initialize
const sdk = await initializeSDK({
  relayEndpoint: 'ws://localhost:8080',
  solanaRpcUrl: 'https://api.devnet.solana.com',
  networkType: 'devnet',
  enableLogging: true
});

// Get instance
const sdk = getSDK();
```

### Wallet Operations
```typescript
// Connect wallet
const result = await sdk.connectWallet();
if (result.success) {
  console.log('Connected:', result.data.address);
}

// Disconnect
await sdk.disconnectWallet();

// Get current wallet
const wallet = sdk.getCurrentWallet();
```

### Session Management
```typescript
// Start session
const sessionResult = await sdk.startSession({
  peerWallet: 'ABC123...',
  enableEncryption: true
});

// Send message
const sendResult = await sdk.sendMessage(sessionId, 'Hello!');

// Subscribe to messages
const subscription = sdk.subscribeToMessages(sessionId, (message) => {
  console.log('New message:', message);
});

// End session
await sdk.endSession(sessionId);
```

### Message Storage
```typescript
// Get stored messages
const messages = await sdk.getStoredMessages(sessionId, 100);

// Clear messages
await sdk.clearStoredMessages(sessionId);

// Export all messages
const backup = await sdk.exportMessages();

// Import messages
const count = await sdk.importMessages(backupData);
```

---

## Message Bus

### Direct Usage
```typescript
import { getMessageBus } from './services/MessageBus';

const bus = getMessageBus();

// Send message
const result = await bus.sendMessage(session, plaintext);

// Subscribe
const sub = bus.subscribeToMessages(sessionId, handler);

// Get stored messages
const messages = await bus.getStoredMessages(sessionId);
```

---

## Storage Service

### Direct Storage Access
```typescript
import { getMessageStorage } from './services/storage/MessageStorage';

const storage = getMessageStorage();

// Store message
await storage.storeMessage(sessionId, message);

// Get messages
const result = await storage.getMessages(sessionId, limit);

// Update status
await storage.updateMessageStatus(sessionId, messageId, 'delivered');

// Cleanup old messages
const deleted = await storage.cleanup(30); // days

// Clear all
await storage.clearAll();
```

---

## React Hooks

### useSolConnect
```typescript
import { useSolConnect } from './hooks/useSolConnect';

function MyComponent() {
  const {
    sdk,
    isInitialized,
    isConnecting,
    wallet,
    connectionStatus,
    error,
    initialize,
    connectWallet,
    disconnectWallet,
    clearError
  } = useSolConnect();
  
  // Use the SDK
}
```

### useSession
```typescript
import { useSession } from './hooks/useSession';

function ChatComponent() {
  const {
    session,
    isStarting,
    error,
    startSession,
    endSession,
    clearError
  } = useSession();
}
```

### useMessages
```typescript
import { useMessages } from './hooks/useMessages';

function MessageList({ sessionId }) {
  const {
    messages,
    isSending,
    error,
    sendMessage,
    clearMessages,
    clearError
  } = useMessages(sessionId);
}
```

### useToast
```typescript
import { useToast } from './components/Toast';

function MyComponent() {
  const { showToast } = useToast();
  
  showToast({
    type: 'success', // 'error' | 'warning' | 'info'
    title: 'Success!',
    message: 'Optional details',
    duration: 5000,
    action: {
      label: 'Retry',
      onClick: () => console.log('Retry clicked')
    }
  });
}
```

---

## Error Handling

### Result Type
```typescript
import { Result, createResult } from './types/errors';

// Success
return createResult.success(data);

// Error
return createResult.error(SolConnectError.network(
  ErrorCode.CONNECTION_FAILED,
  'Technical message',
  'User-friendly message',
  { context: 'additional data' }
));

// Usage
const result = await someOperation();
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### Error Factory
```typescript
import { ErrorFactory } from './types/errors';

// Common errors
ErrorFactory.connectionFailed('details');
ErrorFactory.encryptionFailed('reason');
ErrorFactory.invalidWalletAddress('address');
ErrorFactory.walletNotConnected();
ErrorFactory.messageTooLarge(size, maxSize);
```

---

## UI Components

### ErrorBoundary
```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={<CustomError />}>
  <YourComponent />
</ErrorBoundary>
```

### Toast Provider
```typescript
import { ToastProvider } from './components/Toast';

// Wrap app
<ToastProvider>
  <App />
</ToastProvider>
```

---

## Utility Functions

### Type Guards
```typescript
// Check if error
if (error instanceof SolConnectError) {
  console.log(error.userMessage);
}

// Check result
if (result.success) {
  // TypeScript knows result.data exists
}
```

### Storage Helpers
```typescript
// Check storage availability
if (typeof window !== 'undefined' && window.localStorage) {
  // Web storage available
}

// Estimate storage
const estimate = await navigator.storage.estimate();
console.log(`Used: ${estimate.usage}, Available: ${estimate.quota}`);
```

---

## Common Patterns

### Async Operation with Error Handling
```typescript
async function doSomething(): Promise<Result<Data>> {
  try {
    setLoading(true);
    const result = await riskyOperation();
    return createResult.success(result);
  } catch (error) {
    showToast({
      type: 'error',
      title: 'Operation failed',
      message: error.message
    });
    return createResult.error(/* ... */);
  } finally {
    setLoading(false);
  }
}
```

### Component with Loading State
```typescript
function MyComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const handleAction = async () => {
    setIsLoading(true);
    try {
      await someAction();
      showToast({ type: 'success', title: 'Done!' });
    } catch (error) {
      showToast({ type: 'error', title: 'Failed!' });
    } finally {
      setIsLoading(false);
    }
  };

  return isLoading ? <Spinner /> : <Content />;
}
``` 