# Code Patterns Reference

## 🎯 Common Patterns

### Error Handling Pattern
Always use the Result type for operations that can fail:

```typescript
// ✅ Good - Consistent error handling
async function doSomething(): Promise<Result<Data>> {
  try {
    const data = await riskyOperation();
    return createResult.success(data);
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.UNKNOWN_ERROR,
      `Operation failed: ${error}`,
      'User-friendly error message',
      { context: 'additional info' }
    ));
  }
}

// Usage
const result = await doSomething();
if (result.success) {
  console.log('Success:', result.data);
} else {
  showToast({ type: 'error', title: result.error.userMessage });
}
```

### Component Structure Pattern
Standard React component with proper typing and hooks:

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from '../components/Toast';

interface Props {
  sessionId: string;
  onComplete?: () => void;
}

export default function MyComponent({ sessionId, onComplete }: Props): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // Initial load
    loadData();
  }, [sessionId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load logic
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to load',
        message: 'Please try again'
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  return (
    <div>
      {isLoading ? <LoadingState /> : <Content />}
    </div>
  );
}
```

### Service Class Pattern
Singleton services with initialization:

```typescript
export class MyService {
  private static instance: MyService | null = null;
  private isInitialized = false;

  private constructor(private config: ServiceConfig) {}

  async initialize(): Promise<Result<void>> {
    if (this.isInitialized) {
      return createResult.success(undefined);
    }

    try {
      // Initialization logic
      this.isInitialized = true;
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(/* error */);
    }
  }

  static getInstance(config?: ServiceConfig): MyService {
    if (!MyService.instance && config) {
      MyService.instance = new MyService(config);
    }
    if (!MyService.instance) {
      throw new Error('Service not initialized');
    }
    return MyService.instance;
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
    this.isInitialized = false;
  }
}
```

### Storage Adapter Pattern
Cross-platform storage abstraction:

```typescript
interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

class WebStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }
  // ... other methods
}

class MobileStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    return AsyncStorage.getItem(key);
  }
  // ... other methods
}
```

### Hook Pattern
Custom hooks for business logic:

```typescript
export function useMyFeature(sessionId: string) {
  const [state, setState] = useState<State>({ 
    data: null, 
    isLoading: false, 
    error: null 
  });

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await fetchData(sessionId);
    
    if (result.success) {
      setState({ data: result.data, isLoading: false, error: null });
    } else {
      setState({ data: null, isLoading: false, error: result.error });
    }
  }, [sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...state,
    refresh: loadData
  };
}
```

### Message Handler Pattern
Processing different message types:

```typescript
async processMessage(message: Message): Promise<Result<void>> {
  switch (message.type) {
    case 'chat':
      return this.processChatMessage(message);
    case 'ack':
      return this.processAckMessage(message);
    case 'ping':
      return this.processPingMessage(message);
    default:
      return createResult.error(
        ErrorFactory.unknownMessageType(message.type)
      );
  }
}
```

### Style Pattern
Inline styles with proper typing:

```typescript
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '20px',
    backgroundColor: '#f5f5f5'
  },
  button: (disabled: boolean) => ({
    backgroundColor: disabled ? '#ccc' : '#9945FF',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    transition: 'all 0.2s'
  })
};
```

### Async Queue Pattern
Managing sequential async operations:

```typescript
class AsyncQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      await operation();
    }
    
    this.processing = false;
  }
}
```

### Event Emitter Pattern
For decoupled communication:

```typescript
class EventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${String(event)}:`, error);
      }
    });
  }
}
```

## 🚨 Anti-Patterns to Avoid

### ❌ Direct Error Throwing
```typescript
// Bad
if (!data) {
  throw new Error('Data not found');
}

// Good
if (!data) {
  return createResult.error(ErrorFactory.dataNotFound());
}
```

### ❌ Untyped Event Handlers
```typescript
// Bad
onClick={(e) => handleClick(e)}

// Good
onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleClick(e)}
```

### ❌ Direct State Mutation
```typescript
// Bad
state.messages.push(newMessage);

// Good
setState(prev => ({
  ...prev,
  messages: [...prev.messages, newMessage]
}));
```

### ❌ Missing Error Boundaries
```typescript
// Bad
<MyComponent />

// Good
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

## 📋 Naming Conventions

- **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- **Components**: `PascalCase` (e.g., `ChatListScreen`)
- **Functions**: `camelCase` (e.g., `sendMessage`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_MESSAGE_SIZE`)
- **Interfaces**: `PascalCase` without `I` prefix (e.g., `Message`, not `IMessage`)
- **Types**: `PascalCase` (e.g., `Result<T>`)
- **Enums**: `PascalCase` with `PascalCase` values (e.g., `ErrorCode.CONNECTION_FAILED`) 