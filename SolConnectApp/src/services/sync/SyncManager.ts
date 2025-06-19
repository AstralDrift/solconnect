/**
 * Sync Manager for SolConnect
 * Coordinates message synchronization across multiple devices
 */

import { Message, ChatSession } from '../../types';
import { SolConnectError, ErrorCode, Result, createResult } from '../../types/errors';
import { MessageStorage, getMessageStorage } from '../storage/MessageStorage';
import { DatabaseService } from '../database/DatabaseService';
import { Logger } from '../monitoring/Logger';
import { 
  SessionSyncState, 
  SyncProtocolConfig, 
  DEFAULT_SYNC_CONFIG,
  SyncStats,
  AnySyncMessage,
  SyncMessageType,
  SyncMessageFactory,
  SyncRequestMessage,
  SyncUpdateMessage,
  SyncResponseMessage,
  SyncConflictMessage,
  SyncStatusMessage,
  DeviceAnnounceMessage,
  SyncMessageGuards,
  VectorClock
} from './SyncProtocol';
import { VectorClockManager, ConflictResolver } from './VectorClock';

/**
 * Sync transport interface
 */
export interface SyncTransport {
  sendSyncMessage(message: AnySyncMessage): Promise<Result<void>>;
  onSyncMessage(handler: (message: AnySyncMessage) => void): void;
  isConnected(): boolean;
}

/**
 * Sync event types
 */
export interface SyncEvents {
  onSyncStarted: (sessionId: string) => void;
  onSyncCompleted: (sessionId: string, stats: SyncStats) => void;
  onSyncFailed: (sessionId: string, error: Error) => void;
  onConflictDetected: (sessionId: string, conflicts: any[]) => void;
  onMessageSynced: (sessionId: string, messageId: string) => void;
}

/**
 * Main sync manager
 */
export class SyncManager {
  private config: SyncProtocolConfig;
  private storage: MessageStorage;
  private database?: DatabaseService;
  private transport?: SyncTransport;
  private logger = new Logger('SyncManager');
  
  // Sync state management
  private sessionStates = new Map<string, SessionSyncState>();
  private syncIntervals = new Map<string, NodeJS.Timeout>();
  private heartbeatInterval?: NodeJS.Timeout;
  
  // Statistics
  private stats: SyncStats = {
    totalMessagesSynced: 0,
    totalConflictsResolved: 0,
    lastSyncDuration: 0,
    averageSyncDuration: 0,
    syncFailures: 0,
    pendingMessages: 0
  };
  
  // Event handlers
  private eventHandlers: Partial<SyncEvents> = {};
  
  // Device info
  private deviceId: string;
  private platform: string;

