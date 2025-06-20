import { Pool, PoolClient } from 'pg';
import { Result } from '@/types';
import { Logger } from '../monitoring/Logger';

export interface MessageRecord {
  id: string;
  messageId: string;
  sessionId: string;
  senderAddress: string;
  recipientAddress?: string;
  deviceId: string;
  sequenceNumber: number;
  content: string;
  contentType: string;
  signature: string;
  timestamp: Date;
  serverTimestamp: Date;
  deliveredAt?: Date;
  readAt?: Date;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'failed';
  metadata?: Record<string, any>;
}

export interface UserRecord {
  id: string;
  walletAddress: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  lastSeenAt?: Date;
  isActive: boolean;
}

export interface SessionRecord {
  id: string;
  sessionId: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
  participantCount?: number;
  lastMessageAt?: Date;
  lastSequenceNumber?: number;
}

export interface DeviceRecord {
  id: string;
  deviceId: string;
  walletAddress: string;
  deviceName?: string;
  platform?: string;
  userAgent?: string;
  lastSeenAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncStateRecord {
  id: string;
  sessionId: string;
  deviceId: string;
  lastSyncedSequence: number;
  lastKnownSequence: number;
  syncVector: Record<string, number>;
  pendingMessageIds: string[];
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseService {
  private pool: Pool;
  private logger = new Logger('DatabaseService');

  constructor(connectionString?: string) {
    const dbUrl = connectionString || process.env.DATABASE_URL || 'postgresql://localhost/solconnect_dev';
    
    this.pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected database error', err);
    });
  }

  async connect(): Promise<Result<void>> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.logger.info('Database connected successfully');
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Database connection failed', error);
      return { 
        success: false, 
        error: new Error(`Database connection failed: ${error.message}`)
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.logger.info('Database disconnected');
  }

