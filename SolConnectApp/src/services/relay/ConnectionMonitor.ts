import { Logger } from '../monitoring/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { RelayEndpoint, RelayConnection, RelayConfig } from './RelayManager';

export interface ConnectionMetrics {
  latency: number;
  throughput: number; // messages per second
  errorRate: number; // percentage
  stability: number; // connection stability score 0-100
  uptime: number; // percentage
  lastUpdate: Date;
}

export interface QualityThresholds {
  maxLatency: number;
  minThroughput: number;
  maxErrorRate: number;
  minStability: number;
  minUptime: number;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  qualityScore: number;
  latency: number;
  issues: string[];
  metrics: ConnectionMetrics;
  timestamp: Date;
}

export interface ConnectionAlert {
  type: 'latency' | 'throughput' | 'errors' | 'stability' | 'disconnection';
  severity: 'warning' | 'critical';
  message: string;
  relayId: string;
  timestamp: Date;
  metrics: ConnectionMetrics;
}

/**
 * Real-time connection quality monitoring with performance metrics
 */
export class ConnectionMonitor {
  private logger = new Logger('ConnectionMonitor');
  private metricsCollector = new MetricsCollector();
  private config: RelayConfig;
  
  private monitoredConnections = new Map<string, RelayConnection>();
  private connectionMetrics = new Map<string, ConnectionMetrics>();
  private qualityThresholds: QualityThresholds;
  private alertCallbacks = new Set<(alert: ConnectionAlert) => void>();
  
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private pingIntervals = new Map<string, NodeJS.Timeout>();
  
  private readonly MONITORING_INTERVAL = 5000; // 5 seconds
  private readonly PING_INTERVAL = 10000; // 10 seconds
  private readonly METRICS_WINDOW = 60000; // 1 minute rolling window

  constructor(config: RelayConfig) {
    this.config = config;
    this.qualityThresholds = this.getDefaultQualityThresholds();
  }

  /**
   * Start monitoring a relay connection
   */
  startMonitoring(connection: RelayConnection): void {
    const relayId = connection.relay.id;
    
    if (this.monitoredConnections.has(relayId)) {
      this.logger.debug('Already monitoring connection', { relayId });
      return;
    }

    this.logger.debug('Starting connection monitoring', { relayId });
    
    this.monitoredConnections.set(relayId, connection);
    this.connectionMetrics.set(relayId, this.initializeMetrics());
    
    // Start monitoring interval
    const monitoringInterval = setInterval(() => {
      this.performMonitoringCheck(connection);
    }, this.MONITORING_INTERVAL);
    
    this.monitoringIntervals.set(relayId, monitoringInterval);
    
    // Start ping interval for latency monitoring
    const pingInterval = setInterval(() => {
      this.performPingCheck(connection);
    }, this.PING_INTERVAL);
    
    this.pingIntervals.set(relayId, pingInterval);
    
    // Set up WebSocket event monitoring
    this.setupConnectionEventMonitoring(connection);
  }

  /**
   * Stop monitoring a relay connection
   */
  stopMonitoring(connection: RelayConnection): void {
    const relayId = connection.relay.id;
    
    this.logger.debug('Stopping connection monitoring', { relayId });
    
    // Clear intervals
    const monitoringInterval = this.monitoringIntervals.get(relayId);
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      this.monitoringIntervals.delete(relayId);
    }
    
    const pingInterval = this.pingIntervals.get(relayId);
    if (pingInterval) {
      clearInterval(pingInterval);
      this.pingIntervals.delete(relayId);
    }
    
    // Remove from monitored connections
    this.monitoredConnections.delete(relayId);
    
