# Performance Baseline Report

This document captures initial performance metrics for the SolConnect relay server.

## Environment
- CPU: 4 vCPUs
- Rust: `cargo test` profile

## Metrics
The `stress_tests::test_large_message_batch` integration test sends 1000 messages
of 4KB each through the protocol layer. Running this test produced the following
result:

```
✅ Large message batch test passed: 1000 messages in 0.02s (49339 msg/s)
```

The above establishes a baseline throughput of **~49k messages/sec** for protocol
encoding/decoding on this hardware.

## Next Steps
Future optimizations will focus on improving QUIC transport settings, reducing
serialization overhead and enabling message batching.
