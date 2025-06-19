# Review PR Command

## Usage
`/review-pr [PR number or branch name] [focus areas]`

## Purpose
Conduct thorough code reviews for SolConnect pull requests with focus on security, performance, and maintainability.

## Instructions

<thinking>
The user wants me to review PR: $ARGUMENTS. I need to:
1. Fetch the PR changes
2. Analyze code quality and patterns
3. Check for security issues
4. Verify test coverage
5. Suggest improvements
6. Ensure consistency with project conventions
</thinking>

I'll review the pull request **$ARGUMENTS** focusing on SolConnect's code quality standards.

## Step 1: PR Overview
First, let me analyze the PR:
- PR/Branch: [from $ARGUMENTS]
- Focus areas: [security/performance/architecture/testing]
- Changed files: [list files]
- Lines changed: [additions/deletions]

## Step 2: Code Review Checklist

### 🔒 Security Review
- [ ] **Input Validation**: All user inputs sanitized
- [ ] **Authentication**: Wallet signatures verified
- [ ] **Encryption**: Messages properly encrypted/decrypted
- [ ] **Key Management**: No hardcoded keys or secrets
- [ ] **Error Messages**: No sensitive data in errors
- [ ] **Dependencies**: No vulnerable packages

### 🏗️ Architecture & Design
- [ ] **Patterns**: Follows Result<T> error handling
- [ ] **Separation**: Clear separation of concerns
- [ ] **Dependencies**: Proper dependency injection
- [ ] **Interfaces**: Well-defined contracts
- [ ] **State Management**: Redux patterns followed
- [ ] **Component Structure**: Follows project conventions

### ⚡ Performance
- [ ] **Rendering**: No unnecessary re-renders
- [ ] **Memoization**: React.memo/useMemo used appropriately
- [ ] **Async Operations**: Proper loading states
- [ ] **WebSocket**: Connection pooling efficient
- [ ] **Bundle Size**: No large dependencies added
- [ ] **Database Queries**: Optimized (if applicable)

### 🧪 Testing
- [ ] **Coverage**: Tests for new functionality
- [ ] **Edge Cases**: Boundary conditions tested
- [ ] **Error Cases**: Failure scenarios covered
- [ ] **Integration**: E2E flows tested
- [ ] **Mocks**: Proper test isolation
- [ ] **Performance**: No slow tests

### 📝 Code Quality
- [ ] **TypeScript**: Strict typing, no `any`
- [ ] **Naming**: Clear, descriptive names
- [ ] **Comments**: Complex logic documented
- [ ] **DRY**: No code duplication
- [ ] **SOLID**: Principles followed
- [ ] **Linting**: All checks pass

### 📚 Documentation
- [ ] **JSDoc**: Public APIs documented
- [ ] **README**: Updated if needed
- [ ] **ADR**: Architectural decisions recorded
- [ ] **CHANGELOG**: User-facing changes noted
- [ ] **Migration**: Breaking changes documented

## Step 3: Detailed Review

### File-by-File Analysis

#### `path/to/file1.ts`
```typescript
// Review comment: Consider using Result<T> pattern here
try {
  return await someOperation();
} catch (error) {
  throw error; // ❌ Should return Result type
}

// Suggested improvement:
async function improvedOperation(): Promise<Result<Data>> {
  try {
    const data = await someOperation();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: new SpecificError(error.message) 
    };
  }
}
```

#### `path/to/component.tsx`
```typescript
// Review comment: Component could benefit from memoization
export const ExpensiveComponent = ({ data }) => {
  // Heavy computation on every render
  const processed = data.map(complexOperation); // ❌
  
  // Suggested improvement:
  const processed = useMemo(
    () => data.map(complexOperation),
    [data]
  ); // ✅
}
```

### Security Concerns

#### Issue: Unvalidated Input
```typescript
// Found in: src/services/MessageHandler.ts
const message = req.body.message; // ❌ No validation
sendMessage(message);

// Should be:
const validated = validateMessage(req.body.message);
if (!validated.success) {
  return { success: false, error: validated.error };
}
sendMessage(validated.data); // ✅
```

