import { Pool, PoolClient } from 'pg';
import { Result } from '@/types';
import { Logger } from '../monitoring/Logger';

export interface MessageRecord {
  id: string;
  messageId: string;
  sessionId: string;
  senderAddress: string;
  recipientAddress?: string;
  content: string;
  contentType: string;
  signature: string;
  timestamp: Date;
  deliveredAt?: Date;
  readAt?: Date;
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

  // Message operations
  async saveMessage(message: {
    messageId: string;
    sessionId: string;
    senderAddress: string;
    recipientAddress?: string;
    content: string;
    contentType?: string;
    signature: string;
    timestamp: Date;
  }): Promise<Result<MessageRecord>> {
    try {
      const query = `
        INSERT INTO messages (
          message_id, session_id, sender_address, recipient_address,
          content, content_type, signature, timestamp
        )
        SELECT 
          $1, cs.id, $3, $4, $5, $6, $7, $8
        FROM chat_sessions cs
        WHERE cs.session_id = $2
        RETURNING *
      `;
      
      const values = [
        message.messageId,
        message.sessionId,
        message.senderAddress,
        message.recipientAddress,
        message.content,
        message.contentType || 'text',
        message.signature,
        message.timestamp
      ];
      
      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        return { 
          success: false, 
          error: new Error('Session not found')
        };
      }
      
      return { success: true, data: this.mapMessageRecord(result.rows[0]) };
    } catch (error) {
      this.logger.error('Failed to save message', error);
      return { 
        success: false, 
        error: new Error(`Failed to save message: ${error.message}`)
      };
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
      
      query += ' ORDER BY m.timestamp DESC LIMIT $' + (values.length + 1);
      values.push(limit);
      
      const result = await this.pool.query(query, values);
      const messages = result.rows.map(row => this.mapMessageRecord(row));
      
      return { success: true, data: messages.reverse() }; // Return in chronological order
    } catch (error) {
      this.logger.error('Failed to get session messages', error);
      return { 
        success: false, 
        error: new Error(`Failed to get session messages: ${error.message}`)
      };
    }
  }

  async markMessageDelivered(messageId: string, recipientAddress: string): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO message_delivery (message_id, recipient_address, status, delivered_at)
        SELECT id, $2, 'delivered', NOW()
        FROM messages WHERE message_id = $1
        ON CONFLICT (message_id, recipient_address)
        DO UPDATE SET status = 'delivered', delivered_at = NOW()
      `;
      
      await this.pool.query(query, [messageId, recipientAddress]);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to mark message delivered', error);
      return { 
        success: false, 
        error: new Error(`Failed to mark message delivered: ${error.message}`)
      };
    }
  }

  async markMessageRead(messageId: string, recipientAddress: string): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO message_delivery (message_id, recipient_address, status, read_at)
        SELECT id, $2, 'read', NOW()
        FROM messages WHERE message_id = $1
        ON CONFLICT (message_id, recipient_address)
        DO UPDATE SET status = 'read', read_at = NOW()
      `;
      
      await this.pool.query(query, [messageId, recipientAddress]);
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to mark message read', error);
      return { 
        success: false, 
        error: new Error(`Failed to mark message read: ${error.message}`)
      };
    }
  }

  // Analytics operations
  async recordMessageMetrics(): Promise<Result<void>> {
    try {
      const query = `
        INSERT INTO message_metrics (date, hour, total_messages, unique_senders, unique_sessions)
        SELECT 
          CURRENT_DATE,
          EXTRACT(HOUR FROM NOW()),
          COUNT(*),
          COUNT(DISTINCT sender_address),
          COUNT(DISTINCT session_id)
        FROM messages
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
        ON CONFLICT (date, hour) 
        DO UPDATE SET 
          total_messages = EXCLUDED.total_messages,
          unique_senders = EXCLUDED.unique_senders,
          unique_sessions = EXCLUDED.unique_sessions
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
      lastMessageAt: row.last_message_at
    };
  }

  private mapMessageRecord(row: any): MessageRecord {
    return {
      id: row.id,
      messageId: row.message_id,
      sessionId: row.session_id,
      senderAddress: row.sender_address,
      recipientAddress: row.recipient_address,
      content: row.content,
      contentType: row.content_type,
      signature: row.signature,
      timestamp: row.timestamp,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      metadata: row.metadata
    };
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