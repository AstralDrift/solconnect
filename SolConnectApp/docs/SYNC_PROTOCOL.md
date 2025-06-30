# SolConnect Sync Protocol Documentation

## Overview

Phase 3.1 implements a comprehensive message synchronization protocol for SolConnect that enables:
- Multi-device message synchronization
- Offline message queuing and delivery
- Conflict resolution using vector clocks
- Automatic sync when devices reconnect

## Architecture

### Core Components

1. **SyncProtocol.ts** - Protocol types and message definitions
2. **VectorClock.ts** - Vector clock implementation for conflict resolution  
3. **SyncManager.ts** - Main synchronization coordinator
4. **WebSocketSyncTransport.ts** - Transport adapter for WebSocket
5. **relay-sync.js** - Enhanced relay server with sync support

### Message Types

The sync protocol defines several message types:

- `SYNC_REQUEST` - Request missing messages from server
- `SYNC_UPDATE` - Send queued messages to server
- `SYNC_ACK` - Acknowledge received messages
- `SYNC_RESPONSE` - Server sends missing messages
- `SYNC_CONFLICT` - Notify about message conflicts
- `DEVICE_ANNOUNCE` - Announce device presence
- `SYNC_HEARTBEAT` - Keep sync connection alive

## How It Works

### 1. Device Registration

When a device connects, it announces itself:

```typescript
const announcement = {
  type: 'device_announce',
  sessionId: 'session-123',
  deviceId: 'device-abc',
  deviceInfo: {
    platform: 'web',
    version: '1.0.0'
  },
  syncState: {
    lastSyncedSequence: 42,
    vectorClock: { 'device-abc': 42 }
  }
};
```

### 2. Message Synchronization

When reconnecting, devices request missing messages:

```typescript
const syncRequest = {
  type: 'sync_request',
  sessionId: 'session-123',
  deviceId: 'device-abc',
  lastSyncedSequence: 42,
  syncVector: { 'device-abc': 42, 'device-xyz': 38 }
};
```

The server responds with missing messages and updates vector clocks.

### 3. Conflict Resolution

Vector clocks track causality between messages:

```typescript
// Device A sends message
vectorClock_A = { 'device-A': 1, 'device-B': 0 }

// Device B sends message concurrently  
vectorClock_B = { 'device-A': 0, 'device-B': 1 }

// Conflict detected - messages are concurrent
```

Conflicts are resolved using configurable strategies:
- `vector_clock` - Use vector clock ordering with deterministic tiebreakers
- `latest` - Take the message with latest timestamp
- `manual` - Application-specific resolution

### 4. Offline Queue Management

Messages sent while offline are queued and synced when reconnecting:

```typescript
// While offline
storage.storeMessage(sessionId, message, 'queued');

// When reconnecting
const queuedMessages = storage.getQueuedMessages();
syncManager.sendQueuedMessages(queuedMessages);
```

## Integration

### MessageBus Integration

The MessageBus automatically starts sync when subscribing to a session:

```typescript
const messageBus = new MessageBus(config);
await messageBus.initialize(database);

// Sync starts automatically
messageBus.subscribe(sessionId, messageHandler);
```

### Manual Sync

Trigger sync manually:

```typescript
// Sync specific session
await messageBus.syncMessages(sessionId);

// Sync all active sessions
await messageBus.syncMessages();
```

## Database Schema

The sync state is persisted in the database:

```sql
-- Sync state tracking
CREATE TABLE sync_state (
    session_id UUID,
    device_id VARCHAR(255),
    last_synced_sequence BIGINT,
    last_known_sequence BIGINT,
    sync_vector JSONB,  -- Vector clock
    pending_message_ids TEXT[],
    last_sync_at TIMESTAMP
);

-- Messages with sync metadata
CREATE TABLE messages (
    message_id VARCHAR(255),
    device_id VARCHAR(255),  -- Source device
    sequence_number BIGINT,  -- Per-session sequence
    sync_status VARCHAR(20), -- pending/synced/conflict/failed
    ...
);
```

