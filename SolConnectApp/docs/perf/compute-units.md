# Compute Unit (CU) Profiling & Optimization

## Overview
This document tracks compute unit usage for key operations in the SolConnect DApp. We measure and optimize CU consumption to ensure efficient on-chain operations.

## Using Ephemeral Wallets
The profiling system supports two modes:
1. **Persistent Wallet**: Set `WALLET_PRIVATE_KEY` in `.env` for consistent measurements
2. **Ephemeral Wallet**: No configuration needed - automatically generates a temporary wallet and requests a 1 SOL airdrop on devnet

To use ephemeral wallets:
```bash
# Run with defaults (devnet + ephemeral wallet)
./scripts/profile.sh

# Or specify network
SOLANA_NETWORK=devnet ./scripts/profile.sh
```

## Baseline Measurements (2024-03-21)

### Operation Costs (CU)

| Payload | Operation | CU | ⚠️ |
|---------|-----------|----|----|
| 32 B | create_room | 150 | |
| 32 B | send_message | 150 | |
| 32 B | close_room | 150 | |
| 1 KiB | create_room | 150 | |
| 1 KiB | send_message | 150 | |
| 1 KiB | close_room | 150 | |
| 10 KiB | create_room | 150 | |
| 10 KiB | send_message | 150 | |
| 10 KiB | close_room | 150 | |

[Raw Results: `cu-profile-localnet-2025-06-10T03-18-21-357Z.json`]

### Optimization Thresholds
- Message Send (1 KiB): ≤ 150,000 CU
- Room Operations: ≤ 100,000 CU

## Optimization Checklist

### High Priority
- [ ] Message Batching
  - Implement `batchSend(messages[])` in SDK
  - Add on-chain batch processing
  - Update relay for batch aggregation
  - Target: 3-5 messages per batch
  - TODO: Implement batching if medium/large payloads ≥ 150k CU

### Medium Priority
- [ ] State Optimization
  - Use bitmaps for room permissions
  - Implement lazy initialization
  - Target: 10-15% CU reduction

### Low Priority
- [ ] Message Compression
  - LZ4 for payloads > 2 KB
  - Document latency impact
  - Target: 15-25% CU reduction for large messages

## Implementation Plan

### Phase 1: Message Batching
1. Add `batchSend` to SDK
   ```typescript
   interface BatchMessage {
     content: string;
     roomId: string;
     timestamp: number;
   }
   
   async function batchSend(messages: BatchMessage[]): Promise<string>;
   ```

2. On-chain Changes
   - Add batch processing instruction
   - Optimize state updates
   - Add batch size limits

3. Relay Updates
   - Aggregate outbound messages
   - Handle batch acknowledgments
   - Implement retry logic

### Phase 2: State Optimization
1. Room State
   - Bitmap-based permissions
   - Lazy initialization
   - Compact storage layout

2. Message State
   - Efficient indexing
   - Pruning strategy
   - Compression for history

## Monitoring & Metrics

### Key Metrics
- Messages per batch
- Average batch size
- CU savings per operation
- Compression ratio (if implemented)

### Alerts
- CU usage > threshold
- Batch size > limit
- Compression ratio < target

## Future Work
- [ ] Implement message batching
- [ ] Add state optimization
- [ ] Evaluate compression
- [ ] Add performance monitoring 