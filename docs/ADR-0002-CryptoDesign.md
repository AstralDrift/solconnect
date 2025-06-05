# ADR-0002: Cryptographic Design and Security Architecture

**Status**: Accepted  
**Date**: 2024-01-15  
**Deciders**: SolConnect Core Team  
**Related**: [ADR-0001: Wallet-Only Identity](./ADR-0001-WalletIdentity.md)

## Context

SolConnect requires robust end-to-end encryption for wallet-native messaging on Solana Mobile. The design must:

1. Leverage existing Solana wallet keys for identity and key derivation
2. Provide forward secrecy and deniability properties
3. Integrate with hardware security modules (Seed Vault)
4. Support asynchronous messaging scenarios
5. Maintain compatibility across iOS and Android platforms

## Decision

We will implement a **hybrid cryptographic system** using:

1. **Ed25519 → X25519 key derivation** for ECDH key exchange
2. **Double Ratchet protocol** for forward-secure messaging
3. **Solana Mobile Seed Vault** for hardware-backed key operations
4. **AES-256-GCM** for symmetric encryption

## Cryptographic Components

### 1. Key Derivation

```
Ed25519 Wallet Key → HKDF-SHA256 → X25519 ECDH Key
```

- **Input**: Ed25519 wallet keypair (existing Solana wallet)
- **Process**: HKDF with salt = Ed25519 public key, info = "SolConnect-X25519-Derivation"
- **Output**: X25519 keypair for Elliptic Curve Diffie-Hellman

**Rationale**: Allows users to derive messaging keys deterministically from their wallet keys without exposing the wallet private key in messaging operations.

### 2. Session Establishment

```
Alice                           Bob
------                         -----
Ed25519_A → X25519_A          Ed25519_B → X25519_B
      \                        /
       \                      /
        → Shared Secret ←
           (ECDH)
             ↓
       Double Ratchet
     Initial Root Key
```

- **Key Agreement**: X25519 ECDH between derived keys
- **Root Key**: SHA256(shared_secret || "SolConnect-Root-Key")
- **Session ID**: Base58(Alice_wallet || ":" || Bob_wallet)

### 3. Double Ratchet Protocol

Based on Signal's Double Ratchet specification:

- **Symmetric-key ratchet**: Forward secrecy via key deletion
- **Diffie-Hellman ratchet**: Future secrecy via new ECDH rounds
- **Message keys**: HKDF-derived from chain keys
- **Encryption**: AES-256-GCM with authenticated additional data

**Properties Achieved**:
- **Forward Secrecy**: Old keys cannot decrypt new messages
- **Future Secrecy**: Compromised state cannot decrypt future messages  
- **Deniability**: No cryptographic proof of message authorship

### 4. Hardware Security Integration

**Seed Vault Operations** (Hardware Security Module):
```rust
// All operations happen in secure hardware
trait SeedVaultProvider {
    fn sign_message(message: &[u8]) -> HardwareSignature;
    fn derive_shared_secret(peer_pubkey: &[u8]) -> SharedSecret;
    fn get_public_key() -> Ed25519PublicKey;
}
```

**Security Boundaries**:
- ✅ **In Hardware**: Ed25519 private key, X25519 derivation, ECDH computation
- ⚠️ **In Process**: Double ratchet state, message keys, session management
- ❌ **Never Exposed**: Wallet private key, derived X25519 private key

## Threat Model

### Protected Against

| Threat | Protection |
|--------|------------|
| **Passive Eavesdropping** | End-to-end encryption with AES-256-GCM |
| **Man-in-the-Middle** | Public key verification via wallet identity |
| **Key Compromise (Past)** | Forward secrecy via key ratcheting |
| **Key Compromise (Future)** | Future secrecy via new ECDH rounds |
| **Message Replay** | Nonce-based message ordering |
| **Impersonation** | Hardware-backed message signing |
| **Device Theft** | Hardware security module protection |

### NOT Protected Against

| Threat | Mitigation Strategy |
|--------|-------------------|
| **Endpoint Compromise** | ⚠️ Device-level security, app sandboxing |
| **Social Engineering** | 📚 User education, clear security indicators |
| **Metadata Analysis** | 🔄 Future: Onion routing, traffic padding |
| **Attachment Encryption** | 🔄 Future: Separate attachment key ratchet |
| **Group Messaging** | 🔄 Future: Multi-party protocols |

