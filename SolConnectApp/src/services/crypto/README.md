# SolConnect End-to-End Encryption

This module implements the Signal Protocol for end-to-end encryption of SolConnect messages.

## Features

- **Double Ratchet Algorithm**: Provides forward secrecy and future secrecy
- **X3DH Key Agreement**: Asynchronous key exchange for establishing sessions
- **AES-256-GCM Encryption**: Strong symmetric encryption for messages
- **Secure Key Storage**: Encrypted storage of cryptographic keys
- **Automatic Session Management**: Transparent encryption/decryption via MessageBus

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MessageBus                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              EncryptionService (Interceptor)         │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │            SignalProtocol (Double Ratchet)    │  │   │
│  │  │  ┌─────────────────┐  ┌──────────────────┐  │  │   │
│  │  │  │   KeyStorage     │  │   CryptoUtils    │  │  │   │
│  │  │  │  (IndexedDB)     │  │  (WebCrypto API) │  │  │   │
│  │  │  └─────────────────┘  └──────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Setup

```typescript
import { initializeMessageBus } from '../MessageBus';
import { initializeEncryptionService } from './EncryptionService';

// Initialize with encryption enabled
const messageBus = await initializeMessageBus({
  relayEndpoint: 'wss://relay.solconnect.com',
  enableEncryption: true,
  encryptionPassword: 'optional-storage-password'
});

// Initialize MessageBus with wallet address for encryption
const initResult = await messageBus.initialize(database, walletAddress);

// Messages are now automatically encrypted/decrypted!
```

### Direct Encryption Service Usage

```typescript
import { getEncryptionService } from './EncryptionService';

const encryptionService = getEncryptionService();

// Check session status
const sessionInfo = await encryptionService.getSessionInfo(peerWallet);
console.log('Session established:', sessionInfo.data?.established);

// Manually establish session (usually automatic)
const establishResult = await encryptionService.establishSession(peerWallet);

// Delete a session
await encryptionService.deleteSession(peerWallet);
```

### Key Management

```typescript
import { getKeyStorage } from './KeyStorage';

const keyStorage = getKeyStorage();

// Export keys for backup (implement secure export)
const sessions = await keyStorage.keys();

// Clear all keys (use with caution!)
await keyStorage.clearAll();
```

## Security Considerations

1. **Key Derivation**: Keys are derived from wallet Ed25519 keys using HKDF
2. **Forward Secrecy**: Old keys are deleted after use, preventing past message decryption
3. **Future Secrecy**: Compromised keys don't affect future messages due to ratcheting
4. **Deniability**: Messages can't be cryptographically proven to be from a specific sender
5. **Storage Encryption**: Keys are encrypted at rest using AES-GCM

## Implementation Notes

### WebCrypto Limitations

The current implementation uses WebCrypto API with some limitations:
- Ed25519 support varies by browser
- X25519 is approximated using P-256 ECDH
- For production, consider using libsodium-wrappers for full compatibility

### Prekey Bundle Exchange

Currently, prekey bundles are included in the first message. In production:
1. Store prekey bundles on a server
2. Fetch bundles before sending first message
3. Rotate prekeys periodically
4. Implement one-time prekey replenishment

### Message Format

Encrypted messages have the following structure:

```typescript
{
  version: 1,
  senderWallet: "wallet-address",
  encryptedMessage: {
    header: {
      dhPublicKey: Uint8Array,      // Current ratchet key
      previousChainLength: number,   // Messages in previous chain
      messageNumber: number          // Current message number
    },
    ciphertext: Uint8Array,          // Encrypted content
    mac: Uint8Array                  // Authentication tag
  },
  preKeyBundle?: PreKeyBundle,       // Only in first message
  timestamp: number
}
```

## Testing

```typescript
// Test encryption roundtrip
const session: ChatSession = {
  session_id: 'test-session',
  peer_wallet: 'peer-wallet-address',
  sharedKey: new Uint8Array(32)
};

// Send encrypted message
const sendResult = await messageBus.sendMessage(session, "Hello, encrypted world!");

// Message is automatically encrypted before sending
// and decrypted when received
```

## Performance

- **Key Generation**: ~10-50ms (one-time per session)
- **Message Encryption**: ~1-5ms per message
- **Message Decryption**: ~1-5ms per message
- **Session Storage**: ~5-10ms per operation

## Future Enhancements

1. **Hardware Security Module Integration**: Use device secure enclave
2. **Post-Quantum Cryptography**: Hybrid classical/quantum-resistant algorithms
3. **Group Messaging**: Multi-party Double Ratchet (MLS protocol)
4. **Attachment Encryption**: Separate key ratchet for large files
5. **Metadata Protection**: Hide sender/receiver information

## References

- [Signal Protocol Documentation](https://signal.org/docs/)
- [Double Ratchet Specification](https://signal.org/docs/specifications/doubleratchet/)
- [X3DH Key Agreement](https://signal.org/docs/specifications/x3dh/)
- [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) 