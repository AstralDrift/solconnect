# ADR 0004: Mobile Bridge Architecture

## Status

Accepted

## Context

SolConnect needs a mobile presence to reach users on their primary devices. We need to:
1. Expose our Rust core protocol to mobile platforms (iOS/Android)
2. Provide a secure, native-feeling chat experience
3. Maintain end-to-end encryption across the mobile boundary

## Decision

We will implement a mobile bridge using the following architecture:

### 1. Rust FFI Layer

- Use UniFFI for type-safe FFI bindings
- Expose a minimal, secure API surface:
  ```rust
  fn wallet_login() -> String
  fn start_session(peer_wallet: &str) -> Session
  fn send_encrypted_message(session: &Session, plaintext: &str) -> Result<()>
  fn poll_messages(session: &Session) -> Vec<EncryptedMessage>
  ```

### 2. Security Boundaries

- All cryptographic operations remain in Rust
- Mobile layer only handles UI and message transport
- Wallet integration via Solana Mobile Adapter
- No sensitive data stored in mobile app state

### 3. React Native Integration

- Use TurboModules for native bridge
- Implement mock SDK for development
- TypeScript interfaces for type safety
- Minimal, focused UI components

## Consequences

### Positive

- Type-safe FFI with minimal boilerplate
- Secure by default - crypto in Rust
- Cross-platform with native performance
- Easy to test and maintain

### Negative

- Additional build complexity
- Need to maintain FFI bindings
- Mobile-specific testing requirements

### Mitigations

- Comprehensive FFI tests
- CI/CD for mobile builds
- Clear documentation
- Mock implementations for development

## Implementation Notes

1. Build targets:
   - Android: `aarch64-linux-android`
   - iOS: `aarch64-apple-ios`

2. Security considerations:
   - All crypto in Rust
   - No sensitive data in JS
   - Secure storage for keys

3. Performance:
   - Minimal data crossing FFI boundary
   - Efficient message polling
   - Background processing in Rust

## References

- [UniFFI Documentation](https://mozilla.github.io/uniffi-rs/)
- [Solana Mobile Adapter](https://github.com/solana-mobile/mobile-wallet-adapter)
- [React Native TurboModules](https://reactnative.dev/docs/the-new-architecture/pillars-turbomodules) 