## Usage Example

```typescript
// Initialize sync
const syncManager = getSyncManager();
await syncManager.initialize(database, syncTransport);

// Start sync for a session
await syncManager.startSync(chatSession);

// Listen for sync events
syncManager.on('onSyncCompleted', (sessionId, stats) => {
  console.log(`Synced ${stats.totalMessagesSynced} messages`);
});

syncManager.on('onConflictDetected', (sessionId, conflicts) => {
  console.log(`Detected ${conflicts.length} conflicts`);
});
```

## Testing

Run the enhanced relay server:
```bash
node relay-sync.js
```

Run the sync demo:
```bash
node demo-sync.js
```

## Configuration

```typescript
const syncConfig = {
  maxBatchSize: 100,              // Messages per sync batch
  syncIntervalMs: 5000,           // Auto-sync interval
  heartbeatIntervalMs: 30000,     // Heartbeat frequency
  conflictResolutionStrategy: 'vector_clock',
  maxRetries: 3,
  retryDelayMs: 1000,
  enableCompression: true
};
```

## Benefits

1. **Seamless Multi-Device Experience** - Messages sync automatically across devices
2. **Offline Support** - Send messages offline, they sync when reconnecting  
3. **Conflict Resolution** - Vector clocks ensure message ordering consistency
4. **Efficient Sync** - Only missing messages are transferred
5. **Real-time Updates** - Messages appear instantly on online devices

## SDK Integration

The sync protocol is now fully integrated into the SolConnectSDK with the following methods:

### Manual Sync

```typescript
// Initialize SDK
const sdk = await initializeSDK({
  relayEndpoint: 'ws://localhost:8080'
});

// Sync messages for a specific session
const syncResult = await sdk.syncMessages(sessionId);
if (syncResult.success) {
  console.log(`Synced ${syncResult.data} messages`);
}

// Sync all active sessions
const allSyncResult = await sdk.syncMessages();
```

### Auto-Sync

Enable automatic message synchronization:

```typescript
// Enable auto-sync for a session (syncs every 5 seconds)
await sdk.enableAutoSync(sessionId, 5000);

// Disable auto-sync
await sdk.disableAutoSync(sessionId);
```

### Sync Status

Monitor sync progress:

```typescript
const status = sdk.getSyncStatus();
if (status.success) {
  console.log('Sync in progress:', status.data.syncInProgress);
  console.log('Last sync:', status.data.lastSyncAt);
  console.log('Queued messages:', status.data.queuedMessageCount);
}
```

### Process Queued Messages

Force process queued messages when coming back online:

```typescript
// Process all queued messages
const processResult = await sdk.processQueuedMessages();
if (processResult.success) {
  console.log(`Processed ${processResult.data} queued messages`);
}
```

### Example: Complete Sync Flow

```typescript
// Initialize SDK and start a session
const sdk = await initializeSDK({ relayEndpoint: 'ws://localhost:8080' });
await sdk.initialize();
await sdk.connectWallet();

const session = await sdk.startSession({ 
  peerWallet: 'peer123...' 
});

// Enable auto-sync for the session
await sdk.enableAutoSync(session.data.session_id);

// Send messages (they'll sync automatically)
await sdk.sendMessage(session.data.session_id, 'Hello!');

// Manual sync when needed
await sdk.syncMessages(session.data.session_id);

// Check sync status
const status = sdk.getSyncStatus();
console.log('Sync status:', status.data);

// Process queued messages after being offline
await sdk.processQueuedMessages();

// Clean up when done
await sdk.endSession(session.data.session_id); // Auto-sync cleaned up automatically
```

## Next Steps

- Implement compression for sync messages
- Add end-to-end encryption for sync protocol
- Implement peer-to-peer sync for local networks
- Add sync progress UI indicators
- Implement selective sync for large message histories 