# Debug Issue Command

## Usage
`/debug-issue [component] [error description]`

## Purpose
Systematically debug issues in the SolConnect codebase using a structured approach.

## Instructions

<thinking>
The user is reporting an issue with $ARGUMENTS. I need to:
1. Identify the component/module affected
2. Reproduce the issue
3. Analyze error patterns
4. Check related code
5. Propose a fix with tests
</thinking>

I'll help you debug the issue with **$ARGUMENTS**. Let me start by analyzing the problem systematically.

## Step 1: Understand the Issue
First, let me gather information about the error:
- Component affected: [identify from $ARGUMENTS]
- Error type: [runtime/compile/test]
- User impact: [describe impact]

## Step 2: Reproduce the Issue
```bash
# Check current environment
cd SolConnectApp
npm run dev

# If WebSocket related
npm run relay

# If Rust related
cargo build --workspace
```

## Step 3: Analyze Error Patterns
I'll search for:
- Error messages in logs
- Related code patterns
- Similar issues in codebase
- Recent changes that might have caused this

## Step 4: Investigation
Based on the component, I'll examine:
- For React components: Check props, state, and lifecycle
- For Services: Check error handling and Result<T> patterns
- For WebSocket: Check connection state and message flow
- For Rust: Check error propagation and type safety

## Step 5: Root Cause Analysis
Common patterns to check:
- **TypeScript**: Missing null checks, type mismatches
- **React**: Stale closures, missing dependencies
- **WebSocket**: Connection drops, reconnection logic
- **Rust**: Ownership issues, error handling

## Step 6: Proposed Fix
```typescript
// Example fix structure
try {
  // Fixed implementation
} catch (error) {
  return { 
    success: false, 
    error: new SolConnectError(error.message) 
  };
}
```

## Step 7: Add Tests
```typescript
describe('Fixed Component', () => {
  it('should handle the error case', () => {
    // Test implementation
  });
});
```

## Step 8: Verify Fix
- Run tests: `npm test`
- Check types: `npm run tsc`
- Lint code: `npm run lint`
- Manual testing in dev environment

## Common Debug Patterns for SolConnect

### WebSocket Issues
- Check relay server logs
- Verify connection URL
- Monitor reconnection attempts
- Check message serialization

### Wallet Connection Issues
- Verify Solana network (devnet/mainnet)
- Check wallet adapter initialization
- Validate RPC endpoint

### Encryption Issues
- Verify key derivation
- Check message format
- Validate session management

### State Management Issues
- Check Redux DevTools
- Verify action dispatches
- Validate selector logic

## Debug Commands
```bash
# Enable debug logging
localStorage.setItem('DEBUG', 'solconnect:*')

# Check WebSocket connections
# Browser DevTools > Network > WS

# Monitor Redux state
# Redux DevTools Extension

# Check Rust logs
RUST_LOG=debug cargo run
``` 