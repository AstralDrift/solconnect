import { DatabaseService } from '../database/DatabaseService';
import { Pool } from 'pg';

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  
  return { Pool: jest.fn(() => mockPool) };
});

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DatabaseService('postgresql://test/test_db');
    mockPool = (Pool as jest.MockedClass<typeof Pool>).mock.results[0].value;
    mockClient = { query: jest.fn(), release: jest.fn() };
    mockPool.connect.mockResolvedValue(mockClient);
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      
      const result = await service.connect();
      
      expect(result.success).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));
      
      const result = await service.connect();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Connection failed');
    });
  });

  describe('createOrUpdateUser', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: '123',
        wallet_address: 'ABC123',
        display_name: 'Alice',
        created_at: new Date(),
        is_active: true,
      };
      
      mockPool.query.mockResolvedValue({ rows: [mockUser] });
      
      const result = await service.createOrUpdateUser('ABC123', 'Alice');
      
      expect(result.success).toBe(true);
      expect(result.data?.walletAddress).toBe('ABC123');
      expect(result.data?.displayName).toBe('Alice');
    });

    it('should handle database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));
      
      const result = await service.createOrUpdateUser('ABC123', 'Alice');
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('saveMessage', () => {
    it('should save a message successfully', async () => {
      const mockMessage = {
        id: '456',
        message_id: 'MSG123',
        session_id: 'SESSION123',
        sender_address: 'SENDER123',
        content: 'Hello',
        content_type: 'text',
        signature: 'SIG123',
        timestamp: new Date(),
      };
      
      mockPool.query.mockResolvedValue({ rows: [mockMessage] });
      
      const result = await service.saveMessage({
        messageId: 'MSG123',
        sessionId: 'SESSION123',
        senderAddress: 'SENDER123',
        content: 'Hello',
        signature: 'SIG123',
        timestamp: new Date(),
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.messageId).toBe('MSG123');
      expect(result.data?.content).toBe('Hello');
    });

    it('should handle session not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      
      const result = await service.saveMessage({
        messageId: 'MSG123',
        sessionId: 'INVALID_SESSION',
        senderAddress: 'SENDER123',
        content: 'Hello',
        signature: 'SIG123',
        timestamp: new Date(),
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Session not found');
    });
  });

  describe('getSessionMessages', () => {
    it('should retrieve messages in chronological order', async () => {
      const mockMessages = [
        {
          id: '1',
          message_id: 'MSG1',
          content: 'First',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          message_id: 'MSG2',
          content: 'Second',
          timestamp: new Date('2024-01-02'),
        },
      ];
      
      // Database returns in reverse order
      mockPool.query.mockResolvedValue({ rows: [...mockMessages].reverse() });
      
      const result = await service.getSessionMessages('SESSION123');
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].content).toBe('First'); // Chronological order
      expect(result.data?.[1].content).toBe('Second');
    });

    it('should handle pagination with beforeTimestamp', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      
      const beforeDate = new Date();
      await service.getSessionMessages('SESSION123', 10, beforeDate);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND m.timestamp < $2'),
        expect.arrayContaining(['SESSION123', beforeDate, 10])
      );
    });
  });

  describe('createSession', () => {
    it('should create session and add creator as participant', async () => {
      const mockSession = {
        id: 'UUID123',
        session_id: 'SESSION123',
        created_by: 'CREATOR123',
        created_at: new Date(),
        is_active: true,
      };
      
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSession] }) // INSERT session
        .mockResolvedValueOnce({}) // INSERT participant
        .mockResolvedValueOnce({}); // COMMIT
      
      const result = await service.createSession('SESSION123', 'CREATOR123');
      
      expect(result.success).toBe(true);
      expect(result.data?.sessionId).toBe('SESSION123');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')); // INSERT session fails
      
      const result = await service.createSession('SESSION123', 'CREATOR123');
      
      expect(result.success).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('recordMessageMetrics', () => {
    it('should record metrics successfully', async () => {
      mockPool.query.mockResolvedValue({});
      
      const result = await service.recordMessageMetrics();
      
      expect(result.success).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO message_metrics')
      );
    });
  });

  describe('disconnect', () => {
    it('should close the pool', async () => {
      await service.disconnect();
      
      expect(mockPool.end).toHaveBeenCalled();
    });
  });
}); 