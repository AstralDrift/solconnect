# SolConnect Error Handling Guide

## Overview

SolConnect implements a comprehensive error handling system designed to provide clear, actionable feedback to both developers and end users. This guide covers error types, recovery strategies, and best practices.

## Error Categories

### 1. Network Errors
- **Recoverable**: Yes (automatic retry)
- **Common Codes**: `CONNECTION_FAILED`, `TIMEOUT`, `NETWORK_TIMEOUT`, `MESSAGE_DELIVERY_FAILED`
- **Recovery**: Automatic retry with exponential backoff

### 2. Crypto Errors
- **Recoverable**: No (requires manual intervention)
- **Common Codes**: `ENCRYPTION_FAILED`, `DECRYPTION_FAILED`, `KEY_DERIVATION_FAILED`, `SESSION_CREATION_FAILED`
- **Recovery**: User must retry the operation

### 3. Validation Errors
- **Recoverable**: Yes (with corrected input)
- **Common Codes**: `INVALID_MESSAGE_FORMAT`, `INVALID_WALLET_ADDRESS`, `MESSAGE_TOO_LARGE`
- **Recovery**: User must provide valid input

### 4. Authentication Errors
- **Recoverable**: Yes (reconnect wallet)
- **Common Codes**: `WALLET_NOT_CONNECTED`, `WALLET_CONNECTION_FAILED`, `SESSION_EXPIRED`
- **Recovery**: Reconnect wallet or refresh session

### 5. System Errors
- **Recoverable**: Varies
- **Common Codes**: `STORAGE_ERROR`, `SDK_NOT_INITIALIZED`, `SDK_INITIALIZATION_FAILED`
- **Recovery**: Depends on specific error

## Error Codes Reference

| Code | Category | Description | User Action |
|------|----------|-------------|-------------|
| `SDK_NOT_INITIALIZED` | System | SDK not initialized | Call `initialize()` first |
| `WALLET_CONNECTION_FAILED` | Auth | Failed to connect wallet | Check wallet availability |
| `SESSION_CREATION_FAILED` | Crypto | Failed to create session | Retry operation |
| `MESSAGE_DELIVERY_FAILED` | Network | Message send failed | Automatic retry |
| `NETWORK_TIMEOUT` | Network | Operation timed out | Check connection |
| `INVALID_WALLET_ADDRESS` | Validation | Invalid Solana address | Provide valid address |
| `MESSAGE_TOO_LARGE` | Validation | Message exceeds limit | Reduce message size |
| `STORAGE_ERROR` | System | Database operation failed | Check storage availability |

## Error Handling Patterns

### 1. Basic Error Handling

```typescript
const result = await sdk.sendMessage(sessionId, message);

if (!result.success) {
  console.error('Error:', result.error?.message);
  // Show user-friendly message
  alert(result.error?.userMessage);
}
```

### 2. Error Recovery

```typescript
const result = await sdk.connectWallet();

if (!result.success && result.error) {
  const error = result.error;
  
  switch (error.getRecoveryStrategy()) {
    case 'retry':
      // Automatic retry handled by SDK
      console.log('Retrying operation...');
      break;
      
    case 'manual':
      // User action required
      console.log('Please reconnect your wallet');
      break;
      
    case 'none':
      // Fatal error
      console.error('Unrecoverable error:', error.message);
      break;
  }
}
```

### 3. Error Context

```typescript
const result = await sdk.startSession({ peerWallet: address });

if (!result.success && result.error) {
  // Access error context for debugging
  console.log('Error context:', result.error.context);
  
  // Walk the error chain
  const errorChain = result.error.getErrorChain();
  errorChain.forEach((err, index) => {
    console.log(`Error ${index}:`, err.message);
  });
}
```

## Retry Configuration

### Default Retry Utilities

```typescript
// Network operations: 3 retries, exponential backoff
const networkRetry = RetryUtility.forNetworkOperations();

// Auth operations: 2 retries, fixed delay
const authRetry = RetryUtility.forAuthOperations();

// Critical operations: 5 retries, aggressive backoff
const criticalRetry = RetryUtility.forCriticalOperations();
```

