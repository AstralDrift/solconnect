/**
 * Sync Protocol Types and Messages for SolConnect
 * Implements multi-device message synchronization with vector clocks
 */

import { Message } from '../../types';
import { Result } from '../../types/errors';

/**
 * Vector clock for conflict resolution
 * Maps device IDs to their sequence numbers
 */
export type VectorClock = Record<string, number>;

/**
 * Sync message types for the protocol
 */
export enum SyncMessageType {
  // Client -> Server
  SYNC_REQUEST = 'sync_request',        // Request missing messages
  SYNC_UPDATE = 'sync_update',          // Send queued messages
  SYNC_ACK = 'sync_ack',                // Acknowledge received messages
  DEVICE_ANNOUNCE = 'device_announce',   // Announce device presence
  
  // Server -> Client
  SYNC_RESPONSE = 'sync_response',       // Send missing messages
  SYNC_CONFLICT = 'sync_conflict',       // Notify of conflicts
  SYNC_STATUS = 'sync_status',           // Sync operation status
  DEVICE_LIST = 'device_list',           // List of active devices
  
  // Bidirectional
  SYNC_HEARTBEAT = 'sync_heartbeat'     // Keep sync connection alive
}

/**
 * Base sync message structure
 */
export interface SyncMessage {
  type: SyncMessageType;
  sessionId: string;
  deviceId: string;
  timestamp: number;
  messageId: string;
}

/**
 * Request missing messages from server
 */
export interface SyncRequestMessage extends SyncMessage {
  type: SyncMessageType.SYNC_REQUEST;
  lastSyncedSequence: number;      // Last message sequence this device has
  syncVector: VectorClock;         // Current vector clock state
  missingRanges?: Array<{          // Optional: specific missing ranges
    start: number;
    end: number;
  }>;
}

/**
 * Send queued messages to server
 */
export interface SyncUpdateMessage extends SyncMessage {
  type: SyncMessageType.SYNC_UPDATE;
  messages: Array<{
    message: Message;
    sequenceNumber: number;
    vectorClock: VectorClock;
    localTimestamp: number;
  }>;
}

/**
 * Acknowledge received messages
 */
export interface SyncAckMessage extends SyncMessage {
  type: SyncMessageType.SYNC_ACK;
  acknowledgedSequences: number[];
  acknowledgedMessageIds: string[];
  vectorClock: VectorClock;
}

/**
 * Server response with missing messages
 */
export interface SyncResponseMessage extends SyncMessage {
  type: SyncMessageType.SYNC_RESPONSE;
  messages: Array<{
    message: Message;
    sequenceNumber: number;
    vectorClock: VectorClock;
    serverTimestamp: number;
    originalDeviceId: string;
  }>;
  latestSequence: number;
  serverVectorClock: VectorClock;
}

/**
 * Conflict notification from server
 */
export interface SyncConflictMessage extends SyncMessage {
  type: SyncMessageType.SYNC_CONFLICT;
  conflicts: Array<{
    messageId: string;
    conflictingVersions: Array<{
      message: Message;
      deviceId: string;
      vectorClock: VectorClock;
      timestamp: number;
    }>;
    resolution?: 'latest' | 'merge' | 'manual';
  }>;
}

/**
 * Sync operation status
 */
export interface SyncStatusMessage extends SyncMessage {
  type: SyncMessageType.SYNC_STATUS;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  progress?: {
    messagesSynced: number;
    totalMessages: number;
    conflictsResolved: number;
  };
  error?: string;
}

/**
 * Device announcement
 */
export interface DeviceAnnounceMessage extends SyncMessage {
  type: SyncMessageType.DEVICE_ANNOUNCE;
  deviceInfo: {
    platform: string;
    version: string;
    lastSeenAt: number;
  };
  syncState: {
    lastSyncedSequence: number;
    vectorClock: VectorClock;
  };
}

/**
 * Active device list
 */
export interface DeviceListMessage extends SyncMessage {
  type: SyncMessageType.DEVICE_LIST;
  devices: Array<{
    deviceId: string;
    platform: string;
    lastSeenAt: number;
    isOnline: boolean;
    syncState: {
      lastSyncedSequence: number;
      vectorClock: VectorClock;
    };
  }>;
}

/**
 * Sync heartbeat for connection maintenance
 */
export interface SyncHeartbeatMessage extends SyncMessage {
  type: SyncMessageType.SYNC_HEARTBEAT;
  sequenceNumber: number;
  vectorClock: VectorClock;
}

/**
 * Union type for all sync messages
 */
export type AnySyncMessage = 
  | SyncRequestMessage
  | SyncUpdateMessage
  | SyncAckMessage
  | SyncResponseMessage
  | SyncConflictMessage
  | SyncStatusMessage
  | DeviceAnnounceMessage
  | DeviceListMessage
  | SyncHeartbeatMessage;

/**
 * Sync protocol configuration
 */
