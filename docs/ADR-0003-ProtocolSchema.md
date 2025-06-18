# ADR-0003: Protocol Buffer Message Schema

**Status**: Accepted  
**Date**: 2024-01-15  
**Authors**: SolConnect Team  

## Context

SolConnect requires a robust, efficient, and extensible message format for communication between mobile clients and relay servers. The messaging protocol must support:

- Efficient serialization for mobile networks
- Forward and backward compatibility for protocol evolution
- Strong typing and validation
- Cross-platform support (iOS, Android, Web)
- Integration with existing Solana wallet infrastructure

## Decision

We will use Protocol Buffers (protobuf) as the primary message serialization format for SolConnect, replacing the initial JSON-based approach.

### Core Message Types

#### ChatMessage
```protobuf
message ChatMessage {
  string id = 1;                    // UUID v4 message identifier
  string sender_wallet = 2;         // Base58-encoded Solana wallet address
  string recipient_wallet = 3;      // Base58-encoded Solana wallet address
  uint64 timestamp = 4;             // Unix timestamp (seconds since epoch)
  bytes encrypted_payload = 5;      // AES-GCM encrypted message content
  optional string attachment_url = 6; // HTTPS URL to encrypted attachment
  uint32 ttl = 7;                   // Time-to-live in seconds (0 = no expiry)
  bytes signature = 8;              // Ed25519 signature of message hash
}
```

#### AckMessage
```protobuf
message AckMessage {
  string id = 1;                    // UUID v4 acknowledgment identifier
  string ref_message_id = 2;        // Reference to original ChatMessage.id
  AckStatus status = 3;             // Delivery/processing status
}

enum AckStatus {
  UNSPECIFIED = 0;  // Default/unknown status
  DELIVERED = 1;    // Successfully delivered to recipient
  FAILED = 2;       // Delivery failed (network/validation error)
  EXPIRED = 3;      // Message expired before delivery (TTL exceeded)
  REJECTED = 4;     // Message rejected (invalid signature/format)
}
```

## Rationale

### Why Protocol Buffers?

1. **Efficiency**: 3-10x smaller than JSON, crucial for mobile data usage
2. **Performance**: Faster serialization/deserialization than JSON
3. **Type Safety**: Strong typing prevents runtime errors
4. **Evolution**: Built-in forward/backward compatibility
5. **Tooling**: Excellent code generation for Rust, TypeScript, Swift, Kotlin
6. **Validation**: Schema-enforced validation at compile time

### Design Principles

#### 1. Wallet-Centric Identity
- Wallet addresses are the primary identity mechanism
- No separate user accounts or registration required
- Base58 encoding maintains compatibility with Solana ecosystem

#### 2. End-to-End Encryption
- `encrypted_payload` contains the actual message content
- Relay servers never see plaintext messages
- Signature verification ensures message integrity

#### 3. Message Lifecycle Management
- TTL enables automatic message expiration for privacy
- Acknowledgments provide delivery confirmation
- Unique IDs enable deduplication and tracking

#### 4. Extensibility
- Optional fields allow feature additions without breaking changes
- Enum values can be extended (new status codes)
- Reserved field numbers prevent conflicts

### Schema Evolution Strategy

#### Backward Compatibility
- New fields must be `optional` or have default values
- Field numbers are never reused
- Enum values are never removed (only deprecated)

#### Forward Compatibility
- Clients ignore unknown fields gracefully
- New enum values fall back to `UNSPECIFIED`
- Protocol version negotiation via feature flags

## Implementation Details

### Code Generation
```bash
# Generate Rust types
protoc --rust_out=src/ proto/message.proto

# Generate TypeScript types (future)
protoc --ts_out=src/ proto/message.proto
```

### Validation Rules
1. **Message ID**: Must be valid UUID v4
2. **Wallet Addresses**: Must be valid base58-encoded 32-byte keys
3. **Timestamp**: Must be within reasonable bounds (not too far in past/future)
4. **TTL**: Maximum value of 7 days (604800 seconds)
5. **Signature**: Must be valid Ed25519 signature of message hash

### Error Handling
- Invalid protobuf messages → `AckStatus::REJECTED`
- Expired messages → `AckStatus::EXPIRED`
- Network failures → `AckStatus::FAILED`
- Successful delivery → `AckStatus::DELIVERED`

## Consequences

### Positive
- **Performance**: Significant reduction in bandwidth usage
- **Reliability**: Strong typing prevents many runtime errors
- **Maintainability**: Clear schema documentation and validation
- **Scalability**: Efficient serialization supports high message volumes
- **Developer Experience**: Auto-generated types reduce boilerplate

### Negative
- **Complexity**: Additional build step for code generation
- **Debugging**: Binary format is less human-readable than JSON
- **Tooling**: Requires protobuf compiler in development environment
- **Migration**: Existing JSON-based clients need updates

### Mitigation Strategies
1. **Backwards Compatibility**: Relay supports both protobuf and JSON during transition
2. **Debugging Tools**: Implement protobuf-to-JSON conversion for debugging
3. **Documentation**: Comprehensive examples and migration guides
4. **CI Integration**: Automated protobuf validation in build pipeline

## Future Extensions

### Planned Features
1. **Group Messages**: Multi-recipient message support
2. **Message Reactions**: Emoji reactions with efficient encoding
3. **Read Receipts**: Enhanced delivery status tracking
4. **Media Messages**: Optimized handling for images/videos
5. **Message Threading**: Reply-to-message relationships

### Schema Versioning
```protobuf
message ProtocolVersion {
  uint32 major = 1;
  uint32 minor = 2;
  uint32 patch = 3;
}

message MessageEnvelope {
  ProtocolVersion version = 1;
  oneof message {
    ChatMessage chat = 2;
    AckMessage ack = 3;
    // Future message types...
  }
}
```

## Alternatives Considered

### JSON with Schema Validation
- **Pros**: Human-readable, simple tooling
- **Cons**: Larger size, slower parsing, runtime validation only

### MessagePack
- **Pros**: Compact binary format, JSON-compatible
- **Cons**: No schema evolution, limited tooling, no type safety

### Apache Avro
- **Pros**: Schema evolution, compact format
- **Cons**: Complex tooling, less mobile-friendly, limited Rust support

### FlatBuffers
- **Pros**: Zero-copy deserialization, very fast
- **Cons**: Complex schema evolution, limited ecosystem

## References

- [Protocol Buffers Language Guide](https://developers.google.com/protocol-buffers/docs/proto3)
- [Solana Address Format](https://docs.solana.com/developing/programming-model/accounts#addresses)
- [Ed25519 Signature Scheme](https://ed25519.cr.yp.to/)
- [Signal Protocol Specification](https://signal.org/docs/specifications/doubleratchet/)

---

**Next Review**: 2024-04-15 (3 months)  
**Related ADRs**: ADR-0001 (Wallet Identity), ADR-0002 (Crypto Design) 