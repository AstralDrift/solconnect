# Refactor Module Command

## Usage
`/refactor-module [module path] [refactoring goal]`

## Purpose
Safely refactor SolConnect modules while maintaining functionality and test coverage.

## Instructions

<thinking>
The user wants to refactor $ARGUMENTS. I need to:
1. Analyze the current module structure
2. Identify dependencies and consumers
3. Plan the refactoring approach
4. Ensure tests remain passing
5. Update documentation
</thinking>

I'll help you refactor **$ARGUMENTS** following SolConnect's best practices for safe refactoring.

## Step 1: Analyze Current Module
First, let me understand the current structure:
- Module location: [identify from $ARGUMENTS]
- Module type: [Component/Service/Hook/Store/Rust module]
- Current responsibilities: [list key functions]
- Dependencies: [list imports and exports]

## Step 2: Dependency Analysis
I'll check:
- What imports this module
- What this module depends on
- Test coverage for the module
- Type definitions used

## Step 3: Refactoring Plan
Based on the goal, I'll create a plan:

### For React Components
1. **Extract sub-components** if component is too large
2. **Extract custom hooks** for logic reuse
3. **Optimize renders** with React.memo/useMemo
4. **Improve prop types** with better TypeScript interfaces

### For Services (TypeScript)
1. **Apply Result<T> pattern** consistently
2. **Extract interfaces** for better testability
3. **Separate concerns** (transport, protocol, business logic)
4. **Add proper error handling**

### For Redux Store
1. **Normalize state shape** if needed
2. **Extract selectors** with createSelector
3. **Simplify reducers** with Redux Toolkit
4. **Add proper TypeScript types**

### For Rust Modules
1. **Extract traits** for abstraction
2. **Improve error types** with thiserror
3. **Optimize performance** with better algorithms
4. **Add documentation** with rustdoc

## Step 4: Pre-Refactoring Checklist
- [ ] All tests passing: `npm test` or `cargo test`
- [ ] Type checking clean: `npm run tsc`
- [ ] Linting clean: `npm run lint`
- [ ] Current functionality documented
- [ ] Backup/commit current state

## Step 5: Refactoring Implementation

### Example: Refactoring a React Component
```typescript
// Before: Large component
export const ChatThreadScreen = () => {
  // 200+ lines of mixed logic
};

// After: Separated concerns
// ChatThreadScreen.tsx
export const ChatThreadScreen = () => {
  const { messages, sendMessage } = useChatMessages(sessionId);
  const { isTyping } = useTypingIndicator(peerId);
  
  return (
    <ChatLayout>
      <MessageList messages={messages} />
      <TypingIndicator visible={isTyping} />
      <MessageInput onSend={sendMessage} />
    </ChatLayout>
  );
};

// hooks/useChatMessages.ts
export const useChatMessages = (sessionId: string) => {
  // Extracted message logic
};
```

### Example: Refactoring a Service
```typescript
// Before: Mixed responsibilities
class SolConnectSDK {
  // Everything in one class
}

// After: Separated concerns
class SolConnectSDK {
  constructor(
    private transport: IMessageTransport,
    private crypto: ICryptoService,
    private storage: IMessageStorage
  ) {}
  
  // Cleaner, testable methods
}
```

## Step 6: Update Tests
```typescript
// Update test imports
import { NewModuleStructure } from '@/new-path';

// Add tests for new functionality
describe('Refactored Module', () => {
  it('should maintain existing behavior', () => {
    // Test backwards compatibility
  });
  
  it('should support new structure', () => {
    // Test new functionality
  });
});
```

## Step 7: Update Documentation
- Update JSDoc/rustdoc comments
- Update README if API changed
- Update CLAUDE.md if patterns changed
- Add ADR if architectural decision

## Step 8: Migration Guide
If breaking changes:
```typescript
// Old way (deprecated)
import { OldAPI } from '@/old-path';

// New way
import { NewAPI } from '@/new-path';
// Migration: change X to Y
```

## Step 9: Verification
- [ ] All tests pass
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Manual testing completed
- [ ] Performance not degraded
- [ ] Documentation updated

## Common Refactoring Patterns

### Extract Custom Hook
```typescript
// Extract from component
const useConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionQuality>('checking');
  // Logic here
  return { status, reconnect };
};
```

### Extract Interface
```typescript
// Define clear contracts
interface IMessageHandler {
  handleMessage(msg: Message): Promise<Result<void>>;
  validateMessage(msg: unknown): msg is Message;
}
```

### Apply Result Pattern
```typescript
// Consistent error handling
async function refactoredMethod(): Promise<Result<Data>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: new SpecificError(error) };
  }
}
```

### Rust Trait Extraction
```rust
// Define behavior contracts
trait MessageProcessor {
    fn process(&self, msg: &Message) -> Result<ProcessedMessage>;
}
```

## Rollback Plan
If issues arise:
1. Git revert to previous commit
2. Re-run tests to verify
3. Document what went wrong
4. Plan alternative approach 