  constructor(config?: Partial<SyncProtocolConfig>) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.storage = getMessageStorage();
    this.deviceId = this.generateDeviceId();
    this.platform = this.detectPlatform();
  }

  /**
   * Initialize sync manager
   */
  async initialize(
    database?: DatabaseService,
    transport?: SyncTransport
  ): Promise<Result<void>> {
    try {
      this.database = database;
      this.transport = transport;

      // Set up transport message handler
      if (this.transport) {
        this.transport.onSyncMessage(this.handleSyncMessage.bind(this));
      }

      // Load existing sync states from database
      if (this.database) {
        await this.loadSyncStates();
      }

      // Start heartbeat
      this.startHeartbeat();

      this.logger.info('SyncManager initialized', {
        deviceId: this.deviceId,
        platform: this.platform
      });

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to initialize sync manager: ${error}`,
        'Failed to initialize sync system',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Start syncing for a session
   */
  async startSync(session: ChatSession): Promise<Result<void>> {
    try {
      const sessionId = session.session_id;
      
      // Initialize sync state if not exists
      let syncState = this.sessionStates.get(sessionId);
      if (!syncState) {
        syncState = await this.initializeSyncState(sessionId);
        this.sessionStates.set(sessionId, syncState);
      }

      // Announce device
      await this.announceDevice(sessionId);

      // Start periodic sync
      this.startPeriodicSync(sessionId);

      // Perform initial sync
      await this.performSync(sessionId);

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to start sync: ${error}`,
        'Failed to start message synchronization',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Stop syncing for a session
   */
  async stopSync(sessionId: string): Promise<Result<void>> {
    try {
      // Stop periodic sync
      const interval = this.syncIntervals.get(sessionId);
      if (interval) {
        clearInterval(interval);
        this.syncIntervals.delete(sessionId);
      }

      // Save final sync state
      const syncState = this.sessionStates.get(sessionId);
      if (syncState && this.database) {
        await this.saveSyncState(syncState);
      }

      this.sessionStates.delete(sessionId);

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to stop sync: ${error}`,
        'Failed to stop synchronization',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Manually trigger sync for a session
   */
  async syncSession(sessionId: string): Promise<Result<SyncStats>> {
    const syncState = this.sessionStates.get(sessionId);
    if (!syncState) {
      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_STATE,
        'Session not initialized for sync',
        'Please start sync for this session first'
      ));
    }

    const result = await this.performSync(sessionId);
    if (!result.success) {
      return createResult.error(result.error!);
    }

    return createResult.success(this.stats);
  }

  /**
   * Handle incoming sync message
   */
  private async handleSyncMessage(message: AnySyncMessage): Promise<void> {
    this.logger.debug('Received sync message', { 
      type: message.type, 
      sessionId: message.sessionId,
      deviceId: message.deviceId 
    });

    try {
      if (SyncMessageGuards.isSyncRequest(message)) {
        await this.handleSyncRequest(message);
      } else if (SyncMessageGuards.isSyncUpdate(message)) {
        await this.handleSyncUpdate(message);
      } else if (SyncMessageGuards.isSyncResponse(message)) {
        await this.handleSyncResponse(message);
      } else if (SyncMessageGuards.isSyncConflict(message)) {
        await this.handleSyncConflict(message);
      } else if (SyncMessageGuards.isSyncStatus(message)) {
        await this.handleSyncStatus(message);
      } else if (SyncMessageGuards.isDeviceAnnounce(message)) {
        await this.handleDeviceAnnounce(message);
      } else if (SyncMessageGuards.isSyncHeartbeat(message)) {
        await this.handleHeartbeat(message);
      }
    } catch (error) {
      this.logger.error('Error handling sync message', error, { 
        messageType: message.type 
      });
    }
  }

  /**
   * Perform sync operation
   */
  private async performSync(sessionId: string): Promise<Result<void>> {
    const syncState = this.sessionStates.get(sessionId);
    if (!syncState || !this.transport || !this.transport.isConnected()) {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'Cannot sync: not connected',
        'Not connected to sync service'
      ));
    }

    if (syncState.isSyncing) {
      return createResult.success(undefined); // Already syncing
    }

    try {
      const startTime = Date.now();
      syncState.isSyncing = true;
      
      this.eventHandlers.onSyncStarted?.(sessionId);

      // 1. Send queued messages
      await this.sendQueuedMessages(sessionId, syncState);

      // 2. Request missing messages
      await this.requestMissingMessages(sessionId, syncState);

      // 3. Update sync state
      syncState.lastSyncAt = new Date();
      syncState.isSyncing = false;
      
      // Save to database
      if (this.database) {
        await this.saveSyncState(syncState);
      }

      // Update statistics
      const duration = Date.now() - startTime;
      this.stats.lastSyncDuration = duration;
      this.stats.averageSyncDuration = 
        (this.stats.averageSyncDuration * this.stats.totalMessagesSynced + duration) / 
        (this.stats.totalMessagesSynced + 1);

      this.eventHandlers.onSyncCompleted?.(sessionId, this.stats);

      return createResult.success(undefined);
    } catch (error) {
      syncState.isSyncing = false;
      syncState.syncErrors++;
      this.stats.syncFailures++;
      
      this.eventHandlers.onSyncFailed?.(sessionId, error as Error);
      
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Sync failed: ${error}`,
        'Failed to synchronize messages',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send queued messages
   */
  private async sendQueuedMessages(
    sessionId: string, 
    syncState: SessionSyncState
  ): Promise<void> {
    const queueStats = this.storage.getQueueStats();
    const sessionQueue = queueStats.bySession[sessionId];
    
    if (!sessionQueue || sessionQueue.queued === 0) {
      return; // No queued messages
    }

    // Get queued messages from storage
    const messagesResult = await this.storage.getMessages(sessionId);
    if (!messagesResult.success || !messagesResult.data) {
      throw new Error('Failed to get queued messages');
    }

    const queuedMessages = messagesResult.data
      .filter(m => m.deliveryStatus === 'queued' || m.deliveryStatus === 'failed')
      .slice(0, this.config.maxBatchSize);

    if (queuedMessages.length === 0) {
      return;
    }

    // Prepare sync update message
    const messages = queuedMessages.map(m => ({
      message: {
        sender_wallet: m.sender_wallet,
        ciphertext: m.ciphertext,
        timestamp: m.timestamp,
        session_id: sessionId
      } as Message,
      sequenceNumber: syncState.lastKnownSequence++,
      vectorClock: VectorClockManager.increment(syncState.vectorClock, this.deviceId)
    }));

    const updateMessage = SyncMessageFactory.createSyncUpdate(
      sessionId,
      this.deviceId,
      messages
    );

    // Send update
    const sendResult = await this.transport!.sendSyncMessage(updateMessage);
    if (sendResult.success) {
      // Mark messages as sent
      for (const msg of queuedMessages) {
        await this.storage.updateMessageStatus(sessionId, msg.id!, 'sent');
        syncState.pendingMessageIds = syncState.pendingMessageIds.filter(id => id !== msg.id);
      }
      
      this.stats.totalMessagesSynced += queuedMessages.length;
    }
  }

  /**
   * Request missing messages from server
   */
  private async requestMissingMessages(
    sessionId: string,
    syncState: SessionSyncState
  ): Promise<void> {
    const requestMessage = SyncMessageFactory.createSyncRequest(
      sessionId,
      this.deviceId,
      syncState
    );

    await this.transport!.sendSyncMessage(requestMessage);
  }

  /**
   * Handle sync request from another device
   */
  private async handleSyncRequest(message: SyncRequestMessage): Promise<void> {
    // This would typically be handled by the server
    // For P2P sync, we could respond with our messages
    this.logger.debug('Received sync request', { 
      from: message.deviceId,
      lastSequence: message.lastSyncedSequence 
    });
  }

  /**
   * Handle sync update (new messages from another device)
   */
  private async handleSyncUpdate(message: SyncUpdateMessage): Promise<void> {
    const syncState = this.sessionStates.get(message.sessionId);
    if (!syncState) return;

    for (const msgData of message.messages) {
      // Update vector clock
      syncState.vectorClock = VectorClockManager.update(
        syncState.vectorClock,
        msgData.vectorClock,
        this.deviceId
      );

      // Store message
      await this.storage.storeMessage(
        message.sessionId,
        msgData.message,
        message.deviceId
      );

      // Update sequence numbers
      syncState.lastKnownSequence = Math.max(
        syncState.lastKnownSequence,
        msgData.sequenceNumber
      );

      this.eventHandlers.onMessageSynced?.(message.sessionId, msgData.message.sender_wallet);
    }

    // Send acknowledgment
    const ackMessage = SyncMessageFactory.createSyncAck(
      message.sessionId,
      this.deviceId,
      message.messages.map(m => m.sequenceNumber),
      message.messages.map(m => m.message.sender_wallet),
      syncState.vectorClock
    );

    await this.transport!.sendSyncMessage(ackMessage);
  }

  /**
   * Handle sync response (missing messages from server)
   */
  private async handleSyncResponse(message: SyncResponseMessage): Promise<void> {
    const syncState = this.sessionStates.get(message.sessionId);
    if (!syncState) return;

    // Check for conflicts
    const conflicts = await this.detectConflicts(message);
    if (conflicts.length > 0) {
      this.eventHandlers.onConflictDetected?.(message.sessionId, conflicts);
      // Handle conflicts based on strategy
      await this.resolveConflicts(message.sessionId, conflicts);
    }

    // Store received messages
    for (const msgData of message.messages) {
      await this.storage.storeMessage(
        message.sessionId,
        msgData.message,
        msgData.originalDeviceId
      );

      // Update sync state
      syncState.lastSyncedSequence = Math.max(
        syncState.lastSyncedSequence,
        msgData.sequenceNumber
      );
      
      syncState.vectorClock = VectorClockManager.update(
        syncState.vectorClock,
        msgData.vectorClock,
        this.deviceId
      );

      this.stats.totalMessagesSynced++;
      this.eventHandlers.onMessageSynced?.(message.sessionId, msgData.message.sender_wallet);
    }

    // Update server vector clock
    syncState.vectorClock = VectorClockManager.update(
      syncState.vectorClock,
      message.serverVectorClock,
      this.deviceId
    );

    syncState.lastKnownSequence = message.latestSequence;
  }

  /**
   * Handle sync conflict notification
   */
  private async handleSyncConflict(message: SyncConflictMessage): Promise<void> {
    this.eventHandlers.onConflictDetected?.(message.sessionId, message.conflicts);
    
    for (const conflict of message.conflicts) {
      const resolved = ConflictResolver.resolveConflict(
        conflict.conflictingVersions,
        conflict.resolution || this.config.conflictResolutionStrategy
      );

      if (resolved) {
        await this.storage.storeMessage(
          message.sessionId,
          resolved,
          this.deviceId
        );
        
        this.stats.totalConflictsResolved++;
      }
    }
  }

  /**
   * Handle sync status update
   */
  private async handleSyncStatus(message: SyncStatusMessage): Promise<void> {
    if (message.status === 'completed') {
      this.logger.info('Sync completed', message.progress);
    } else if (message.status === 'failed' && message.error) {
      this.logger.error('Sync failed', new Error(message.error));
    }
  }

  /**
   * Handle device announcement
   */
  private async handleDeviceAnnounce(message: DeviceAnnounceMessage): Promise<void> {
    this.logger.debug('Device announced', {
      deviceId: message.deviceId,
      platform: message.deviceInfo.platform
    });
    
    // Update our knowledge of other devices
    const syncState = this.sessionStates.get(message.sessionId);
    if (syncState) {
      // Merge vector clocks to stay in sync
      syncState.vectorClock = VectorClockManager.merge([
        syncState.vectorClock,
        message.syncState.vectorClock
      ]);
    }
  }

  /**
   * Handle heartbeat
   */
  private async handleHeartbeat(message: AnySyncMessage): Promise<void> {
    // Update last seen for device
    this.logger.debug('Heartbeat received', { 
      from: message.deviceId 
    });
  }

  /**
   * Detect conflicts in received messages
   */
  private async detectConflicts(response: SyncResponseMessage): Promise<any[]> {
    const conflicts: any[] = [];
    
    // Group messages by their causal relationships
    const groups = ConflictResolver.groupByCausality(
      response.messages.map(m => ({
        id: m.message.sender_wallet,
        vectorClock: m.vectorClock
      }))
    );

    // Check each group for conflicts
    for (const group of groups) {
      if (group.length > 1) {
        const vectorClocks = group.map(g => g.vectorClock);
        if (ConflictResolver.hasConflict(vectorClocks)) {
          conflicts.push({
            messages: response.messages.filter(m => 
              group.some(g => g.id === m.message.sender_wallet)
            )
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts based on configured strategy
   */
  private async resolveConflicts(sessionId: string, conflicts: any[]): Promise<void> {
    for (const conflict of conflicts) {
      const resolved = ConflictResolver.resolveConflict(
        conflict.messages.map((m: any) => ({
          message: m.message,
          vectorClock: m.vectorClock,
          deviceId: m.originalDeviceId,
          timestamp: new Date(m.message.timestamp).getTime()
        })),
        this.config.conflictResolutionStrategy
      );

      if (resolved) {
        await this.storage.storeMessage(sessionId, resolved, this.deviceId);
        this.stats.totalConflictsResolved++;
      }
    }
  }

  /**
   * Initialize sync state for a session
   */
  private async initializeSyncState(sessionId: string): Promise<SessionSyncState> {
    // Try to load from database
    if (this.database) {
      const result = await this.database.getSyncState(sessionId, this.deviceId);
      if (result.success && result.data) {
        return {
          sessionId,
          deviceId: this.deviceId,
          lastSyncedSequence: result.data.lastSyncedSequence,
          lastKnownSequence: result.data.lastKnownSequence,
          vectorClock: result.data.syncVector,
          pendingMessageIds: result.data.pendingMessageIds,
          lastSyncAt: result.data.lastSyncAt,
          isSyncing: false,
          syncErrors: 0
        };
      }
    }

    // Create new sync state
    return {
      sessionId,
      deviceId: this.deviceId,
      lastSyncedSequence: 0,
      lastKnownSequence: 0,
      vectorClock: VectorClockManager.create(this.deviceId),
      pendingMessageIds: [],
      lastSyncAt: new Date(),
      isSyncing: false,
      syncErrors: 0
    };
  }

  /**
   * Save sync state to database
   */
  private async saveSyncState(syncState: SessionSyncState): Promise<void> {
    if (!this.database) return;

    await this.database.updateSyncState({
      sessionId: syncState.sessionId,
      deviceId: syncState.deviceId,
      lastSyncedSequence: syncState.lastSyncedSequence,
      lastKnownSequence: syncState.lastKnownSequence,
      syncVector: syncState.vectorClock,
      pendingMessageIds: syncState.pendingMessageIds
    });
  }

  /**
   * Load sync states from database
   */
  private async loadSyncStates(): Promise<void> {
    // This would load all active sync states from the database
    // For now, states are loaded on-demand when starting sync
  }

  /**
   * Start periodic sync for a session
   */
  private startPeriodicSync(sessionId: string): void {
    // Clear existing interval if any
    const existing = this.syncIntervals.get(sessionId);
    if (existing) {
      clearInterval(existing);
    }

    // Set up new interval
    const interval = setInterval(() => {
      this.performSync(sessionId);
    }, this.config.syncIntervalMs);

    this.syncIntervals.set(sessionId, interval);
  }

  /**
   * Announce device presence
   */
  private async announceDevice(sessionId: string): Promise<void> {
    const syncState = this.sessionStates.get(sessionId);
    if (!syncState || !this.transport) return;

    const announceMessage = SyncMessageFactory.createDeviceAnnounce(
      sessionId,
      this.deviceId,
      {
        platform: this.platform,
        version: '1.0.0',
        lastSeenAt: Date.now()
      },
      syncState
    );

    await this.transport.sendSyncMessage(announceMessage);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [sessionId, syncState] of this.sessionStates) {
        if (this.transport && this.transport.isConnected()) {
          const heartbeat = SyncMessageFactory.createHeartbeat(
            sessionId,
            this.deviceId,
            syncState.lastKnownSequence,
            syncState.vectorClock
          );
          
          this.transport.sendSyncMessage(heartbeat);
        }
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Generate device ID
   */
  private generateDeviceId(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('solconnect_device_id');
      if (stored) return stored;
      
      const generated = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      window.localStorage.setItem('solconnect_device_id', generated);
      return generated;
    }
    
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect platform
   */
  private detectPlatform(): string {
    if (typeof window !== 'undefined') {
      return 'web';
    } else if (typeof global !== 'undefined' && global.nativeCallSync) {
      return 'mobile';
    } else {
      return 'node';
    }
  }

  /**
   * Register event handlers
   */
  on<K extends keyof SyncEvents>(event: K, handler: SyncEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Get sync state for a session
   */
  getSyncState(sessionId: string): SessionSyncState | undefined {
    return this.sessionStates.get(sessionId);
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    // Stop all periodic syncs
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }
    this.syncIntervals.clear();

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Save all sync states
    for (const syncState of this.sessionStates.values()) {
      await this.saveSyncState(syncState);
    }

    this.sessionStates.clear();
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(config?: Partial<SyncProtocolConfig>): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager(config);
  }
  return syncManagerInstance;
} 