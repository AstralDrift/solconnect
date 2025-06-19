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

  describe('Device Registry Operations', () => {
    describe('registerDevice', () => {
      it('should register a new device successfully', async () => {
        const mockDevice = {
          id: 'uuid-123',
          device_id: 'alice-web-001',
          wallet_address: 'ABC123',
          device_name: 'Alice Web Browser',
          platform: 'web',
          created_at: new Date(),
          is_active: true,
        };
        
        mockPool.query.mockResolvedValue({ rows: [mockDevice] });
        
        const result = await service.registerDevice({
          deviceId: 'alice-web-001',
          walletAddress: 'ABC123',
          deviceName: 'Alice Web Browser',
          platform: 'web'
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.deviceId).toBe('alice-web-001');
        expect(result.data?.walletAddress).toBe('ABC123');
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO device_registry'),
          expect.arrayContaining(['alice-web-001', 'ABC123'])
        );
      });

      it('should update existing device on conflict', async () => {
        const mockDevice = {
          id: 'uuid-123',
          device_id: 'alice-web-001',
          wallet_address: 'ABC123',
          device_name: 'Alice Web Browser Updated',
          platform: 'web',
          updated_at: new Date(),
          is_active: true,
        };
        
        mockPool.query.mockResolvedValue({ rows: [mockDevice] });
        
        const result = await service.registerDevice({
          deviceId: 'alice-web-001',
          walletAddress: 'ABC123',
          deviceName: 'Alice Web Browser Updated',
          platform: 'web'
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.deviceName).toBe('Alice Web Browser Updated');
      });

      it('should handle registration errors', async () => {
        mockPool.query.mockRejectedValue(new Error('Device registration failed'));
        
        const result = await service.registerDevice({
          deviceId: 'alice-web-001',
          walletAddress: 'ABC123',
          deviceName: 'Alice Web Browser',
          platform: 'web'
        });
        
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Device registration failed');
      });
    });

    describe('getDevicesForWallet', () => {
      it('should return devices for a wallet', async () => {
        const mockDevices = [
          {
            id: 'uuid-1',
            device_id: 'alice-web-001',
            wallet_address: 'ABC123',
            device_name: 'Alice Web Browser',
            platform: 'web',
            is_active: true,
          },
          {
            id: 'uuid-2',
            device_id: 'alice-mobile-001',
            wallet_address: 'ABC123',
            device_name: 'Alice iPhone',
            platform: 'ios',
            is_active: true,
          }
        ];
        
        mockPool.query.mockResolvedValue({ rows: mockDevices });
        
        const result = await service.getDevicesForWallet('ABC123');
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data?.[0].deviceId).toBe('alice-web-001');
        expect(result.data?.[1].deviceId).toBe('alice-mobile-001');
      });
    });
  });

  describe('Enhanced Message Operations', () => {
    describe('saveMessage with sequence numbers', () => {
      it('should save message with sequence number and device tracking', async () => {
        const mockMessage = {
          id: 'uuid-123',
          message_id: 'msg-123',
          session_id: 'session-uuid',
          sender_address: 'ABC123',
          device_id: 'alice-web-001',
          sequence_number: 1,
          content: 'Encrypted content',
          signature: 'signature123',
          timestamp: new Date(),
          server_timestamp: new Date(),
          sync_status: 'synced',
        };
        
        // Mock sequence number generation
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ get_next_sequence_number: 1 }] })
          .mockResolvedValueOnce({ rows: [mockMessage] });
        
        const result = await service.saveMessage({
          messageId: 'msg-123',
          sessionId: 'session-123',
          senderAddress: 'ABC123',
          deviceId: 'alice-web-001',
          content: 'Encrypted content',
          signature: 'signature123',
          timestamp: new Date()
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.sequenceNumber).toBe(1);
        expect(result.data?.deviceId).toBe('alice-web-001');
        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT get_next_sequence_number($1) as sequence_number',
          expect.any(Array)
        );
      });

      it('should handle sequence number conflicts', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ get_next_sequence_number: 1 }] })
          .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
        
        const result = await service.saveMessage({
          messageId: 'msg-123',
          sessionId: 'session-123',
          senderAddress: 'ABC123',
          deviceId: 'alice-web-001',
          content: 'Encrypted content',
          signature: 'signature123',
          timestamp: new Date()
        });
        
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('unique constraint');
      });
    });

    describe('getMessagesWithSync', () => {
      it('should return messages with sync information', async () => {
        const mockMessages = [
          {
            id: 'uuid-1',
            message_id: 'msg-1',
            session_id: 'session-uuid',
            sender_address: 'ABC123',
            device_id: 'alice-web-001',
            sequence_number: 1,
            content: 'Message 1',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            server_timestamp: new Date('2024-01-01T10:00:01Z'),
            sync_status: 'synced',
          },
          {
            id: 'uuid-2',
            message_id: 'msg-2',
            session_id: 'session-uuid',
            sender_address: 'XYZ456',
            device_id: 'bob-mobile-001',
            sequence_number: 2,
            content: 'Message 2',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            server_timestamp: new Date('2024-01-01T10:01:01Z'),
            sync_status: 'synced',
          }
        ];
        
        mockPool.query.mockResolvedValue({ rows: mockMessages });
        
        const result = await service.getMessagesWithSync('session-123', 10);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data?.[0].sequenceNumber).toBe(1);
        expect(result.data?.[1].sequenceNumber).toBe(2);
        expect(result.data?.[0].deviceId).toBe('alice-web-001');
      });
    });
  });

  describe('Sync State Operations', () => {
    describe('getSyncState', () => {
      it('should return sync state for session and device', async () => {
        const mockSyncState = {
          id: 'uuid-123',
          session_id: 'session-uuid',
          device_id: 'alice-web-001',
          last_synced_sequence: 5,
          last_known_sequence: 7,
          sync_vector: { 'alice-web-001': 5, 'bob-mobile-001': 3 },
          pending_message_ids: ['msg-6', 'msg-7'],
          last_sync_at: new Date(),
        };
        
        mockPool.query.mockResolvedValue({ rows: [mockSyncState] });
        
        const result = await service.getSyncState('session-123', 'alice-web-001');
        
        expect(result.success).toBe(true);
        expect(result.data?.lastSyncedSequence).toBe(5);
        expect(result.data?.lastKnownSequence).toBe(7);
        expect(result.data?.pendingMessageIds).toEqual(['msg-6', 'msg-7']);
      });

      it('should return null if sync state does not exist', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        
        const result = await service.getSyncState('session-123', 'alice-web-001');
        
        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });
    });

    describe('updateSyncState', () => {
      it('should update sync state successfully', async () => {
        const mockUpdatedState = {
          id: 'uuid-123',
          session_id: 'session-uuid',
          device_id: 'alice-web-001',
          last_synced_sequence: 7,
          last_known_sequence: 7,
          sync_vector: { 'alice-web-001': 7, 'bob-mobile-001': 5 },
          pending_message_ids: [],
          last_sync_at: new Date(),
        };
        
        mockPool.query.mockResolvedValue({ rows: [mockUpdatedState] });
        
        const result = await service.updateSyncState({
          sessionId: 'session-123',
          deviceId: 'alice-web-001',
          lastSyncedSequence: 7,
          lastKnownSequence: 7,
          syncVector: { 'alice-web-001': 7, 'bob-mobile-001': 5 },
          pendingMessageIds: []
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.lastSyncedSequence).toBe(7);
        expect(result.data?.pendingMessageIds).toEqual([]);
      });
    });

    describe('getMessagesSinceSequence', () => {
      it('should return messages after a given sequence number', async () => {
        const mockMessages = [
          {
            id: 'uuid-4',
            message_id: 'msg-4',
            sequence_number: 4,
            sender_address: 'ABC123',
            device_id: 'alice-web-001',
            content: 'Message 4',
            timestamp: new Date(),
            sync_status: 'synced',
          },
          {
            id: 'uuid-5',
            message_id: 'msg-5',
            sequence_number: 5,
            sender_address: 'XYZ456',
            device_id: 'bob-mobile-001',
            content: 'Message 5',
            timestamp: new Date(),
            sync_status: 'synced',
          }
        ];
        
        mockPool.query.mockResolvedValue({ rows: mockMessages });
        
        const result = await service.getMessagesSinceSequence('session-123', 3);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data?.[0].sequenceNumber).toBe(4);
        expect(result.data?.[1].sequenceNumber).toBe(5);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE cs.session_id = $1 AND m.sequence_number > $2'),
          ['session-123', 3]
        );
      });
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