export interface SyncProtocolConfig {
  maxBatchSize: number;              // Max messages per sync batch
  syncIntervalMs: number;            // How often to sync
  heartbeatIntervalMs: number;       // Heartbeat frequency
  conflictResolutionStrategy: 'latest' | 'vector_clock' | 'manual';
  maxRetries: number;
  retryDelayMs: number;
  enableCompression: boolean;
}

/**
 * Default sync protocol configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncProtocolConfig = {
  maxBatchSize: 100,
  syncIntervalMs: 5000,
  heartbeatIntervalMs: 30000,
  conflictResolutionStrategy: 'vector_clock',
  maxRetries: 3,
  retryDelayMs: 1000,
  enableCompression: true
};

/**
 * Sync state for a session
 */
export interface SessionSyncState {
  sessionId: string;
  deviceId: string;
  lastSyncedSequence: number;
  lastKnownSequence: number;
  vectorClock: VectorClock;
  pendingMessageIds: string[];
  lastSyncAt: Date;
  isSyncing: boolean;
  syncErrors: number;
}

/**
 * Sync statistics
 */
export interface SyncStats {
  totalMessagesSynced: number;
  totalConflictsResolved: number;
  lastSyncDuration: number;
  averageSyncDuration: number;
  syncFailures: number;
  pendingMessages: number;
}

/**
 * Type guards for sync messages
 */
export const SyncMessageGuards = {
  isSyncRequest: (msg: AnySyncMessage): msg is SyncRequestMessage =>
    msg.type === SyncMessageType.SYNC_REQUEST,
  
  isSyncUpdate: (msg: AnySyncMessage): msg is SyncUpdateMessage =>
    msg.type === SyncMessageType.SYNC_UPDATE,
  
  isSyncResponse: (msg: AnySyncMessage): msg is SyncResponseMessage =>
    msg.type === SyncMessageType.SYNC_RESPONSE,
  
  isSyncConflict: (msg: AnySyncMessage): msg is SyncConflictMessage =>
    msg.type === SyncMessageType.SYNC_CONFLICT,
  
  isSyncStatus: (msg: AnySyncMessage): msg is SyncStatusMessage =>
    msg.type === SyncMessageType.SYNC_STATUS,
  
  isDeviceAnnounce: (msg: AnySyncMessage): msg is DeviceAnnounceMessage =>
    msg.type === SyncMessageType.DEVICE_ANNOUNCE,
  
  isDeviceList: (msg: AnySyncMessage): msg is DeviceListMessage =>
    msg.type === SyncMessageType.DEVICE_LIST,
  
  isSyncHeartbeat: (msg: AnySyncMessage): msg is SyncHeartbeatMessage =>
    msg.type === SyncMessageType.SYNC_HEARTBEAT
};

/**
 * Sync message factory
 */
export class SyncMessageFactory {
  static createSyncRequest(
    sessionId: string,
    deviceId: string,
    syncState: SessionSyncState
  ): SyncRequestMessage {
    return {
      type: SyncMessageType.SYNC_REQUEST,
      sessionId,
      deviceId,
      timestamp: Date.now(),
      messageId: `sync-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      lastSyncedSequence: syncState.lastSyncedSequence,
      syncVector: syncState.vectorClock
    };
  }

  static createSyncUpdate(
    sessionId: string,
    deviceId: string,
    messages: Array<{
      message: Message;
      sequenceNumber: number;
      vectorClock: VectorClock;
    }>
  ): SyncUpdateMessage {
    return {
      type: SyncMessageType.SYNC_UPDATE,
      sessionId,
      deviceId,
      timestamp: Date.now(),
      messageId: `sync-upd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messages: messages.map(m => ({
        ...m,
        localTimestamp: Date.now()
      }))
    };
  }

  static createSyncAck(
    sessionId: string,
    deviceId: string,
    acknowledgedSequences: number[],
    acknowledgedMessageIds: string[],
    vectorClock: VectorClock
  ): SyncAckMessage {
    return {
      type: SyncMessageType.SYNC_ACK,
      sessionId,
      deviceId,
      timestamp: Date.now(),
      messageId: `sync-ack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      acknowledgedSequences,
      acknowledgedMessageIds,
      vectorClock
    };
  }

  static createDeviceAnnounce(
    sessionId: string,
    deviceId: string,
    deviceInfo: DeviceAnnounceMessage['deviceInfo'],
    syncState: SessionSyncState
  ): DeviceAnnounceMessage {
    return {
      type: SyncMessageType.DEVICE_ANNOUNCE,
      sessionId,
      deviceId,
      timestamp: Date.now(),
      messageId: `device-ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deviceInfo,
      syncState: {
        lastSyncedSequence: syncState.lastSyncedSequence,
        vectorClock: syncState.vectorClock
      }
    };
  }

  static createHeartbeat(
    sessionId: string,
    deviceId: string,
    sequenceNumber: number,
    vectorClock: VectorClock
  ): SyncHeartbeatMessage {
    return {
      type: SyncMessageType.SYNC_HEARTBEAT,
      sessionId,
      deviceId,
      timestamp: Date.now(),
      messageId: `hb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sequenceNumber,
      vectorClock
    };
  }
} 