#### Issue: Exposed Sensitive Data
```typescript
// Found in: src/utils/logger.ts
console.log('User wallet:', wallet); // ❌ Logs sensitive data

// Should be:
logger.debug('User action', { 
  wallet: wallet.slice(0, 4) + '...' // ✅ Truncated
});
```

### Performance Improvements

#### Optimize Re-renders
```typescript
// Current implementation causes unnecessary renders
const ChatList = ({ messages, onMessageClick }) => {
  return messages.map(msg => (
    <div onClick={() => onMessageClick(msg.id)}> // ❌ New function each render
      {msg.text}
    </div>
  ));
};

// Optimized version
const ChatList = ({ messages, onMessageClick }) => {
  const handleClick = useCallback((id) => {
    onMessageClick(id);
  }, [onMessageClick]); // ✅ Memoized
  
  return messages.map(msg => (
    <MessageItem 
      key={msg.id}
      message={msg}
      onClick={handleClick}
    />
  ));
};

const MessageItem = React.memo(({ message, onClick }) => (
  <div onClick={() => onClick(message.id)}>
    {message.text}
  </div>
));
```

### Test Coverage Gaps

#### Missing Test Cases
```typescript
// Component: MessageInput
// Missing tests for:
- Maximum message length
- Emoji support
- Paste event handling
- Keyboard shortcuts

// Suggested test:
it('should enforce maximum message length', () => {
  const { getByRole } = render(<MessageInput maxLength={100} />);
  const input = getByRole('textbox');
  
  fireEvent.change(input, { 
    target: { value: 'x'.repeat(150) } 
  });
  
  expect(input.value).toHaveLength(100);
});
```

## Step 4: Rust-Specific Review (if applicable)

### Memory Safety
```rust
// Check for potential issues:
- Use of `unsafe` blocks
- Proper lifetime annotations
- No memory leaks in FFI boundaries
- Correct error propagation
```

### Error Handling
```rust
// Current: Panics on error
let result = some_operation().unwrap(); // ❌

// Should use:
let result = some_operation()
    .map_err(|e| SolChatError::Operation(e.to_string()))?; // ✅
```

## Step 5: Recommendations

### High Priority Issues 🔴
1. **Security**: Fix input validation in MessageHandler
2. **Performance**: Add memoization to ChatList component
3. **Error Handling**: Replace try/catch with Result pattern

### Medium Priority Issues 🟡
1. **Testing**: Add missing edge case tests
2. **Types**: Replace `any` types with proper interfaces
3. **Documentation**: Update JSDoc for new APIs

### Low Priority Issues 🟢
1. **Style**: Consistent naming conventions
2. **Refactor**: Extract magic numbers to constants
3. **Cleanup**: Remove commented code

## Step 6: Positive Feedback ✨

### What's Done Well
- Clean component structure
- Good use of TypeScript generics
- Proper error boundaries
- Efficient WebSocket handling
- Well-organized test files

## Step 7: Action Items

### For the PR Author
1. Address security issues before merge
2. Add tests for uncovered scenarios
3. Update documentation for API changes
4. Run performance profiling on critical paths

### For the Team
1. Consider adding lint rule for Result<T> pattern
2. Create shared test utilities for common scenarios
3. Document performance benchmarks

## Summary

### Approval Status
- [ ] ✅ **Approved** - Ready to merge
- [ ] 👍 **Approved with suggestions** - Minor improvements recommended
- [ ] 🔄 **Changes requested** - Must fix before merge
- [ ] 🚫 **Blocked** - Critical issues found

### Key Metrics
- Code coverage: [X]% → [Y]%
- Bundle size: +[X]KB
- Performance impact: [Negligible/Minor/Significant]
- Security score: [Pass/Fail]

### Merge Checklist
- [ ] All CI checks passing
- [ ] Security issues addressed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or migration guide provided)
- [ ] Performance impact assessed

## Additional Resources
- [SolConnect Coding Standards](./CLAUDE.md)
- [Architecture Decision Records](./docs/)
- [Security Best Practices](./docs/security.md)
- [Performance Guidelines](./docs/performance.md) 