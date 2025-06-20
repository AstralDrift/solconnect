import { Result } from '@/types';
import { Logger } from '../monitoring/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { RelayDiscovery } from './RelayDiscovery';
import { ConnectionMonitor } from './ConnectionMonitor';
import { LoadBalancer } from './LoadBalancer';

export interface RelayEndpoint {
  id: string;
  url: string;
  region: string;
  priority: number;
  maxConnections: number;
  currentConnections: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  qualityScore: number;
  latency: number;
  metadata: Record<string, any>;
}

export interface RelayConfig {
  relays: RelayEndpoint[];
  selectionStrategy: 'round-robin' | 'least-connections' | 'weighted' | 'geographic';
  failoverThreshold: number; // ms
  healthCheckInterval: number; // ms
  maxRetries: number;
  connectionTimeout: number; // ms
  enableAutoDiscovery: boolean;
  preferredRegions: string[];
}

export interface RelayConnection {
  relay: RelayEndpoint;
  websocket: WebSocket;
  state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'failed';
  connectedAt: Date;
  lastActivity: Date;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
}

export interface RelayMetrics {
  totalRelays: number;
  healthyRelays: number;
  activeConnections: number;
  averageLatency: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  failoverCount: number;
  uptime: number;
}

/**
 * Network-first relay management with intelligent discovery and selection
 */
export class RelayManager {
  private logger = new Logger('RelayManager');
  private metricsCollector = new MetricsCollector();
  private relayDiscovery: RelayDiscovery;
  private connectionMonitor: ConnectionMonitor;
  private loadBalancer: LoadBalancer;
  
  private config: RelayConfig;
  private availableRelays = new Map<string, RelayEndpoint>();
  private activeConnections = new Map<string, RelayConnection>();
  private primaryConnection: RelayConnection | null = null;
  private backupConnections = new Set<RelayConnection>();
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private metrics: RelayMetrics;
  
  private eventListeners = new Map<string, Set<(data: any) => void>>();

  constructor(config: RelayConfig) {
    this.config = { ...this.getDefaultConfig(), ...config };
    this.relayDiscovery = new RelayDiscovery(this.config);
    this.connectionMonitor = new ConnectionMonitor(this.config);
    this.loadBalancer = new LoadBalancer(this.config);
    
    this.metrics = this.initializeMetrics();
    
    // Initialize with configured relays
    this.config.relays.forEach(relay => {
      this.availableRelays.set(relay.id, { ...relay });
    });
  }

