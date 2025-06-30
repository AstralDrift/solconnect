import { FailoverManager } from '../FailoverManager';
import { RelayConnection, RelayEndpoint } from '../RelayManager';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('FailoverManager', () => {
  let failoverManager: FailoverManager;
  let mockOldConnection: RelayConnection;
  let mockNewConnection: RelayConnection;
  let mockBackupConnections: RelayConnection[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock connections
    mockOldConnection = {
      relay: {
        id: 'relay-1',
        url: 'ws://localhost:8080',
        region: 'us-east',
        priority: 1,
        maxConnections: 100,
        currentConnections: 50,
        isHealthy: false,
        lastHealthCheck: new Date(),
        qualityScore: 0.3,
        latency: 500,
        metadata: {}
      },
      websocket: {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      } as any,
      state: 'connected',
      connectedAt: new Date(Date.now() - 3600000), // 1 hour ago
      lastActivity: new Date(),
      messagesSent: 1000,
      messagesReceived: 950,
      errors: 5
    };

    mockNewConnection = {
      relay: {
        id: 'relay-2',
        url: 'ws://localhost:8081',
        region: 'us-west',
        priority: 2,
        maxConnections: 100,
        currentConnections: 30,
        isHealthy: true,
        lastHealthCheck: new Date(),
        qualityScore: 0.9,
        latency: 100,
        metadata: {}
      },
      websocket: {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn()
      } as any,
      state: 'connected',
      connectedAt: new Date(),
      lastActivity: new Date(),
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0
    };

    mockBackupConnections = [
      mockNewConnection,
      {
        ...mockNewConnection,
        relay: {
          ...mockNewConnection.relay,
          id: 'relay-3',
          url: 'ws://localhost:8082',
          region: 'eu-west',
          qualityScore: 0.85,
          latency: 150
        }
      }
    ];

    failoverManager = new FailoverManager({
      relays: [],
      selectionStrategy: 'weighted',
      failoverThreshold: 500,
      healthCheckInterval: 10000,
      maxRetries: 3,
      connectionTimeout: 5000,
      enableAutoDiscovery: false,
      preferredRegions: ['us-east', 'us-west']
    });
  });

  describe('Failover Decision Making', () => {
    it('should determine when failover is needed based on connection health', () => {
      const shouldFailover = failoverManager.shouldTriggerFailover(mockOldConnection);
      expect(shouldFailover).toBe(true);
    });

    it('should not trigger failover for healthy connections', () => {
      const healthyConnection = {
        ...mockOldConnection,
        relay: { ...mockOldConnection.relay, isHealthy: true, qualityScore: 0.9 },
        errors: 0
      };
      
      const shouldFailover = failoverManager.shouldTriggerFailover(healthyConnection);
      expect(shouldFailover).toBe(false);
    });

    it('should trigger failover based on error rate', () => {
      const errorProneConnection = {
        ...mockOldConnection,
        relay: { ...mockOldConnection.relay, isHealthy: true },
        errors: 100,
        messagesSent: 200
      };
      
      const shouldFailover = failoverManager.shouldTriggerFailover(errorProneConnection);
      expect(shouldFailover).toBe(true);
    });
  });

  describe('Backup Selection', () => {
    it('should select best backup connection based on quality score', () => {
      const bestBackup = failoverManager.selectBestBackup(mockBackupConnections);
      
      expect(bestBackup).toBeDefined();
      expect(bestBackup?.relay.id).toBe('relay-2');
      expect(bestBackup?.relay.qualityScore).toBe(0.9);
    });

    it('should filter out unhealthy backup connections', () => {
      const mixedBackups = [
        ...mockBackupConnections,
        {
          ...mockNewConnection,
          relay: { ...mockNewConnection.relay, isHealthy: false, qualityScore: 0.95 }
        }
      ];
      
      const bestBackup = failoverManager.selectBestBackup(mixedBackups);
      expect(bestBackup?.relay.isHealthy).toBe(true);
    });

    it('should prefer connections in preferred regions', () => {
      const regionalBackups = [
        {
          ...mockNewConnection,
          relay: { ...mockNewConnection.relay, region: 'ap-south', qualityScore: 0.95 }
        },
        {
          ...mockNewConnection,
          relay: { ...mockNewConnection.relay, region: 'us-west', qualityScore: 0.85 }
        }
      ];
      
      const bestBackup = failoverManager.selectBestBackup(regionalBackups);
      expect(bestBackup?.relay.region).toBe('us-west');
    });
  });

  describe('State Preservation', () => {
    it('should create state snapshot from old connection', async () => {
      const snapshot = await failoverManager.createStateSnapshot(mockOldConnection);
      
      expect(snapshot).toBeDefined();
      expect(snapshot.connectionId).toBe('relay-1');
      expect(snapshot.messageQueue).toBeDefined();
      expect(snapshot.subscriptions).toBeDefined();
      expect(snapshot.pendingAcks).toBeDefined();
    });

    it('should restore state to new connection', async () => {
      const snapshot = await failoverManager.createStateSnapshot(mockOldConnection);
      const result = await failoverManager.restoreState(mockNewConnection, snapshot);
      
      expect(result.success).toBe(true);
      expect(result.data?.restoredMessages).toBe(0);
      expect(result.data?.restoredSubscriptions).toBe(0);
    });

    it('should handle state restoration failures gracefully', async () => {
      const invalidSnapshot = {
        connectionId: 'invalid',
        timestamp: Date.now(),
        messageQueue: null as any,
        subscriptions: [],
        pendingAcks: new Map()
      };
      
      const result = await failoverManager.restoreState(mockNewConnection, invalidSnapshot);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Failover Execution', () => {
    it('should execute failover within threshold time', async () => {
      const startTime = Date.now();
      const result = await failoverManager.executeFailover(
        mockOldConnection,
        mockNewConnection
      );
      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(500); // failoverThreshold
    });

    it('should emit failover events', async () => {
      const events: any[] = [];
      
      failoverManager.on('failoverStarted', (data) => events.push({ type: 'started', data }));
      failoverManager.on('failoverCompleted', (data) => events.push({ type: 'completed', data }));
      
      await failoverManager.executeFailover(mockOldConnection, mockNewConnection);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('started');
      expect(events[1].type).toBe('completed');
      expect(events[1].data.failoverTime).toBeDefined();
    });

    it('should handle failover errors and rollback', async () => {
      // Make new connection fail
      const failingConnection = {
        ...mockNewConnection,
        websocket: {
          readyState: WebSocket.CLOSED,
          send: vi.fn().mockImplementation(() => {
            throw new Error('Connection closed');
          })
        } as any
      };
      
      const result = await failoverManager.executeFailover(
        mockOldConnection,
        failingConnection
      );
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Failover failed');
    });
  });

  describe('Message Queue Management', () => {
    it('should preserve message queue during failover', async () => {
      const messageQueue = [
        { id: '1', content: 'Hello', timestamp: Date.now() },
        { id: '2', content: 'World', timestamp: Date.now() }
      ];
      
      const queueManager = failoverManager.getMessageQueueManager();
      messageQueue.forEach(msg => queueManager.enqueue(msg));
      
      const result = await failoverManager.executeFailover(
        mockOldConnection,
        mockNewConnection
      );
      
      expect(result.success).toBe(true);
      expect(queueManager.size()).toBe(0); // Queue should be processed
    });

    it('should handle message redelivery after failover', async () => {
      const queueManager = failoverManager.getMessageQueueManager();
      queueManager.enqueue({ id: '1', content: 'Test', timestamp: Date.now() });
      
      await failoverManager.executeFailover(mockOldConnection, mockNewConnection);
      
      // Verify message was sent through new connection
      expect(mockNewConnection.websocket.send).toHaveBeenCalled();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track failover metrics', async () => {
      await failoverManager.executeFailover(mockOldConnection, mockNewConnection);
      
      const metrics = failoverManager.getMetrics();
      expect(metrics.totalFailovers).toBe(1);
      expect(metrics.successfulFailovers).toBe(1);
      expect(metrics.averageFailoverTime).toBeGreaterThan(0);
      expect(metrics.lastFailoverTime).toBeDefined();
    });

    it('should track failed failover attempts', async () => {
      const failingConnection = {
        ...mockNewConnection,
        state: 'disconnected' as const
      };
      
      await failoverManager.executeFailover(mockOldConnection, failingConnection);
      
      const metrics = failoverManager.getMetrics();
      expect(metrics.totalFailovers).toBe(1);
      expect(metrics.failedFailovers).toBe(1);
    });
  });

  describe('Graceful Degradation', () => {
    it('should handle scenario with no available backups', async () => {
      const result = await failoverManager.executeFailover(mockOldConnection, null as any);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No backup connection available');
    });

    it('should attempt reconnection to original relay if no backups', async () => {
      let reconnectAttempted = false;
      
      failoverManager.on('reconnectAttempt', () => {
        reconnectAttempted = true;
      });
      
      await failoverManager.handleNoBackupScenario(mockOldConnection);
      
      expect(reconnectAttempted).toBe(true);
    });
  });
}); 