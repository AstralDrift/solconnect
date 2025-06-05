# ADR-0001: Wallet-Only Identity System

**Status**: Accepted  
**Date**: 2024-01-15  
**Deciders**: SolConnect Core Team

## Context

SolConnect requires a user identity system for secure messaging. Traditional approaches include:
1. Username/password with separate key management
2. OAuth with centralized identity providers
3. Self-sovereign identity with DIDs
4. Direct wallet-based identity

## Decision

We will use **Solana wallet addresses as the sole identity mechanism** for SolConnect users.

## Rationale

### Why Wallet-Only Identity?

1. **Native to Ecosystem**: Solana Mobile users already manage wallet identities - no additional onboarding friction
2. **Cryptographic Foundation**: Wallet keypairs provide built-in signing and encryption capabilities
3. **Decentralized by Design**: No identity provider single point of failure
4. **Mobile-First**: Wallet adapters in Solana Mobile Stack handle secure key operations
5. **Zero Additional Infrastructure**: No user databases, password reset flows, or account recovery systems

### Security Properties

- **Authentication**: Message signing with wallet private key proves sender identity
- **Non-repudiation**: Cryptographic signatures prevent message denial
- **Key Rotation**: Users can migrate to new wallets and update their identity references
- **Hardware Backing**: Mobile wallets can use secure enclaves for key protection

### User Experience Benefits

- **Single Sign-On**: Connect wallet once, chat anywhere
- **Portable Identity**: Move between devices by restoring wallet
- **Familiar UX**: Builds on existing Solana dApp interaction patterns
- **Privacy Control**: Users control which wallet addresses to associate with chats

## Consequences

### Positive
- Simplified architecture - no separate identity service
- Reduced attack surface - wallet security is battle-tested
- Better privacy - no centralized user data collection
- Seamless Solana ecosystem integration

### Negative
- Address exposure - chat participants see wallet addresses
- Lost wallet = lost chat history (unless backed up separately)
- Learning curve for non-crypto users
- Limited human-readable identity (no usernames)

## Mitigation Strategies

1. **Address Privacy**: Allow users to create dedicated "chat wallets" separate from main holdings
2. **Chat Backup**: Implement encrypted chat history backup to IPFS/Arweave
3. **User-Friendly Display**: Show shortened addresses with optional ENS-style naming
4. **Wallet Recovery Education**: Clear guidance on seed phrase management

## Implementation Notes

```rust
// Wallet address serves as both:
// 1. Message encryption key derivation
// 2. Message signature verification
// 3. Chat room membership authentication

pub struct WalletAddress(pub [u8; 32]);

impl MessageSender for WalletAddress {
    fn sign_message(&self, msg: &[u8]) -> Signature;
    fn verify_signature(&self, msg: &[u8], sig: &Signature) -> bool;
}
```

## References

- [Solana Mobile Wallet Adapter Protocol](https://github.com/solana-mobile/mobile-wallet-adapter)
- [Signal Protocol Double Ratchet](https://signal.org/docs/specifications/doubleratchet/) (for future E2E encryption)
- [Web3 Identity Standards](https://w3c-ccg.github.io/did-spec/)

---

*This ADR establishes the foundation for SolConnect's zero-trust, wallet-native messaging system.* 