  /**
   * Initialize relay manager and start discovery
   */
  async initialize(): Promise<Result<void>> {
    try {
      this.logger.info('Initializing RelayManager', { 
        configuredRelays: this.config.relays.length,
        autoDiscovery: this.config.enableAutoDiscovery
      });

      // Start auto-discovery if enabled
      if (this.config.enableAutoDiscovery) {
        await this.startAutoDiscovery();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      // Establish initial connections
      await this.establishPrimaryConnection();

      this.logger.info('RelayManager initialized successfully', {
        availableRelays: this.availableRelays.size,
        primaryRelay: this.primaryConnection?.relay.id
      });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Failed to initialize RelayManager', error);
      return { 
        success: false, 
        error: new Error(`RelayManager initialization failed: ${error.message}`)
      };
    }
  }

  /**
   * Get optimal relay using load balancing strategy
   */
  async selectOptimalRelay(): Promise<Result<RelayEndpoint>> {
    try {
      const healthyRelays = Array.from(this.availableRelays.values())
        .filter(relay => relay.isHealthy);

      if (healthyRelays.length === 0) {
        return {
          success: false,
          error: new Error('No healthy relays available')
        };
      }

      const selectedRelay = await this.loadBalancer.selectRelay(healthyRelays);
      
      this.logger.debug('Selected optimal relay', {
        relayId: selectedRelay.id,
        strategy: this.config.selectionStrategy,
        qualityScore: selectedRelay.qualityScore,
        latency: selectedRelay.latency
      });

      return { success: true, data: selectedRelay };
    } catch (error) {
      this.logger.error('Failed to select optimal relay', error);
      return {
        success: false,
        error: new Error(`Relay selection failed: ${error.message}`)
      };
    }
  }

  /**
   * Establish primary connection with best available relay
   */
  async establishPrimaryConnection(): Promise<Result<RelayConnection>> {
    try {
      const relayResult = await this.selectOptimalRelay();
      if (!relayResult.success) {
        return relayResult;
      }

      const relay = relayResult.data;
      const connectionResult = await this.connectToRelay(relay);
      
      if (connectionResult.success) {
        this.primaryConnection = connectionResult.data;
        this.emit('primaryConnected', { relay, connection: this.primaryConnection });
        
        // Establish backup connections
        await this.establishBackupConnections();
        
        this.logger.info('Primary relay connection established', {
          relayId: relay.id,
          url: relay.url,
          region: relay.region
        });
      }

      return connectionResult;
    } catch (error) {
      this.logger.error('Failed to establish primary connection', error);
      return {
        success: false,
        error: new Error(`Primary connection failed: ${error.message}`)
      };
    }
  }

  /**
   * Connect to specific relay server
   */
  async connectToRelay(relay: RelayEndpoint): Promise<Result<RelayConnection>> {
    try {
      this.logger.debug('Connecting to relay', { relayId: relay.id, url: relay.url });

      const websocket = new WebSocket(relay.url);
      
      const connection: RelayConnection = {
        relay,
        websocket,
        state: 'connecting',
        connectedAt: new Date(),
        lastActivity: new Date(),
        messagesSent: 0,
        messagesReceived: 0,
        errors: 0
      };

      // Setup WebSocket event handlers
      await this.setupWebSocketHandlers(connection);

      // Wait for connection with timeout
      const connected = await this.waitForConnection(websocket, this.config.connectionTimeout);
      
      if (connected) {
        connection.state = 'connected';
        connection.connectedAt = new Date();
        this.activeConnections.set(relay.id, connection);
        
        // Start monitoring this connection
        this.connectionMonitor.startMonitoring(connection);
        
        this.updateMetrics();
        return { success: true, data: connection };
      } else {
        connection.state = 'failed';
        return {
          success: false,
          error: new Error(`Connection timeout to relay ${relay.id}`)
        };
      }
    } catch (error) {
      this.logger.error('Failed to connect to relay', error);
      return {
        success: false,
        error: new Error(`Relay connection failed: ${error.message}`)
      };
    }
  }

  /**
   * Establish backup connections for failover
   */
  private async establishBackupConnections(): Promise<void> {
    const backupCount = Math.min(2, this.availableRelays.size - 1);
    const healthyRelays = Array.from(this.availableRelays.values())
      .filter(relay => 
        relay.isHealthy && 
        relay.id !== this.primaryConnection?.relay.id
      )
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, backupCount);

    for (const relay of healthyRelays) {
      try {
        const connectionResult = await this.connectToRelay(relay);
        if (connectionResult.success) {
          this.backupConnections.add(connectionResult.data);
          this.logger.debug('Backup connection established', { relayId: relay.id });
        }
      } catch (error) {
        this.logger.warn('Failed to establish backup connection', { 
          relayId: relay.id, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Perform failover to backup relay
   */
  async performFailover(): Promise<Result<RelayConnection>> {
    try {
      this.logger.warn('Performing relay failover', {
        primaryRelay: this.primaryConnection?.relay.id,
        availableBackups: this.backupConnections.size
      });

      const startTime = Date.now();

      // Find best backup connection
      const bestBackup = this.findBestBackupConnection();
      
      if (!bestBackup) {
        // No backup available, try to establish new connection
        const newConnectionResult = await this.establishPrimaryConnection();
        if (!newConnectionResult.success) {
          return newConnectionResult;
        }
        bestBackup = newConnectionResult.data;
      }

      // Preserve message state during failover
      await this.preserveConnectionState(this.primaryConnection, bestBackup);

      // Switch primary connection
      const oldPrimary = this.primaryConnection;
      this.primaryConnection = bestBackup;
      this.backupConnections.delete(bestBackup);

      // Clean up old primary
      if (oldPrimary) {
        await this.disconnectFromRelay(oldPrimary);
      }

      // Establish new backup connections
      await this.establishBackupConnections();

      const failoverTime = Date.now() - startTime;
      this.metrics.failoverCount++;
      
      this.emit('failoverCompleted', {
        oldRelay: oldPrimary?.relay,
        newRelay: bestBackup.relay,
        failoverTime
      });

      this.logger.info('Relay failover completed', {
        newPrimaryRelay: bestBackup.relay.id,
        failoverTime: `${failoverTime}ms`
      });

      return { success: true, data: bestBackup };
    } catch (error) {
      this.logger.error('Relay failover failed', error);
      return {
        success: false,
        error: new Error(`Failover failed: ${error.message}`)
      };
    }
  }

  /**
   * Start auto-discovery of relay servers
   */
  private async startAutoDiscovery(): Promise<void> {
    try {
      // Initial discovery
      const discoveredRelays = await this.relayDiscovery.discoverRelays();
      discoveredRelays.forEach(relay => {
        if (!this.availableRelays.has(relay.id)) {
          this.availableRelays.set(relay.id, relay);
          this.logger.info('Discovered new relay', { relayId: relay.id, url: relay.url });
        }
      });

      // Periodic discovery
      this.discoveryInterval = setInterval(async () => {
        try {
          const newRelays = await this.relayDiscovery.discoverRelays();
          newRelays.forEach(relay => {
            if (!this.availableRelays.has(relay.id)) {
              this.availableRelays.set(relay.id, relay);
              this.emit('relayDiscovered', { relay });
            }
          });
        } catch (error) {
          this.logger.warn('Auto-discovery failed', error);
        }
      }, 30000); // Every 30 seconds
    } catch (error) {
      this.logger.error('Failed to start auto-discovery', error);
    }
  }

  /**
   * Start health monitoring for all relays
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all available relays
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.availableRelays.values()).map(async (relay) => {
      try {
        const healthResult = await this.connectionMonitor.checkRelayHealth(relay);
        
        relay.isHealthy = healthResult.isHealthy;
        relay.qualityScore = healthResult.qualityScore;
        relay.latency = healthResult.latency;
        relay.lastHealthCheck = new Date();

        if (!healthResult.isHealthy && this.primaryConnection?.relay.id === relay.id) {
          // Primary relay unhealthy, trigger failover
          await this.performFailover();
        }
      } catch (error) {
        this.logger.warn('Health check failed for relay', { 
          relayId: relay.id, 
          error: error.message 
        });
        relay.isHealthy = false;
      }
    });

    await Promise.allSettled(healthCheckPromises);
    this.updateMetrics();
  }

  // Helper methods
  private setupWebSocketHandlers(connection: RelayConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const { websocket } = connection;
      
      websocket.onopen = () => {
        this.logger.debug('WebSocket opened', { relayId: connection.relay.id });
        resolve();
      };

      websocket.onmessage = (event) => {
        connection.messagesReceived++;
        connection.lastActivity = new Date();
        this.emit('messageReceived', { connection, data: event.data });
      };

      websocket.onerror = (error) => {
        connection.errors++;
        this.logger.error('WebSocket error', { relayId: connection.relay.id, error });
        
        if (connection.state === 'connecting') {
          reject(error);
        }
      };

      websocket.onclose = () => {
        connection.state = 'disconnected';
        this.logger.debug('WebSocket closed', { relayId: connection.relay.id });
        this.emit('connectionClosed', { connection });
      };
    });
  }

  private waitForConnection(websocket: WebSocket, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout);
      
      const checkConnection = () => {
        if (websocket.readyState === WebSocket.OPEN) {
          clearTimeout(timer);
          resolve(true);
        } else if (websocket.readyState === WebSocket.CLOSED || websocket.readyState === WebSocket.CLOSING) {
          clearTimeout(timer);
          resolve(false);
        } else {
          setTimeout(checkConnection, 10);
        }
      };
      
      checkConnection();
    });
  }

  private findBestBackupConnection(): RelayConnection | null {
    if (this.backupConnections.size === 0) return null;
    
    return Array.from(this.backupConnections)
      .filter(conn => conn.state === 'connected')
      .sort((a, b) => b.relay.qualityScore - a.relay.qualityScore)[0] || null;
  }

  private async preserveConnectionState(oldConnection: RelayConnection | null, newConnection: RelayConnection): Promise<void> {
    // Implementation would preserve message queues, subscription state, etc.
    // This is a placeholder for state preservation logic
    this.logger.debug('Preserving connection state during failover');
  }

  private async disconnectFromRelay(connection: RelayConnection): Promise<void> {
    try {
      connection.state = 'disconnecting';
      connection.websocket.close();
      this.activeConnections.delete(connection.relay.id);
      this.connectionMonitor.stopMonitoring(connection);
    } catch (error) {
      this.logger.error('Error disconnecting from relay', error);
    }
  }

  private getDefaultConfig(): RelayConfig {
    return {
      relays: [],
      selectionStrategy: 'weighted',
      failoverThreshold: 500,
      healthCheckInterval: 10000,
      maxRetries: 3,
      connectionTimeout: 5000,
      enableAutoDiscovery: true,
      preferredRegions: ['us-east', 'us-west', 'eu-west']
    };
  }

  private initializeMetrics(): RelayMetrics {
    return {
      totalRelays: 0,
      healthyRelays: 0,
      activeConnections: 0,
      averageLatency: 0,
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      failoverCount: 0,
      uptime: 0
    };
  }

  private updateMetrics(): void {
    const relays = Array.from(this.availableRelays.values());
    const healthyRelays = relays.filter(r => r.isHealthy);
    
    this.metrics.totalRelays = relays.length;
    this.metrics.healthyRelays = healthyRelays.length;
    this.metrics.activeConnections = this.activeConnections.size;
    this.metrics.averageLatency = healthyRelays.reduce((sum, r) => sum + r.latency, 0) / healthyRelays.length || 0;
    
    // Collect message counts from all active connections
    const connections = Array.from(this.activeConnections.values());
    this.metrics.totalMessagesSent = connections.reduce((sum, c) => sum + c.messagesSent, 0);
    this.metrics.totalMessagesReceived = connections.reduce((sum, c) => sum + c.messagesReceived, 0);
  }

  // Event handling
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.logger.error('Event listener error', { event, error });
        }
      });
    }
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Public getters
  getPrimaryConnection(): RelayConnection | null {
    return this.primaryConnection;
  }

  getAvailableRelays(): RelayEndpoint[] {
    return Array.from(this.availableRelays.values());
  }

  getActiveConnections(): RelayConnection[] {
    return Array.from(this.activeConnections.values());
  }

  getMetrics(): RelayMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down RelayManager');
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    // Close all connections
    const disconnectPromises = Array.from(this.activeConnections.values()).map(
      connection => this.disconnectFromRelay(connection)
    );
    await Promise.allSettled(disconnectPromises);

    this.logger.info('RelayManager shutdown complete');
  }
}