  // User operations
  async createOrUpdateUser(walletAddress: string, displayName?: string): Promise<Result<UserRecord>> {
    try {
      const query = `
        INSERT INTO users (wallet_address, display_name, last_seen_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (wallet_address) 
        DO UPDATE SET 
          display_name = COALESCE($2, users.display_name),
          last_seen_at = NOW()
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [walletAddress, displayName]);
      return { success: true, data: this.mapUserRecord(result.rows[0]) };
    } catch (error) {
      this.logger.error('Failed to create/update user', error);
      return { 
        success: false, 
        error: new Error(`Failed to create/update user: ${error.message}`)
      };
    }
  }

  async getUser(walletAddress: string): Promise<Result<UserRecord | null>> {
    try {
      const query = 'SELECT * FROM users WHERE wallet_address = $1';
      const result = await this.pool.query(query, [walletAddress]);
      
      if (result.rows.length === 0) {
        return { success: true, data: null };
      }
      
      return { success: true, data: this.mapUserRecord(result.rows[0]) };
    } catch (error) {
      this.logger.error('Failed to get user', error);
      return { 
        success: false, 
        error: new Error(`Failed to get user: ${error.message}`)
      };
    }
  }

  // Device registry operations
  async registerDevice(device: {
    deviceId: string;
    walletAddress: string;
    deviceName?: string;
    platform?: string;
    userAgent?: string;
  }): Promise<Result<DeviceRecord>> {
    try {
      const query = `
        INSERT INTO device_registry (device_id, wallet_address, device_name, platform, user_agent, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (device_id) 
        DO UPDATE SET 
          device_name = COALESCE($3, device_registry.device_name),
          platform = COALESCE($4, device_registry.platform),
          user_agent = COALESCE($5, device_registry.user_agent),
          last_seen_at = NOW(),
          is_active = true,
          updated_at = NOW()
        RETURNING *
      `;
      
      const values = [
        device.deviceId,
        device.walletAddress,
        device.deviceName,
        device.platform,
        device.userAgent
      ];
      
      const result = await this.pool.query(query, values);
      return { success: true, data: this.mapDeviceRecord(result.rows[0]) };
    } catch (error) {
      this.logger.error('Failed to register device', error);
      return { 
        success: false, 
        error: new Error(`Failed to register device: ${error.message}`)
      };
    }
  }

  async getDevicesForWallet(walletAddress: string): Promise<Result<DeviceRecord[]>> {
    try {
      const query = `
        SELECT * FROM device_registry 
        WHERE wallet_address = $1 AND is_active = true
        ORDER BY last_seen_at DESC
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      const devices = result.rows.map(row => this.mapDeviceRecord(row));
      
      return { success: true, data: devices };
    } catch (error) {
      this.logger.error('Failed to get devices for wallet', error);
      return { 
        success: false, 
        error: new Error(`Failed to get devices for wallet: ${error.message}`)
      };
    }
  }

  async updateDeviceLastSeen(deviceId: string): Promise<Result<void>> {
    try {
      const query = `
        UPDATE device_registry 
        SET last_seen_at = NOW(), updated_at = NOW()
        WHERE device_id = $1
      `;
      
      await this.pool.query(query, [deviceId]);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to update device last seen', error);
      return { 
        success: false, 
        error: new Error(`Failed to update device last seen: ${error.message}`)
      };
    }
  }

  // Session operations
  async createSession(sessionId: string, createdBy: string): Promise<Result<SessionRecord>> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create session
      const sessionQuery = `
        INSERT INTO chat_sessions (session_id, created_by)
        VALUES ($1, $2)
        RETURNING *
      `;
      const sessionResult = await client.query(sessionQuery, [sessionId, createdBy]);
      const session = sessionResult.rows[0];
      
      // Add creator as participant
      const participantQuery = `
        INSERT INTO session_participants (session_id, wallet_address)
        VALUES ($1, $2)
      `;
      await client.query(participantQuery, [session.id, createdBy]);
      
      await client.query('COMMIT');
      
      return { success: true, data: this.mapSessionRecord(session) };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create session', error);
      return { 
        success: false, 
        error: new Error(`Failed to create session: ${error.message}`)
      };
    } finally {
      client.release();
    }
  }

  async addSessionParticipant(sessionId: string, walletAddress: string): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO session_participants (session_id, wallet_address)
        SELECT id, $2 FROM chat_sessions WHERE session_id = $1
        ON CONFLICT (session_id, wallet_address) 
        DO UPDATE SET is_active = true, left_at = NULL
      `;
      
      await this.pool.query(query, [sessionId, walletAddress]);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to add session participant', error);
      return { 
        success: false, 
        error: new Error(`Failed to add session participant: ${error.message}`)
      };
    }
  }

  // Enhanced message operations with sequence numbers and device tracking
  async saveMessage(message: {
    messageId: string;
    sessionId: string;
    senderAddress: string;
    recipientAddress?: string;
    deviceId: string;
    content: string;
    contentType?: string;
    signature: string;
    timestamp: Date;
  }): Promise<Result<MessageRecord>> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get next sequence number for the session
      const sequenceQuery = 'SELECT get_next_sequence_number($1) as sequence_number';
      const sessionResult = await this.pool.query('SELECT id FROM chat_sessions WHERE session_id = $1', [message.sessionId]);
      
      if (sessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { 
          success: false, 
          error: new Error('Session not found')
        };
      }
      
      const sessionUuid = sessionResult.rows[0].id;
      const sequenceResult = await client.query(sequenceQuery, [sessionUuid]);
      const sequenceNumber = sequenceResult.rows[0].sequence_number;
      
      // Insert message with sequence number
      const messageQuery = `
        INSERT INTO messages (
          message_id, session_id, sender_address, recipient_address,
          device_id, sequence_number, content, content_type, signature, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        message.messageId,
        sessionUuid,
        message.senderAddress,
        message.recipientAddress,
        message.deviceId,
        sequenceNumber,
        message.content,
        message.contentType || 'text',
        message.signature,
        message.timestamp
      ];
      
      const result = await client.query(messageQuery, values);
      
      await client.query('COMMIT');
      
      return { success: true, data: this.mapMessageRecord(result.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to save message', error);
      return { 
        success: false, 
        error: new Error(`Failed to save message: ${error.message}`)
      };
    } finally {
      client.release();
    }
  }

  async getSessionMessages(
    sessionId: string, 
    limit: number = 50, 
    beforeTimestamp?: Date
  ): Promise<Result<MessageRecord[]>> {
    try {
      let query = `
        SELECT m.* 
        FROM messages m
        JOIN chat_sessions cs ON m.session_id = cs.id
        WHERE cs.session_id = $1
      `;
      
      const values: any[] = [sessionId];
      
      if (beforeTimestamp) {
        query += ' AND m.timestamp < $2';
        values.push(beforeTimestamp);
      }
      
      query += ' ORDER BY m.sequence_number ASC LIMIT $' + (values.length + 1);
      values.push(limit);
      
      const result = await this.pool.query(query, values);
      const messages = result.rows.map(row => this.mapMessageRecord(row));
      
      return { success: true, data: messages };
    } catch (error) {
      this.logger.error('Failed to get session messages', error);
      return { 
        success: false, 
        error: new Error(`Failed to get session messages: ${error.message}`)
      };
    }
  }

  async getMessagesWithSync(sessionId: string, limit: number = 50): Promise<Result<MessageRecord[]>> {
    try {
      const query = `
        SELECT m.* 
        FROM messages m
        JOIN chat_sessions cs ON m.session_id = cs.id
        WHERE cs.session_id = $1
        ORDER BY m.sequence_number ASC 
        LIMIT $2
      `;
      
      const result = await this.pool.query(query, [sessionId, limit]);
      const messages = result.rows.map(row => this.mapMessageRecord(row));
      
      return { success: true, data: messages };
    } catch (error) {
      this.logger.error('Failed to get messages with sync info', error);
      return { 
        success: false, 
        error: new Error(`Failed to get messages with sync info: ${error.message}`)
      };
    }
  }

  async getMessageById(messageId: string): Promise<Result<MessageRecord | null>> {
    try {
      const query = 'SELECT * FROM messages WHERE message_id = $1';
      const result = await this.pool.query(query, [messageId]);
      
      if (result.rows.length === 0) {
        return { success: true, data: null };
      }
      
      return { success: true, data: this.mapMessageRecord(result.rows[0]) };
    } catch (error) {
      this.logger.error('Failed to get message by ID', error);
      return { 
        success: false, 
        error: new Error(`Failed to get message by ID: ${error.message}`)
      };
    }
  }

  async getMessagesSinceSequence(sessionId: string, sinceSequence: number): Promise<Result<MessageRecord[]>> {
    try {
      const query = `
        SELECT m.* 
        FROM messages m
        JOIN chat_sessions cs ON m.session_id = cs.id
        WHERE cs.session_id = $1 AND m.sequence_number > $2
        ORDER BY m.sequence_number ASC
      `;
      
      const result = await this.pool.query(query, [sessionId, sinceSequence]);
      const messages = result.rows.map(row => this.mapMessageRecord(row));
      
      return { success: true, data: messages };
    } catch (error) {
      this.logger.error('Failed to get messages since sequence', error);
      return { 
        success: false, 
        error: new Error(`Failed to get messages since sequence: ${error.message}`)
      };
    }
  }

  // Sync state operations
  async getSyncState(sessionId: string, deviceId: string): Promise<Result<SyncStateRecord | null>> {
    try {
      const query = `
        SELECT ss.* 
        FROM sync_state ss
        JOIN chat_sessions cs ON ss.session_id = cs.id
        WHERE cs.session_id = $1 AND ss.device_id = $2
      `;
      
      const result = await this.pool.query(query, [sessionId, deviceId]);
      
      if (result.rows.length === 0) {
        return { success: true, data: null };
      }
      
      return { success: true, data: this.mapSyncStateRecord(result.rows[0]) };
    } catch (error) {
      this.logger.error('Failed to get sync state', error);
      return { 
        success: false, 
        error: new Error(`Failed to get sync state: ${error.message}`)
      };
    }
  }

  async updateSyncState(syncState: {
    sessionId: string;
    deviceId: string;
    lastSyncedSequence: number;
    lastKnownSequence: number;
    syncVector: Record<string, number>;
    pendingMessageIds: string[];
  }): Promise<Result<SyncStateRecord>> {
    try {
      const query = `
        INSERT INTO sync_state (
          session_id, device_id, last_synced_sequence, last_known_sequence, 
          sync_vector, pending_message_ids, last_sync_at
        )
        SELECT cs.id, $2, $3, $4, $5, $6, NOW()
        FROM chat_sessions cs WHERE cs.session_id = $1
        ON CONFLICT (session_id, device_id) 
        DO UPDATE SET 
          last_synced_sequence = $3,
          last_known_sequence = $4,
          sync_vector = $5,
          pending_message_ids = $6,
          last_sync_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `;
      
      const values = [
        syncState.sessionId,
        syncState.deviceId,
        syncState.lastSyncedSequence,
        syncState.lastKnownSequence,
        JSON.stringify(syncState.syncVector),
        syncState.pendingMessageIds
      ];
      
      const result = await this.pool.query(query, values);
      return { success: true, data: this.mapSyncStateRecord(result.rows[0]) };
    } catch (error) {
      this.logger.error('Failed to update sync state', error);
      return { 
        success: false, 
        error: new Error(`Failed to update sync state: ${error.message}`)
      };
    }
  }

  async markMessageDelivered(messageId: string, recipientAddress: string, deviceId?: string): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO message_delivery (message_id, recipient_address, device_id, status, delivered_at)
        SELECT id, $2, $3, 'delivered', NOW()
        FROM messages WHERE message_id = $1
        ON CONFLICT (message_id, recipient_address, device_id)
        DO UPDATE SET status = 'delivered', delivered_at = NOW()
      `;
      
      await this.pool.query(query, [messageId, recipientAddress, deviceId]);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to mark message delivered', error);
      return { 
        success: false, 
        error: new Error(`Failed to mark message delivered: ${error.message}`)
      };
    }
  }

  async markMessageRead(messageId: string, recipientAddress: string, deviceId?: string): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO message_delivery (message_id, recipient_address, device_id, status, read_at)
        SELECT id, $2, $3, 'read', NOW()
        FROM messages WHERE message_id = $1
        ON CONFLICT (message_id, recipient_address, device_id)
        DO UPDATE SET status = 'read', read_at = NOW()
      `;
      
      await this.pool.query(query, [messageId, recipientAddress, deviceId]);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to mark message read', error);
      return { 
        success: false, 
        error: new Error(`Failed to mark message read: ${error.message}`)
      };
    }
  }

  /**
   * Update message status with timestamp
   */
  async updateMessageStatus(
    sessionId: string, 
    messageId: string, 
    status: 'delivered' | 'read',
    timestamp?: number
  ): Promise<Result<void>> {
    try {
      const sessionResult = await this.pool.query(
        'SELECT id FROM chat_sessions WHERE session_id = $1',
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        return { 
          success: false, 
          error: new Error('Session not found')
        };
      }
      
      const sessionUuid = sessionResult.rows[0].id;
      const timestampDate = timestamp ? new Date(timestamp) : new Date();
      
      if (status === 'delivered') {
        const query = `
          UPDATE messages 
          SET delivered_at = $1
          WHERE session_id = $2 AND message_id = $3 AND delivered_at IS NULL
        `;
        await this.pool.query(query, [timestampDate, sessionUuid, messageId]);
      } else if (status === 'read') {
        const query = `
          UPDATE messages 
          SET read_at = $1, delivered_at = COALESCE(delivered_at, $1)
          WHERE session_id = $2 AND message_id = $3 AND read_at IS NULL
        `;
        await this.pool.query(query, [timestampDate, sessionUuid, messageId]);
      }
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to update message status', error);
      return { 
        success: false, 
        error: new Error(`Failed to update message status: ${error.message}`)
      };
    }
  }

  // Analytics operations
  async recordMessageMetrics(): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO message_metrics (
          date, hour, total_messages, unique_senders, unique_sessions,
          offline_messages, sync_conflicts
        )
        SELECT 
          CURRENT_DATE,
          EXTRACT(HOUR FROM NOW()),
          COUNT(*),
          COUNT(DISTINCT sender_address),
          COUNT(DISTINCT session_id),
          COUNT(*) FILTER (WHERE sync_status = 'pending'),
          COUNT(*) FILTER (WHERE sync_status = 'conflict')
        FROM messages
        WHERE server_timestamp >= NOW() - INTERVAL '1 hour'
        ON CONFLICT (date, hour) 
        DO UPDATE SET 
          total_messages = EXCLUDED.total_messages,
          unique_senders = EXCLUDED.unique_senders,
          unique_sessions = EXCLUDED.unique_sessions,
          offline_messages = EXCLUDED.offline_messages,
          sync_conflicts = EXCLUDED.sync_conflicts
      `;
      
      await this.pool.query(query);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to record message metrics', error);
      return { 
        success: false, 
        error: new Error(`Failed to record message metrics: ${error.message}`)
      };
    }
  }

  // Helper methods
  private mapUserRecord(row: any): UserRecord {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      isActive: row.is_active
    };
  }

  private mapSessionRecord(row: any): SessionRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      isActive: row.is_active,
      participantCount: row.participant_count,
      lastMessageAt: row.last_message_at,
      lastSequenceNumber: row.last_sequence_number
    };
  }

  private mapMessageRecord(row: any): MessageRecord {
    return {
      id: row.id,
      messageId: row.message_id,
      sessionId: row.session_id,
      senderAddress: row.sender_address,
      recipientAddress: row.recipient_address,
      deviceId: row.device_id,
      sequenceNumber: row.sequence_number,
      content: row.content,
      contentType: row.content_type,
      signature: row.signature,
      timestamp: row.timestamp,
      serverTimestamp: row.server_timestamp,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      syncStatus: row.sync_status,
      metadata: row.metadata
    };
  }

  private mapDeviceRecord(row: any): DeviceRecord {
    return {
      id: row.id,
      deviceId: row.device_id,
      walletAddress: row.wallet_address,
      deviceName: row.device_name,
      platform: row.platform,
      userAgent: row.user_agent,
      lastSeenAt: row.last_seen_at,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapSyncStateRecord(row: any): SyncStateRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      deviceId: row.device_id,
      lastSyncedSequence: row.last_synced_sequence,
      lastKnownSequence: row.last_known_sequence,
      syncVector: row.sync_vector || {},
      pendingMessageIds: row.pending_message_ids || [],
      lastSyncAt: new Date(row.last_sync_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  // ===================================================================
  // SEARCH FUNCTIONALITY
  // ===================================================================

  /**
   * Index a message for search (temporarily store decrypted content)
   */
  async indexMessageForSearch(messageId: string, decryptedContent: string, ttlHours: number = 24): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO message_search_content (message_id, decrypted_content, expires_at)
        SELECT id, $2, NOW() + INTERVAL '${ttlHours} hours'
        FROM messages WHERE message_id = $1
        ON CONFLICT (message_id) 
        DO UPDATE SET 
          decrypted_content = $2,
          expires_at = NOW() + INTERVAL '${ttlHours} hours'
      `;
      
      await this.pool.query(query, [messageId, decryptedContent]);
      
      this.logger.debug('Message indexed for search', { messageId });
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to index message for search', error);
      return { 
        success: false, 
        error: new Error(`Failed to index message for search: ${error.message}`)
      };
    }
  }

  /**
   * Remove a message from search index
   */
  async removeFromSearchIndex(messageId: string): Promise<Result<void>> {
    try {
      const query = `
        DELETE FROM message_search_content 
        WHERE message_id = (SELECT id FROM messages WHERE message_id = $1)
      `;
      
      await this.pool.query(query, [messageId]);
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to remove message from search index', error);
      return { 
        success: false, 
        error: new Error(`Failed to remove message from search index: ${error.message}`)
      };
    }
  }

  /**
   * Search messages using PostgreSQL full-text search
   * Note: Messages must be indexed first using indexMessageForSearch
   */
  async searchMessages(params: {
    userWallet: string;
    searchQuery: string;
    sessionIds?: string[];
    senderAddresses?: string[];
    dateRange?: { start: Date; end: Date };
    limit?: number;
    offset?: number;
  }): Promise<Result<{
    results: Array<{
      messageId: string;
      sessionId: string;
      senderAddress: string;
      timestamp: Date;
      relevanceScore: number;
      headline: string;
    }>;
    totalCount: number;
  }>> {
    const startTime = Date.now();
    
    try {
      // Convert session IDs to UUIDs
      let sessionUuids: string[] | null = null;
      if (params.sessionIds && params.sessionIds.length > 0) {
        const sessionQuery = `
          SELECT id FROM chat_sessions 
          WHERE session_id = ANY($1::text[])
        `;
        const sessionResult = await this.pool.query(sessionQuery, [params.sessionIds]);
        sessionUuids = sessionResult.rows.map(row => row.id);
      }

      // Execute search function
      const searchQuery = `
        SELECT 
          m.message_id,
          cs.session_id,
          sr.sender_address,
          sr.timestamp,
          sr.relevance_score,
          sr.headline
        FROM search_messages($1, $2, $3, $4, $5, $6, $7, $8) sr
        JOIN messages m ON sr.message_id = m.id
        JOIN chat_sessions cs ON sr.session_id = cs.id
      `;
      
      const values = [
        params.userWallet,
        params.searchQuery,
        sessionUuids,
        params.senderAddresses || null,
        params.dateRange?.start || null,
        params.dateRange?.end || null,
        params.limit || 50,
        params.offset || 0
      ];
      
      const result = await this.pool.query(searchQuery, values);
      
      // Get total count
      const countQuery = `
        WITH user_sessions AS (
          SELECT DISTINCT cs.id
          FROM chat_sessions cs
          JOIN session_participants sp ON cs.id = sp.session_id
          WHERE sp.wallet_address = $1 AND sp.is_active = true
        )
        SELECT COUNT(DISTINCT m.id) as total
        FROM messages m
        JOIN message_search_content msc ON m.id = msc.message_id
        JOIN user_sessions us ON m.session_id = us.id
        WHERE msc.content_tokens @@ websearch_to_tsquery('solconnect_search', $2)
      `;
      
      const countResult = await this.pool.query(countQuery, [params.userWallet, params.searchQuery]);
      const totalCount = parseInt(countResult.rows[0].total);
      
      // Record search history
      await this.recordSearchHistory({
        userWallet: params.userWallet,
        searchQuery: params.searchQuery,
        filters: {
          sessionIds: params.sessionIds,
          senderAddresses: params.senderAddresses,
          dateRange: params.dateRange
        },
        resultCount: result.rows.length,
        searchDuration: Date.now() - startTime
      });
      
      return {
        success: true,
        data: {
          results: result.rows.map(row => ({
            messageId: row.message_id,
            sessionId: row.session_id,
            senderAddress: row.sender_address,
            timestamp: new Date(row.timestamp),
            relevanceScore: row.relevance_score,
            headline: row.headline
          })),
          totalCount
        }
      };
    } catch (error) {
      this.logger.error('Failed to search messages', error);
      return { 
        success: false, 
        error: new Error(`Failed to search messages: ${error.message}`)
      };
    }
  }

  /**
   * Record search history for analytics and suggestions
   */
  async recordSearchHistory(params: {
    userWallet: string;
    searchQuery: string;
    filters: any;
    resultCount: number;
    searchDuration: number;
  }): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO search_history (
          user_wallet, search_query, filters, result_count, search_duration_ms
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      
      await this.pool.query(query, [
        params.userWallet,
        params.searchQuery,
        JSON.stringify(params.filters),
        params.resultCount,
        params.searchDuration
      ]);
      
      // Update search analytics
      await this.updateSearchAnalytics();
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to record search history', error);
      // Don't fail the search if history recording fails
      return { success: true, data: undefined };
    }
  }

  /**
   * Get search history for a user
   */
  async getSearchHistory(userWallet: string, limit: number = 20): Promise<Result<Array<{
    searchQuery: string;
    filters: any;
    resultCount: number;
    executedAt: Date;
  }>>> {
    try {
      const query = `
        SELECT search_query, filters, result_count, executed_at
        FROM search_history
        WHERE user_wallet = $1
        ORDER BY executed_at DESC
        LIMIT $2
      `;
      
      const result = await this.pool.query(query, [userWallet, limit]);
      
      return {
        success: true,
        data: result.rows.map(row => ({
          searchQuery: row.search_query,
          filters: row.filters,
          resultCount: row.result_count,
          executedAt: new Date(row.executed_at)
        }))
      };
    } catch (error) {
      this.logger.error('Failed to get search history', error);
      return { 
        success: false, 
        error: new Error(`Failed to get search history: ${error.message}`)
      };
    }
  }

  /**
   * Clear search history for a user
   */
  async clearSearchHistory(userWallet: string): Promise<Result<void>> {
    try {
      const query = 'DELETE FROM search_history WHERE user_wallet = $1';
      await this.pool.query(query, [userWallet]);
      
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to clear search history', error);
      return { 
        success: false, 
        error: new Error(`Failed to clear search history: ${error.message}`)
      };
    }
  }

  /**
   * Clean up expired search content
   */
  async cleanupExpiredSearchContent(): Promise<Result<number>> {
    try {
      const query = 'SELECT cleanup_expired_search_content() as deleted_count';
      const result = await this.pool.query(query);
      
      const deletedCount = result.rows[0].deleted_count;
      this.logger.info('Cleaned up expired search content', { deletedCount });
      
      return { success: true, data: deletedCount };
    } catch (error) {
      this.logger.error('Failed to cleanup expired search content', error);
      return { 
        success: false, 
        error: new Error(`Failed to cleanup expired search content: ${error.message}`)
      };
    }
  }

  /**
   * Update search analytics (aggregated data)
   */
  private async updateSearchAnalytics(): Promise<void> {
    try {
      const query = `
        INSERT INTO search_analytics (date, hour, total_searches, unique_users, avg_result_count)
        SELECT 
          CURRENT_DATE,
          EXTRACT(HOUR FROM NOW()),
          COUNT(*),
          COUNT(DISTINCT user_wallet),
          AVG(result_count)
        FROM search_history
        WHERE executed_at >= NOW() - INTERVAL '1 hour'
        ON CONFLICT (date, hour) 
        DO UPDATE SET 
          total_searches = search_analytics.total_searches + 1,
          unique_users = (
            SELECT COUNT(DISTINCT user_wallet) 
            FROM search_history 
            WHERE executed_at >= CURRENT_DATE + INTERVAL '1 hour' * EXTRACT(HOUR FROM NOW())
              AND executed_at < CURRENT_DATE + INTERVAL '1 hour' * (EXTRACT(HOUR FROM NOW()) + 1)
          ),
          avg_result_count = (
            SELECT AVG(result_count) 
            FROM search_history 
            WHERE executed_at >= CURRENT_DATE + INTERVAL '1 hour' * EXTRACT(HOUR FROM NOW())
              AND executed_at < CURRENT_DATE + INTERVAL '1 hour' * (EXTRACT(HOUR FROM NOW()) + 1)
          )
      `;
      
      await this.pool.query(query);
    } catch (error) {
      this.logger.error('Failed to update search analytics', error);
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(userWallet: string, partialQuery: string, limit: number = 5): Promise<Result<string[]>> {
    try {
      const query = `
        SELECT DISTINCT search_query
        FROM search_history
        WHERE user_wallet = $1 
          AND search_query ILIKE $2 || '%'
          AND result_count > 0
        ORDER BY executed_at DESC
        LIMIT $3
      `;
      
      const result = await this.pool.query(query, [userWallet, partialQuery, limit]);
      
      return {
        success: true,
        data: result.rows.map(row => row.search_query)
      };
    } catch (error) {
      this.logger.error('Failed to get search suggestions', error);
      return { 
        success: false, 
        error: new Error(`Failed to get search suggestions: ${error.message}`)
      };
    }
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
} 