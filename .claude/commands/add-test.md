# Add Test Command

## Usage
`/add-test [component/service/function] [test scenario]`

## Purpose
Implement Test-Driven Development (TDD) workflow for SolConnect features.

## Instructions

<thinking>
The user wants to add tests for $ARGUMENTS. I need to:
1. Identify what needs testing
2. Write failing tests first (Red)
3. Implement minimal code to pass (Green)
4. Refactor if needed (Refactor)
5. Ensure comprehensive coverage
</thinking>

I'll help you add tests for **$ARGUMENTS** following TDD principles and SolConnect's testing patterns.

## Step 1: Identify Test Target
Analyzing the target:
- Component/Module: [from $ARGUMENTS]
- Type: [Unit/Integration/E2E]
- Testing framework: [Jest/React Testing Library/Rust test]

## Step 2: Test Planning
What to test:
- **Happy path**: Expected behavior
- **Edge cases**: Boundary conditions
- **Error cases**: Failure scenarios
- **Integration**: Component interactions

## Step 3: Write Tests First (Red Phase)

### React Component Test Template
```typescript
// src/components/__tests__/ComponentName.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComponentName } from '../ComponentName';

describe('ComponentName', () => {
  // Setup common test data
  const defaultProps = {
    // Add default props
  };

  // Helper to render with providers
  const renderComponent = (props = {}) => {
    return render(
      <ComponentName {...defaultProps} {...props} />
    );
  };

  describe('Rendering', () => {
    it('should render with required props', () => {
      renderComponent();
      expect(screen.getByRole('...')).toBeInTheDocument();
    });

    it('should display correct initial state', () => {
      renderComponent();
      expect(screen.getByText('...')).toBeVisible();
    });
  });

  describe('User Interactions', () => {
    it('should handle click events', async () => {
      const onClick = jest.fn();
      renderComponent({ onClick });
      
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should update state on input', async () => {
      renderComponent();
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test' } });
      await waitFor(() => {
        expect(input).toHaveValue('test');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on failure', () => {
      renderComponent({ error: 'Test error' });
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });
});
```

### Service Test Template (TypeScript)
```typescript
// src/services/__tests__/ServiceName.test.ts
import { ServiceName } from '../ServiceName';
import { MockTransport } from '@/test-utils/mocks';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockTransport: jest.Mocked<MockTransport>;

  beforeEach(() => {
    mockTransport = new MockTransport() as jest.Mocked<MockTransport>;
    service = new ServiceName(mockTransport);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await service.initialize();
      expect(result.success).toBe(true);
    });

    it('should handle initialization failure', async () => {
      mockTransport.connect.mockRejectedValue(new Error('Connection failed'));
      const result = await service.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SolConnectError);
    });
  });

  describe('Core Functionality', () => {
    it('should process messages correctly', async () => {
      const message = { text: 'Hello', timestamp: Date.now() };
      const result = await service.processMessage(message);
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        processed: true,
        message
      });
    });

    it('should validate input', async () => {
      const invalidMessage = { text: '' };
      const result = await service.processMessage(invalidMessage);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid message');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network errors', async () => {
      mockTransport.send.mockRejectedValue(new Error('Network error'));
      const result = await service.sendMessage('test');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(NetworkError);
    });
  });
});
```

### Hook Test Template
```typescript
// src/hooks/__tests__/useHookName.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useHookName } from '../useHookName';

describe('useHookName', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useHookName());
    
    expect(result.current.value).toBe(initialValue);
    expect(result.current.loading).toBe(false);
  });

  it('should update value when action is called', async () => {
    const { result } = renderHook(() => useHookName());
    
    await act(async () => {
      await result.current.updateValue('new value');
    });
    
    expect(result.current.value).toBe('new value');
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useHookName());
    
    await act(async () => {
      await result.current.triggerError();
    });
    
    expect(result.current.error).toBeDefined();
    expect(result.current.loading).toBe(false);
  });
});
```