### Custom Retry Configuration

```typescript
const customRetry = new RetryUtility({
  maxRetries: 4,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
});
```

## Circuit Breaker Pattern

The SDK uses circuit breakers to prevent cascading failures:

```typescript
// Circuit breaker states
- CLOSED: Normal operation
- OPEN: Rejecting requests (too many failures)
- HALF_OPEN: Testing recovery

// Default configurations
const networkBreaker = CircuitBreaker.forNetworkOperations();
const authBreaker = CircuitBreaker.forAuthOperations();
const criticalBreaker = CircuitBreaker.forCriticalOperations();
```

## Error Telemetry

All errors are automatically tracked for monitoring:

```typescript
// Errors include:
- Timestamp
- Error category and code
- Recovery information
- Contextual data
- Error chain

// Metrics tracked:
- Error frequency by type
- Recovery success rates
- Retry attempts
- Circuit breaker trips
```

## Best Practices

### 1. Always Check Results

```typescript
// ❌ Bad
await sdk.sendMessage(sessionId, message);

// ✅ Good
const result = await sdk.sendMessage(sessionId, message);
if (!result.success) {
  handleError(result.error);
}
```

### 2. Provide User Context

```typescript
// ❌ Bad
return createResult.error(new Error('Failed'));

// ✅ Good
return createResult.error(ErrorFactory.messageDeliveryFailed(
  messageId,
  originalError,
  { sessionId, retryCount, timestamp }
));
```

### 3. Handle Specific Errors

```typescript
if (!result.success) {
  switch (result.error?.code) {
    case ErrorCode.NETWORK_TIMEOUT:
      showRetryButton();
      break;
    case ErrorCode.INVALID_WALLET_ADDRESS:
      highlightAddressField();
      break;
    case ErrorCode.MESSAGE_TOO_LARGE:
      showSizeLimit();
      break;
    default:
      showGenericError();
  }
}
```

### 4. Log Errors Appropriately

```typescript
// Development
if (process.env.NODE_ENV === 'development') {
  console.error('Full error:', error);
  console.log('Error chain:', error.getErrorChain());
}

// Production
logger.error(error.message, {
  code: error.code,
  category: error.category,
  context: error.context
});
```

## Troubleshooting Common Errors

### SDK Not Initialized

**Error**: `SDK_NOT_INITIALIZED`

**Solution**:
```typescript
// Ensure initialization before use
const initResult = await sdk.initialize();
if (initResult.success) {
  // Now safe to use SDK
}
```

### Wallet Connection Timeout

**Error**: `NETWORK_TIMEOUT` during wallet connection

**Solution**:
```typescript
// Increase timeout
const result = await sdk.connectWallet(10000); // 10 seconds
```

### Message Delivery Failed

**Error**: `MESSAGE_DELIVERY_FAILED`

**Solution**:
- SDK automatically retries with exponential backoff
- Check circuit breaker state
- Verify network connectivity

### Session Creation Failed

**Error**: `SESSION_CREATION_FAILED`

**Solution**:
- Verify wallet addresses are valid
- Ensure both parties are connected
- Check for key derivation issues

## Error Monitoring Dashboard

The SDK provides metrics for monitoring error patterns:

```typescript
// Access error metrics
const metrics = sdk.getErrorMetrics();

// Monitor circuit breaker health
const breakerStats = circuitBreaker.getStats();

// Track retry patterns
const retryMetrics = sdk.getRetryMetrics();
```

## Migration from Old Error Handling

### Before (Old Pattern)
```typescript
try {
  // operation
} catch (error) {
  console.error('Error:', error);
}
```

### After (New Pattern)
```typescript
const result = await sdk.operation();
if (!result.success) {
  const error = result.error!;
  
  // Log with context
  logger.error(error.message, error.context);
  
  // Show user-friendly message
  showError(error.userMessage);
  
  // Handle recovery
  if (error.shouldRetry()) {
    scheduleRetry(error.getRetryDelayMs());
  }
}
```

## Support

For error-related issues:
1. Check error code in this guide
2. Review error context and chain
3. Check circuit breaker state
4. Review retry logs
5. Contact support with error details 