## Algorithm Specifications

### Key Derivation Function

```rust
fn derive_x25519_from_ed25519(
    ed25519_pubkey: &Ed25519PublicKey,
    ed25519_privkey: &Ed25519SecretKey,
) -> X25519KeyPair {
    let hkdf = HKDF-SHA256(
        salt: ed25519_pubkey.bytes(),
        ikm: ed25519_privkey.bytes()
    );
    let x25519_secret = hkdf.expand(
        info: "SolConnect-X25519-Derivation",
        length: 32
    );
    X25519KeyPair::from(x25519_secret)
}
```

### Session Key Derivation

```rust
fn derive_session_key(local: &[u8; 32], remote: &[u8; 32]) -> [u8; 32] {
    SHA256("SolConnect-Session-Key" || local || remote)
}
```

### Message Encryption

```rust
fn encrypt_message(plaintext: &[u8], key: &[u8; 32]) -> EncryptedMessage {
    let cipher = AES-256-GCM::new(key);
    let nonce = generate_nonce(); // 96-bit random
    let ciphertext = cipher.encrypt(nonce, plaintext);
    EncryptedMessage { nonce, ciphertext }
}
```

## Implementation Security

### Memory Protection

- **Zeroization**: All private keys zeroized on drop (`zeroize` crate)
- **No Swapping**: Mark sensitive pages non-swappable where possible
- **Constant Time**: Use constant-time comparison for secrets

### Error Handling

- **No Leak**: Cryptographic errors don't leak timing information
- **Generic Errors**: Return generic "decryption failed" messages
- **Logging**: No sensitive data in logs (production builds)

### Test Vectors

Deterministic test vectors for cross-platform compatibility:

```rust
// Ed25519 test keypair
ed25519_secret = 0x9d61b19d...
ed25519_public = 0xd75a9801...

// Expected X25519 derivation
x25519_secret = derive_x25519(ed25519_public, ed25519_secret)
x25519_public = X25519PublicKey::from(x25519_secret)

// Cross-language verification required
```

## Future Considerations

### Planned Enhancements

1. **Post-Quantum Cryptography**: Hybrid ECDH + CRYSTALS-Kyber
2. **Group Messaging**: Multi-party double ratchet (MLS/TreeKEM)
3. **Attachment Encryption**: Separate key ratchet for files
4. **Metadata Protection**: Onion routing integration
5. **Backup & Recovery**: Encrypted session state export

### Open Risks

1. **Quantum Threat**: Current ECC vulnerable to quantum computers
2. **Side Channels**: Timing attacks on non-constant-time operations
3. **Implementation Bugs**: Crypto is hard, bugs are likely
4. **Key Management**: User wallet security is outside our control
5. **Platform Trust**: Reliance on mobile OS security

## Compliance & Standards

- **FIPS 140-2**: AES, SHA-2, ECDH algorithms are FIPS approved
- **Signal Protocol**: Double ratchet follows Signal specification
- **RFC 7748**: X25519 ECDH implementation follows RFC standard
- **RFC 8032**: Ed25519 signature scheme per RFC standard

## Audit & Verification

**Required Actions**:
- [ ] External cryptographic audit by specialized firm
- [ ] Formal verification of key derivation properties  
- [ ] Cross-platform test vector validation
- [ ] Hardware security module integration testing
- [ ] Side-channel analysis on mobile devices

## References

- [Signal Protocol Documentation](https://signal.org/docs/)
- [Double Ratchet Specification](https://signal.org/docs/specifications/doubleratchet/)
- [X25519 RFC 7748](https://tools.ietf.org/html/rfc7748)
- [Ed25519 RFC 8032](https://tools.ietf.org/html/rfc8032)
- [HKDF RFC 5869](https://tools.ietf.org/html/rfc5869)
- [Solana Mobile Security Architecture](https://solanamobile.com/developers)

---

*This ADR defines the cryptographic foundation for SolConnect's wallet-native secure messaging system.* 