    this.logger.debug('Connection monitoring stopped', { relayId });
  }

  /**
   * Perform health check on a relay
   */
  async checkRelayHealth(relay: RelayEndpoint): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      this.logger.debug('Performing health check', { relayId: relay.id });
      
      // Get current metrics
      const metrics = this.connectionMetrics.get(relay.id) || this.initializeMetrics();
      
      // Perform ping test
      const pingResult = await this.performPingTest(relay);
      
      if (pingResult.success) {
        metrics.latency = pingResult.latency;
      } else {
        issues.push('Ping test failed');
      }
      
      // Check quality thresholds
      const qualityIssues = this.checkQualityThresholds(metrics);
      issues.push(...qualityIssues);
      
      // Calculate quality score
      const qualityScore = this.calculateQualityScore(metrics);
      
      // Determine if relay is healthy
      const isHealthy = issues.length === 0 && qualityScore >= 60;
      
      const healthCheckResult: HealthCheckResult = {
        isHealthy,
        qualityScore,
        latency: metrics.latency,
        issues,
        metrics,
        timestamp: new Date()
      };
      
      const checkTime = Date.now() - startTime;
      this.logger.debug('Health check completed', {
        relayId: relay.id,
        isHealthy,
        qualityScore,
        issues: issues.length,
        checkTime: `${checkTime}ms`
      });
      
      return healthCheckResult;
    } catch (error) {
      this.logger.error('Health check failed', { relayId: relay.id, error });
      
      return {
        isHealthy: false,
        qualityScore: 0,
        latency: Date.now() - startTime,
        issues: [`Health check error: ${error.message}`],
        metrics: this.connectionMetrics.get(relay.id) || this.initializeMetrics(),
        timestamp: new Date()
      };
    }
  }

  /**
   * Get current connection metrics for a relay
   */
  getConnectionMetrics(relayId: string): ConnectionMetrics | null {
    return this.connectionMetrics.get(relayId) || null;
  }

  /**
   * Get metrics for all monitored connections
   */
  getAllConnectionMetrics(): Map<string, ConnectionMetrics> {
    return new Map(this.connectionMetrics);
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: ConnectionAlert) => void): void {
    this.alertCallbacks.add(callback);
  }

  /**
   * Remove alert callback
   */
  offAlert(callback: (alert: ConnectionAlert) => void): void {
    this.alertCallbacks.delete(callback);
  }

  /**
   * Update quality thresholds
   */
  updateQualityThresholds(thresholds: Partial<QualityThresholds>): void {
    this.qualityThresholds = { ...this.qualityThresholds, ...thresholds };
    this.logger.info('Quality thresholds updated', { thresholds: this.qualityThresholds });
  }

  // Private methods
  private performMonitoringCheck(connection: RelayConnection): void {
    const relayId = connection.relay.id;
    const metrics = this.connectionMetrics.get(relayId);
    
    if (!metrics) {
      return;
    }

    try {
      // Update connection metrics
      this.updateConnectionMetrics(connection, metrics);
      
      // Check for alerts
      this.checkForAlerts(connection, metrics);
      
      // Update last update timestamp
      metrics.lastUpdate = new Date();
      
    } catch (error) {
      this.logger.error('Monitoring check failed', { relayId, error });
    }
  }

  private async performPingCheck(connection: RelayConnection): Promise<void> {
    const relayId = connection.relay.id;
    
    if (connection.state !== 'connected') {
      return;
    }

    try {
      const startTime = Date.now();
      const pingId = `ping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Send ping message
      const pingMessage = JSON.stringify({
        type: 'ping',
        id: pingId,
        timestamp: startTime
      });
      
      // Set up pong listener
      const pongTimeout = setTimeout(() => {
        this.handlePingTimeout(connection);
      }, 5000);
      
      const originalOnMessage = connection.websocket.onmessage;
      
      connection.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong' && data.id === pingId) {
            const latency = Date.now() - startTime;
            this.updateLatencyMetrics(relayId, latency);
            clearTimeout(pongTimeout);
            
            // Restore original message handler
            connection.websocket.onmessage = originalOnMessage;
          } else if (originalOnMessage) {
            originalOnMessage(event);
          }
        } catch (error) {
          if (originalOnMessage) {
            originalOnMessage(event);
          }
        }
      };
      
      connection.websocket.send(pingMessage);
      
    } catch (error) {
      this.logger.warn('Ping check failed', { relayId, error: error.message });
    }
  }

  private async performPingTest(relay: RelayEndpoint): Promise<{ success: boolean; latency: number }> {
    const startTime = Date.now();
    
    try {
      // Perform basic connectivity test
      const response = await fetch(relay.url.replace('ws', 'http') + '/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      const latency = Date.now() - startTime;
      return { success: response.ok, latency };
    } catch (error) {
      return { success: false, latency: Date.now() - startTime };
    }
  }

  private updateConnectionMetrics(connection: RelayConnection, metrics: ConnectionMetrics): void {
    const relayId = connection.relay.id;
    
    // Update throughput (messages per second)
    const timeSinceLastUpdate = Date.now() - metrics.lastUpdate.getTime();
    const messagesSinceLastUpdate = connection.messagesReceived + connection.messagesSent;
    
    if (timeSinceLastUpdate > 0) {
      const throughput = (messagesSinceLastUpdate / timeSinceLastUpdate) * 1000;
      metrics.throughput = this.smoothValue(metrics.throughput, throughput, 0.3);
    }
    
    // Update error rate
    const totalMessages = connection.messagesReceived + connection.messagesSent;
    if (totalMessages > 0) {
      const errorRate = (connection.errors / totalMessages) * 100;
      metrics.errorRate = this.smoothValue(metrics.errorRate, errorRate, 0.2);
    }
    
    // Update stability score
    const stabilityScore = this.calculateStabilityScore(connection);
    metrics.stability = this.smoothValue(metrics.stability, stabilityScore, 0.1);
    
    // Update uptime
    const connectionTime = Date.now() - connection.connectedAt.getTime();
    const expectedTime = connectionTime;
    const uptime = (expectedTime / connectionTime) * 100;
    metrics.uptime = Math.min(100, uptime);
  }

  private updateLatencyMetrics(relayId: string, latency: number): void {
    const metrics = this.connectionMetrics.get(relayId);
    if (metrics) {
      metrics.latency = this.smoothValue(metrics.latency, latency, 0.2);
    }
  }

  private setupConnectionEventMonitoring(connection: RelayConnection): void {
    const relayId = connection.relay.id;
    const originalOnError = connection.websocket.onerror;
    const originalOnClose = connection.websocket.onclose;
    
    // Monitor WebSocket errors
    connection.websocket.onerror = (event) => {
      this.handleConnectionError(connection, event);
      if (originalOnError) {
        originalOnError(event);
      }
    };
    
    // Monitor WebSocket disconnections
    connection.websocket.onclose = (event) => {
      this.handleConnectionClose(connection, event);
      if (originalOnClose) {
        originalOnClose(event);
      }
    };
  }

  private handleConnectionError(connection: RelayConnection, event: Event): void {
    const relayId = connection.relay.id;
    
    this.logger.warn('Connection error detected', { relayId });
    
    // Update error metrics
    connection.errors++;
    
    // Emit error alert
    this.emitAlert({
      type: 'errors',
      severity: 'warning',
      message: 'WebSocket connection error detected',
      relayId,
      timestamp: new Date(),
      metrics: this.connectionMetrics.get(relayId) || this.initializeMetrics()
    });
  }

  private handleConnectionClose(connection: RelayConnection, event: CloseEvent): void {
    const relayId = connection.relay.id;
    
    this.logger.warn('Connection closed', { relayId, code: event.code, reason: event.reason });
    
    // Emit disconnection alert
    this.emitAlert({
      type: 'disconnection',
      severity: event.code === 1000 ? 'warning' : 'critical', // 1000 = normal closure
      message: `Connection closed: ${event.reason || 'Unknown reason'}`,
      relayId,
      timestamp: new Date(),
      metrics: this.connectionMetrics.get(relayId) || this.initializeMetrics()
    });
    
    // Stop monitoring this connection
    this.stopMonitoring(connection);
  }

  private handlePingTimeout(connection: RelayConnection): void {
    const relayId = connection.relay.id;
    
    this.logger.warn('Ping timeout detected', { relayId });
    
    // Update latency with timeout value
    this.updateLatencyMetrics(relayId, 5000);
    
    // Emit latency alert
    this.emitAlert({
      type: 'latency',
      severity: 'critical',
      message: 'Ping timeout - high latency detected',
      relayId,
      timestamp: new Date(),
      metrics: this.connectionMetrics.get(relayId) || this.initializeMetrics()
    });
  }

  private checkForAlerts(connection: RelayConnection, metrics: ConnectionMetrics): void {
    const relayId = connection.relay.id;
    
    // Check latency threshold
    if (metrics.latency > this.qualityThresholds.maxLatency) {
      this.emitAlert({
        type: 'latency',
        severity: metrics.latency > this.qualityThresholds.maxLatency * 2 ? 'critical' : 'warning',
        message: `High latency detected: ${metrics.latency}ms`,
        relayId,
        timestamp: new Date(),
        metrics
      });
    }
    
    // Check throughput threshold
    if (metrics.throughput < this.qualityThresholds.minThroughput) {
      this.emitAlert({
        type: 'throughput',
        severity: 'warning',
        message: `Low throughput detected: ${metrics.throughput.toFixed(2)} msg/s`,
        relayId,
        timestamp: new Date(),
        metrics
      });
    }
    
    // Check error rate threshold
    if (metrics.errorRate > this.qualityThresholds.maxErrorRate) {
      this.emitAlert({
        type: 'errors',
        severity: metrics.errorRate > this.qualityThresholds.maxErrorRate * 2 ? 'critical' : 'warning',
        message: `High error rate detected: ${metrics.errorRate.toFixed(1)}%`,
        relayId,
        timestamp: new Date(),
        metrics
      });
    }
    
    // Check stability threshold
    if (metrics.stability < this.qualityThresholds.minStability) {
      this.emitAlert({
        type: 'stability',
        severity: 'warning',
        message: `Low stability detected: ${metrics.stability.toFixed(1)}`,
        relayId,
        timestamp: new Date(),
        metrics
      });
    }
  }

  private checkQualityThresholds(metrics: ConnectionMetrics): string[] {
    const issues: string[] = [];
    
    if (metrics.latency > this.qualityThresholds.maxLatency) {
      issues.push(`High latency: ${metrics.latency}ms`);
    }
    
    if (metrics.throughput < this.qualityThresholds.minThroughput) {
      issues.push(`Low throughput: ${metrics.throughput.toFixed(2)} msg/s`);
    }
    
    if (metrics.errorRate > this.qualityThresholds.maxErrorRate) {
      issues.push(`High error rate: ${metrics.errorRate.toFixed(1)}%`);
    }
    
    if (metrics.stability < this.qualityThresholds.minStability) {
      issues.push(`Low stability: ${metrics.stability.toFixed(1)}`);
    }
    
    if (metrics.uptime < this.qualityThresholds.minUptime) {
      issues.push(`Low uptime: ${metrics.uptime.toFixed(1)}%`);
    }
    
    return issues;
  }

  private calculateQualityScore(metrics: ConnectionMetrics): number {
    let score = 100;
    
    // Latency penalty
    const latencyPenalty = Math.max(0, (metrics.latency - 100) / 10);
    score -= latencyPenalty;
    
    // Error rate penalty
    score -= metrics.errorRate * 2;
    
    // Stability bonus/penalty
    score = score * (metrics.stability / 100);
    
    // Uptime factor
    score = score * (metrics.uptime / 100);
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateStabilityScore(connection: RelayConnection): number {
    // Stability based on connection consistency, error rate, and uptime
    const errorFactor = Math.max(0, 100 - (connection.errors * 10));
    const connectionTime = Date.now() - connection.connectedAt.getTime();
    const timeFactor = Math.min(100, connectionTime / 60000); // Stabilizes over 1 minute
    
    return (errorFactor + timeFactor) / 2;
  }

  private smoothValue(current: number, newValue: number, alpha: number): number {
    return current * (1 - alpha) + newValue * alpha;
  }

  private emitAlert(alert: ConnectionAlert): void {
    this.logger.warn('Connection alert', {
      type: alert.type,
      severity: alert.severity,
      relayId: alert.relayId,
      message: alert.message
    });
    
    // Notify all alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        this.logger.error('Alert callback failed', error);
      }
    }
    
    // Send to metrics collector
    this.metricsCollector.recordMetric(`relay.alert.${alert.type}`, 1, {
      relayId: alert.relayId,
      severity: alert.severity
    });
  }

  private initializeMetrics(): ConnectionMetrics {
    return {
      latency: 0,
      throughput: 0,
      errorRate: 0,
      stability: 100,
      uptime: 100,
      lastUpdate: new Date()
    };
  }

  private getDefaultQualityThresholds(): QualityThresholds {
    return {
      maxLatency: 500, // ms
      minThroughput: 1, // messages per second
      maxErrorRate: 5, // percentage
      minStability: 80, // score
      minUptime: 95 // percentage
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    this.logger.info('Shutting down ConnectionMonitor');
    
    // Clear all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    
    // Clear all ping intervals
    for (const interval of this.pingIntervals.values()) {
      clearInterval(interval);
    }
    this.pingIntervals.clear();
    
    // Clear connections and metrics
    this.monitoredConnections.clear();
    this.connectionMetrics.clear();
    this.alertCallbacks.clear();
    
    this.logger.info('ConnectionMonitor shutdown complete');
  }
}