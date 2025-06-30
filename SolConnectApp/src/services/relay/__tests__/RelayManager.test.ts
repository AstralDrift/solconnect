import { RelayManager, RelayEndpoint, RelayConfig } from '../RelayManager';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe('RelayManager', () => {
  let relayManager: RelayManager;
  let mockConfig: RelayConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      relays: [
        {
          id: 'relay-1',
          url: 'ws://localhost:8080',
          region: 'us-east',
          priority: 1,
          maxConnections: 100,
          currentConnections: 0,
          isHealthy: true,
          lastHealthCheck: new Date(),
          qualityScore: 0.9,
          latency: 50,
          metadata: {}
        },
        {
          id: 'relay-2',
          url: 'ws://localhost:8081',
          region: 'us-west',
          priority: 2,
          maxConnections: 100,
          currentConnections: 0,
          isHealthy: true,
          lastHealthCheck: new Date(),
          qualityScore: 0.8,
          latency: 100,
          metadata: {}
        }
      ],
      selectionStrategy: 'weighted',
      failoverThreshold: 500,
      healthCheckInterval: 10000,
      maxRetries: 3,
      connectionTimeout: 5000,
      enableAutoDiscovery: false,
      preferredRegions: ['us-east']
    };

    relayManager = new RelayManager(mockConfig);
  });

  afterEach(async () => {
    await relayManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully with configured relays', async () => {
      const result = await relayManager.initialize();
      
      expect(result.success).toBe(true);
      expect(relayManager.getAvailableRelays()).toHaveLength(2);
      expect(relayManager.getPrimaryConnection()).toBeDefined();
    });

    it('should handle initialization failure gracefully', async () => {
      // Create manager with no relays
      const emptyManager = new RelayManager({ ...mockConfig, relays: [] });
      const result = await emptyManager.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No healthy relays available');
    });

    it('should respect preferred regions during initialization', async () => {
      await relayManager.initialize();
      const primaryConnection = relayManager.getPrimaryConnection();
      
      expect(primaryConnection?.relay.region).toBe('us-east');
    });
  });

  describe('Relay Selection', () => {
    it('should select optimal relay based on quality score', async () => {
      await relayManager.initialize();
      const result = await relayManager.selectOptimalRelay();
      
      expect(result.success).toBe(true);
      expect(result.data?.qualityScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should filter out unhealthy relays', async () => {
      // Mark relay-1 as unhealthy
      mockConfig.relays[0].isHealthy = false;
      const manager = new RelayManager(mockConfig);
      await manager.initialize();
      
      const result = await manager.selectOptimalRelay();
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('relay-2');
    });

    it('should handle no healthy relays scenario', async () => {
      // Mark all relays as unhealthy
      mockConfig.relays.forEach(relay => relay.isHealthy = false);
      const manager = new RelayManager(mockConfig);
      
      const result = await manager.selectOptimalRelay();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No healthy relays available');
    });
  });

  describe('Connection Management', () => {
    it('should establish connection to relay', async () => {
      await relayManager.initialize();
      const relay = mockConfig.relays[0];
      const result = await relayManager.connectToRelay(relay);
      
      expect(result.success).toBe(true);
      expect(result.data?.state).toBe('connected');
      expect(result.data?.relay.id).toBe(relay.id);
    });

    it('should handle connection timeout', async () => {
      // Override WebSocket to never connect
      const TimeoutWebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          // Never trigger onopen
          clearTimeout((this as any).openTimeout);
        }
      };
      global.WebSocket = TimeoutWebSocket as any;

      const manager = new RelayManager({ ...mockConfig, connectionTimeout: 100 });
      const result = await manager.connectToRelay(mockConfig.relays[0]);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('should track connection metrics', async () => {
      await relayManager.initialize();
      const metrics = relayManager.getMetrics();
      
      expect(metrics.totalRelays).toBe(2);
      expect(metrics.healthyRelays).toBe(2);
      expect(metrics.activeConnections).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Failover', () => {
    it('should perform failover when primary relay fails', async () => {
      await relayManager.initialize();
      const initialPrimary = relayManager.getPrimaryConnection();
      
      // Simulate primary relay failure
      const result = await relayManager.performFailover();
      
      expect(result.success).toBe(true);
      expect(result.data?.relay.id).not.toBe(initialPrimary?.relay.id);
      expect(relayManager.getMetrics().failoverCount).toBe(1);
    });

    it('should preserve message state during failover', async () => {
      await relayManager.initialize();
      
      // Track failover event
      let failoverCompleted = false;
      relayManager.on('failoverCompleted', () => {
        failoverCompleted = true;
      });
      
      await relayManager.performFailover();
      
      expect(failoverCompleted).toBe(true);
    });

    it('should complete failover within threshold time', async () => {
      await relayManager.initialize();
      
      const startTime = Date.now();
      const result = await relayManager.performFailover();
      const failoverTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(failoverTime).toBeLessThan(mockConfig.failoverThreshold);
    });
  });

  describe('Health Monitoring', () => {
    it('should update relay health status', async () => {
      await relayManager.initialize();
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const relays = relayManager.getAvailableRelays();
      relays.forEach(relay => {
        expect(relay.lastHealthCheck).toBeDefined();
        expect(relay.isHealthy).toBeDefined();
        expect(relay.qualityScore).toBeGreaterThanOrEqual(0);
      });
    });

    it('should trigger failover on primary relay health failure', async () => {
      await relayManager.initialize();
      
      let failoverTriggered = false;
      relayManager.on('failoverCompleted', () => {
        failoverTriggered = true;
      });
      
      // Simulate health check failure on primary
      const primary = relayManager.getPrimaryConnection();
      if (primary) {
        primary.relay.isHealthy = false;
        // Trigger health check manually
        await (relayManager as any).performHealthChecks();
      }
      
      expect(failoverTriggered).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should emit connection events', async () => {
      const events: string[] = [];
      
      relayManager.on('primaryConnected', () => events.push('primaryConnected'));
      relayManager.on('connectionClosed', () => events.push('connectionClosed'));
      
      await relayManager.initialize();
      expect(events).toContain('primaryConnected');
    });

    it('should handle message reception', async () => {
      await relayManager.initialize();
      
      let messageReceived = false;
      relayManager.on('messageReceived', ({ data }) => {
        messageReceived = true;
        expect(data).toBeDefined();
      });
      
      // Simulate incoming message
      const primary = relayManager.getPrimaryConnection();
      if (primary?.websocket.onmessage) {
        primary.websocket.onmessage(new MessageEvent('message', { data: '{"test": true}' }));
      }
      
      expect(messageReceived).toBe(true);
    });
  });

  describe('Shutdown', () => {
    it('should clean up resources on shutdown', async () => {
      await relayManager.initialize();
      
      const connectionsBefore = relayManager.getActiveConnections().length;
      expect(connectionsBefore).toBeGreaterThan(0);
      
      await relayManager.shutdown();
      
      const connectionsAfter = relayManager.getActiveConnections().length;
      expect(connectionsAfter).toBe(0);
    });

    it('should stop health monitoring on shutdown', async () => {
      await relayManager.initialize();
      await relayManager.shutdown();
      
      // Verify intervals are cleared
      const manager = relayManager as any;
      expect(manager.healthCheckInterval).toBeNull();
      expect(manager.discoveryInterval).toBeNull();
    });
  });

  describe('Load Balancing', () => {
    it('should distribute connections based on strategy', async () => {
      // Test weighted strategy
      const weightedManager = new RelayManager({
        ...mockConfig,
        selectionStrategy: 'weighted'
      });
      await weightedManager.initialize();
      
      const selections: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await weightedManager.selectOptimalRelay();
        if (result.success && result.data) {
          selections.push(result.data.id);
        }
      }
      
      // Should favor relay with higher quality score
      const relay1Count = selections.filter(id => id === 'relay-1').length;
      expect(relay1Count).toBeGreaterThan(selections.length / 2);
    });

    it('should respect connection limits', async () => {
      // Set low connection limit
      mockConfig.relays[0].maxConnections = 1;
      mockConfig.relays[0].currentConnections = 1;
      
      const manager = new RelayManager(mockConfig);
      await manager.initialize();
      
      const result = await manager.selectOptimalRelay();
      expect(result.data?.id).toBe('relay-2'); // Should select relay-2
    });
  });
}); 