### Rust Test Template
```rust
// In module file or tests/integration_test.rs
#[cfg(test)]
mod tests {
    use super::*;
    use tokio::test;

    #[test]
    async fn test_message_handling() {
        // Arrange
        let handler = MessageHandler::new();
        let test_message = Message {
            content: "Test".to_string(),
            sender: "wallet123".to_string(),
        };

        // Act
        let result = handler.process(test_message).await;

        // Assert
        assert!(result.is_ok());
        let processed = result.unwrap();
        assert_eq!(processed.status, MessageStatus::Delivered);
    }

    #[test]
    async fn test_error_handling() {
        let handler = MessageHandler::new();
        let invalid_message = Message {
            content: "".to_string(), // Invalid
            sender: "".to_string(),
        };

        let result = handler.process(invalid_message).await;
        
        assert!(result.is_err());
        match result {
            Err(SolChatError::Validation(msg)) => {
                assert!(msg.contains("Invalid message"));
            }
            _ => panic!("Expected validation error"),
        }
    }

    #[test]
    fn test_encryption() {
        let crypto = CryptoService::new();
        let plaintext = b"Secret message";
        let key = generate_key();

        let encrypted = crypto.encrypt(plaintext, &key).unwrap();
        let decrypted = crypto.decrypt(&encrypted, &key).unwrap();

        assert_eq!(plaintext, &decrypted[..]);
    }
}
```

## Step 4: Run Tests (Verify Red)
```bash
# TypeScript/React
npm test -- --watch ComponentName.test.tsx

# Rust
cargo test test_message_handling -- --nocapture

# With coverage
npm test -- --coverage --watchAll=false
```

## Step 5: Implement Code (Green Phase)
Write minimal code to make tests pass:

```typescript
// Example implementation
export const ComponentName: React.FC<Props> = ({ onClick, error }) => {
  const [value, setValue] = useState('');

  return (
    <div>
      {error && <div role="alert">{error}</div>}
      <input 
        type="text" 
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button onClick={onClick}>Submit</button>
    </div>
  );
};
```

## Step 6: Refactor (Refactor Phase)
Once tests pass, improve code quality:
- Extract constants
- Simplify logic
- Add types
- Improve naming

## Step 7: Add Edge Cases
```typescript
describe('Edge Cases', () => {
  it('should handle maximum message length', () => {
    const longMessage = 'x'.repeat(MAX_MESSAGE_LENGTH);
    // Test behavior
  });

  it('should handle rapid clicks', async () => {
    // Test debouncing/throttling
  });

  it('should handle concurrent operations', async () => {
    // Test race conditions
  });
});
```

## Step 8: Integration Tests
```typescript
// src/services/__tests__/integration.test.ts
describe('Message Flow Integration', () => {
  it('should send and receive encrypted messages', async () => {
    const sdk = new SolConnectSDK();
    await sdk.initialize();
    
    const session = await sdk.startSession({ peerWallet: 'test' });
    const result = await sdk.sendMessage(session.sessionId, 'Hello');
    
    expect(result.success).toBe(true);
    // Verify message was encrypted, sent, and acknowledged
  });
});
```

## Test Utilities

### Custom Matchers
```typescript
// src/test-utils/customMatchers.ts
expect.extend({
  toBeValidMessage(received) {
    const pass = received.text && received.timestamp && received.sender;
    return {
      pass,
      message: () => `Expected ${received} to be a valid message`
    };
  }
});
```

### Test Factories
```typescript
// src/test-utils/factories.ts
export const createMockMessage = (overrides = {}) => ({
  id: 'msg-123',
  text: 'Test message',
  sender: 'wallet123',
  timestamp: Date.now(),
  ...overrides
});

export const createMockSession = (overrides = {}) => ({
  sessionId: 'session-123',
  peerWallet: 'peer123',
  sharedKey: new Uint8Array(32),
  ...overrides
});
```

### Mock Providers
```typescript
// src/test-utils/TestProviders.tsx
export const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Provider store={mockStore}>
      <ThemeProvider theme={mockTheme}>
        {children}
      </ThemeProvider>
    </Provider>
  );
};
```

## Coverage Goals
- Aim for 80%+ coverage
- Focus on critical paths
- Don't test implementation details
- Test behavior, not structure

## Common Testing Patterns

### Async Testing
```typescript
it('should handle async operations', async () => {
  const { result } = renderHook(() => useAsyncData());
  
  expect(result.current.loading).toBe(true);
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
  
  expect(result.current.data).toBeDefined();
});
```

### Error Boundary Testing
```typescript
it('should catch and display errors', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };
  
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );
  
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

### WebSocket Testing
```typescript
it('should handle WebSocket messages', async () => {
  const mockWs = new MockWebSocket();
  const handler = new MessageHandler(mockWs);
  
  mockWs.emit('message', { type: 'chat', text: 'Hello' });
  
  await waitFor(() => {
    expect(handler.messages).toHaveLength(1);
  });
});
``` 