# ADR-0002: Cryptographic Design

## Status
**IMPLEMENTED** - Core Signal Protocol foundation completed

## Context
SolConnect requires end-to-end encryption for private messaging while maintaining compatibility across web, mobile, and desktop platforms. The solution must provide forward secrecy, be resistant to compromise, and integrate with Solana wallet-based identity.

## Decision
We will implement the **Signal Protocol** with the following architecture:

### Core Components

1. **CryptoUtils.ts** - Cross-platform cryptographic operations
   - WebCrypto API for browsers/modern Node.js environments
   - Noble crypto library fallbacks for Node.js/Jest environments
   - Ed25519 digital signatures for identity and authentication
   - X25519 ECDH for key agreement
   - AES-GCM for symmetric encryption
   - HKDF for key derivation

2. **SignalProtocol.ts** - Main protocol implementation
   - X3DH (Extended Triple Diffie-Hellman) for initial key agreement
   - Double Ratchet algorithm for ongoing message encryption
   - Forward and backward secrecy guarantees
   - Out-of-order message handling with skipped message keys

3. **KeyStorage.ts** - Secure key management
   - IndexedDB storage for browsers
   - localStorage fallback for simple environments
   - Optional password-based encryption for stored keys
   - Automatic key rotation and cleanup

4. **VectorClock.ts** - Conflict resolution for distributed messaging
   - Causality tracking across devices
   - Deterministic conflict resolution strategies

### Protocol Flow

1. **Identity Key Generation**: Each wallet generates Ed25519 identity key pair
2. **Pre-Key Bundle Creation**: Generate signed pre-keys and one-time keys for others to initiate conversations
3. **Session Establishment**: Use X3DH to establish shared secret and initial ratchet state
4. **Message Encryption**: Use Double Ratchet to encrypt each message with forward secrecy
5. **Message Decryption**: Decrypt using current ratchet state, handling out-of-order delivery

### Cross-Platform Compatibility

- **Browser**: Uses WebCrypto API for hardware-accelerated operations
- **Node.js**: Falls back to Noble crypto pure-JS implementations
- **Mobile**: Will integrate with platform-specific crypto libraries via FFI
- **Testing**: Jest-compatible mocks for deterministic testing

## Implementation Status

### ✅ Completed
- Core cryptographic utilities with WebCrypto + Noble fallbacks
- Signal Protocol foundation with Double Ratchet algorithm
- Secure key storage with multiple backend support
- Comprehensive test suite covering all crypto operations
- Jest configuration for crypto testing in Node.js

### 🚧 In Progress
- Integration with MessageBus for transparent encryption
- Production optimizations and security hardening
- Mobile platform-specific implementations

### 📋 Planned
- Integration with SolConnect SDK
- Automated key rotation policies
- Security audit and penetration testing
- Performance optimizations for mobile devices

## Security Considerations

### Threat Model
- **Passive Network Eavesdropping**: Mitigated by end-to-end encryption
- **Active Network Attacks**: Mitigated by authenticated encryption and identity verification
- **Device Compromise**: Mitigated by forward secrecy (past messages remain secure)
- **Server Compromise**: Mitigated by zero-knowledge architecture (server never sees plaintext)

### Key Management
- Identity keys derived from or linked to Solana wallet keys
- Regular rotation of signed pre-keys and one-time keys
- Secure deletion of used one-time keys
- Optional user password for additional key encryption

### Forward Secrecy
- Double Ratchet provides forward secrecy after each message
- Compromised device cannot decrypt past messages
- Regular key rotation limits exposure window

## Testing Strategy

### Unit Tests
- All cryptographic primitives tested with known test vectors
- Protocol flow tested with Alice/Bob scenarios
- Error handling and edge cases covered

### Integration Tests
- Full message encryption/decryption flow
- Cross-device synchronization scenarios
- Network failure and recovery testing

### Security Tests
- Key derivation determinism verification
- Forward secrecy validation
- Side-channel attack resistance (future)

## Performance Considerations

### Optimization Targets
- Initial session establishment: < 100ms
- Message encryption/decryption: < 10ms
- Key storage operations: < 50ms
- Memory usage: < 10MB for active sessions

### Scaling Considerations
- Support for 1000+ concurrent conversations
- Efficient handling of large message histories
- Background key rotation without blocking UI

## Future Enhancements

1. **Group Messaging**: Extend protocol for multi-party conversations
2. **Voice/Video**: Integrate with WebRTC for encrypted calls  
3. **File Sharing**: Implement encrypted file transfer protocol
4. **Backup/Restore**: Secure backup of conversation history
5. **Cross-Device Sync**: Synchronize sessions across user devices

## Compliance

- **GDPR**: Zero-knowledge architecture ensures data minimization
- **SOX**: Cryptographic audit trails for financial communications
- **HIPAA**: Healthcare-grade encryption for sensitive communications

## References

- [Signal Protocol Specification](https://signal.org/docs/)
- [Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [X3DH Key Agreement](https://signal.org/docs/specifications/x3dh/)
- [WebCrypto API Specification](https://www.w3.org/TR/WebCryptoAPI/)
- [Noble Crypto Libraries](https://github.com/paulmillr/noble-ed25519)

---

*This ADR defines the cryptographic foundation for SolConnect's wallet-native secure messaging system.* 