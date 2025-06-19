/**
 * NetworkStateManager - Manages network state detection and offline queue coordination
 * Provides comprehensive network monitoring and automatic queue processing
 */

import { SolConnectError, ErrorCode, Result, createResult } from '../../types/errors';
import { Logger } from '../monitoring/Logger';

export interface NetworkState {
  online: boolean;
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  connectionQuality: 'poor' | 'good' | 'excellent';
  bandwidth?: number; // Estimated bandwidth in Mbps
  latency?: number; // Network latency in ms
  lastStateChange: Date;
  stateChangeCount: number;
}

export interface ConnectionMetrics {
  uptime: number; // Total online time in ms
  downtime: number; // Total offline time in ms
  stateChanges: number;
  averageLatency?: number;
  averageBandwidth?: number;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
}

export interface NetworkQueueStats {
  totalQueued: number;
  processingRate: number; // Messages per second
  failureRate: number; // Percentage of failed sends
  averageRetryDelay: number; // Average delay between retries in ms
  oldestQueuedMessage?: Date;
}

export interface QueueProcessorConfig {
  maxConcurrentProcessing: number;
  batchSize: number;
  processingInterval: number; // ms
  retryBaseDelay: number; // Base delay for exponential backoff
  maxRetryDelay: number; // Maximum retry delay
  maxRetries: number;
}

export type NetworkEventListener = (state: NetworkState) => void;
export type QueueProcessor = (sessionId: string, messages: any[]) => Promise<void>;

/**
 * Manages network state detection and coordinates offline queue processing
 */
export class NetworkStateManager {
  private logger = new Logger('NetworkStateManager');
  private networkState: NetworkState;
  private connectionMetrics: ConnectionMetrics;
  private queueStats: NetworkQueueStats;
  private config: QueueProcessorConfig;

  // Event listeners
  private eventListeners: NetworkEventListener[] = [];
  private queueProcessors: QueueProcessor[] = [];
  
  // Browser event listeners
  private onlineListener?: () => void;
  private offlineListener?: () => void;
  private connectionChangeListener?: (event: Event) => void;

  // Processing state
  private processingQueues = new Set<string>();
  private processingInterval?: NodeJS.Timeout;
  private connectionQualityInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  // Connection quality monitoring
  private latencyHistory: number[] = [];
  private bandwidthHistory: number[] = [];
  private lastConnectionTest?: Date;

  constructor(config?: Partial<QueueProcessorConfig>) {
    this.config = {
      maxConcurrentProcessing: 3,
      batchSize: 10,
      processingInterval: 5000, // 5 seconds
      retryBaseDelay: 1000, // 1 second
      maxRetryDelay: 30000, // 30 seconds
      maxRetries: 5,
      ...config
    };

    this.networkState = {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connectionQuality: 'good',
      lastStateChange: new Date(),
      stateChangeCount: 0
    };

    this.connectionMetrics = {
      uptime: 0,
      downtime: 0,
      stateChanges: 0
    };

    this.queueStats = {
      totalQueued: 0,
      processingRate: 0,
      failureRate: 0,
      averageRetryDelay: 0
    };

    this.setupNetworkListeners();
    this.startConnectionQualityMonitoring();
    this.startMetricsCollection();
  }

  /**
   * Initialize the network state manager
   */
  async initialize(): Promise<Result<void>> {
    try {
      this.logger.info('Initializing NetworkStateManager');
      
      // Test initial connection quality
      await this.testConnectionQuality();
      
      // Start queue processing
      this.startQueueProcessing();
      
      this.logger.info('NetworkStateManager initialized successfully', {
        initialState: this.networkState
      });
      
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize NetworkStateManager', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to initialize NetworkStateManager: ${error}`,
        'Network state detection failed to initialize',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): NetworkQueueStats {
    return { ...this.queueStats };
  }

  /**
   * Manually set network state (for testing)
   */
  setNetworkState(online: boolean, connectionType?: NetworkState['connectionType']): void {
    const wasOnline = this.networkState.online;
    const now = new Date();

    // Update metrics
    if (wasOnline !== online) {
      this.connectionMetrics.stateChanges++;
      this.networkState.stateChangeCount++;
      
      if (online) {
        this.connectionMetrics.lastConnectedAt = now;
        if (this.connectionMetrics.lastDisconnectedAt) {
          this.connectionMetrics.downtime += now.getTime() - this.connectionMetrics.lastDisconnectedAt.getTime();
        }
      } else {
        this.connectionMetrics.lastDisconnectedAt = now;
        if (this.connectionMetrics.lastConnectedAt) {
          this.connectionMetrics.uptime += now.getTime() - this.connectionMetrics.lastConnectedAt.getTime();
        }
      }
    }

    this.networkState = {
      ...this.networkState,
      online,
      connectionType,
      lastStateChange: now
    };

    // Notify listeners
    this.notifyStateChange();

    // Trigger queue processing if we just came online
    if (!wasOnline && online) {
      this.onConnectionRestored();
    }

    this.logger.info('Network state changed', {
      online,
      connectionType,
      stateChangeCount: this.networkState.stateChangeCount
    });
  }

  /**
   * Register network state change listener
   */
  addEventListener(listener: NetworkEventListener): () => void {
    this.eventListeners.push(listener);
    
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Register queue processor
   */
  registerQueueProcessor(processor: QueueProcessor): () => void {
    this.queueProcessors.push(processor);
    
    return () => {
      const index = this.queueProcessors.indexOf(processor);
      if (index > -1) {
        this.queueProcessors.splice(index, 1);
      }
    };
  }

  /**
   * Update queue statistics
   */
  updateQueueStats(stats: Partial<NetworkQueueStats>): void {
    this.queueStats = {
      ...this.queueStats,
      ...stats
    };
  }

  /**
   * Process queue for a specific session
   */
  async processSessionQueue(
    sessionId: string,
    messages: any[],
    processor?: QueueProcessor
  ): Promise<Result<void>> {
    if (!this.networkState.online) {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'Cannot process queue while offline',
        'No network connection available'
      ));
    }

    if (this.processingQueues.has(sessionId)) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'Queue already being processed',
        'Queue processing already in progress for this session'
      ));
    }

    try {
      this.processingQueues.add(sessionId);
      this.logger.info('Processing queue for session', { sessionId, messageCount: messages.length });

      const processingStart = Date.now();
      let successCount = 0;
      let failureCount = 0;

      // Process in batches
      const batches = this.createBatches(messages, this.config.batchSize);
      
      for (const batch of batches) {
        if (!this.networkState.online) {
          // Network went offline during processing
          break;
        }

        try {
          // Use provided processor or default processors
          if (processor) {
            await processor(sessionId, batch);
          } else {
            await this.processWithRegisteredProcessors(sessionId, batch);
          }
          
          successCount += batch.length;
        } catch (error) {
          this.logger.error('Batch processing failed', error, { sessionId, batchSize: batch.length });
          failureCount += batch.length;
        }

        // Rate limiting between batches
        if (batches.length > 1) {
          await this.delay(100);
        }
      }

      const processingTime = Date.now() - processingStart;
      const processingRate = successCount / (processingTime / 1000);
      const failureRate = failureCount / (successCount + failureCount) * 100;

      // Update statistics
      this.updateQueueStats({
        processingRate,
        failureRate,
        totalQueued: this.queueStats.totalQueued - successCount
      });

      this.logger.info('Queue processing completed', {
        sessionId,
        successCount,
        failureCount,
        processingTime,
        processingRate
      });

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Queue processing failed', error, { sessionId });
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Queue processing failed: ${error}`,
        'Failed to process message queue',
        { error: error?.toString(), sessionId }
      ));
    } finally {
      this.processingQueues.delete(sessionId);
    }
  }

  /**
   * Test connection quality
   */
  async testConnectionQuality(): Promise<Result<void>> {
    if (!this.networkState.online) {
      return createResult.success(undefined);
    }

    try {
      const startTime = performance.now();
      
      // Simple connection test using fetch
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      });

      const endTime = performance.now();
      const latency = endTime - startTime;

      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 10) {
        this.latencyHistory.shift();
      }

      const averageLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;

      // Determine connection quality based on latency
      let connectionQuality: NetworkState['connectionQuality'];
      if (averageLatency < 100) {
        connectionQuality = 'excellent';
      } else if (averageLatency < 300) {
        connectionQuality = 'good';
      } else {
        connectionQuality = 'poor';
      }

      this.networkState = {
        ...this.networkState,
        connectionQuality,
        latency: averageLatency
      };

      this.connectionMetrics.averageLatency = averageLatency;
      this.lastConnectionTest = new Date();

      return createResult.success(undefined);
    } catch (error) {
      this.logger.warn('Connection quality test failed', error);
      this.networkState.connectionQuality = 'poor';
      return createResult.success(undefined); // Non-critical failure
    }
  }

  /**
   * Get retry delay for failed message
   */
  calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryBaseDelay;
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, retryCount),
      this.config.maxRetryDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return exponentialDelay + jitter;
  }

  /**
   * Check if message should be retried
   */
  shouldRetryMessage(retryCount: number, lastError?: Error): boolean {
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    if (!this.networkState.online) {
      return false;
    }

    // Don't retry certain types of errors
    if (lastError?.message.includes('authentication') || 
        lastError?.message.includes('unauthorized')) {
      return false;
    }

    return true;
  }

  /**
   * Cleanup and destroy manager
   */
  destroy(): void {
    this.logger.info('Destroying NetworkStateManager');

    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.connectionQualityInterval) {
      clearInterval(this.connectionQualityInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      if (this.onlineListener) {
        window.removeEventListener('online', this.onlineListener);
      }
      if (this.offlineListener) {
        window.removeEventListener('offline', this.offlineListener);
      }
      if (this.connectionChangeListener) {
        // Remove connection change listener if available
        if ('connection' in navigator) {
          (navigator as any).connection?.removeEventListener('change', this.connectionChangeListener);
        }
      }
    }

    // Clear listeners
    this.eventListeners = [];
    this.queueProcessors = [];
    this.processingQueues.clear();
  }

  // Private methods

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.onlineListener = () => {
      this.setNetworkState(true);
    };

    this.offlineListener = () => {
      this.setNetworkState(false);
    };

    this.connectionChangeListener = (event: Event) => {
      const connection = (navigator as any).connection;
      if (connection) {
        this.networkState.connectionType = this.mapConnectionType(connection.effectiveType);
        this.networkState.bandwidth = connection.downlink;
        this.notifyStateChange();
      }
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);

    // Network Information API (if available)
    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', this.connectionChangeListener);
    }
  }

  private mapConnectionType(effectiveType: string): NetworkState['connectionType'] {
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
      case '3g':
        return 'cellular';
      case '4g':
        return 'cellular';
      default:
        return 'unknown';
    }
  }

  private notifyStateChange(): void {
    const state = this.getNetworkState();
    for (const listener of this.eventListeners) {
      try {
        listener(state);
      } catch (error) {
        this.logger.error('Network state listener failed', error);
      }
    }
  }

  private onConnectionRestored(): void {
    this.logger.info('Connection restored, triggering queue processing');
    
    // Test connection quality after restoration
    this.testConnectionQuality();
    
    // Start immediate queue processing
    this.processAllQueues();
  }

  private async processAllQueues(): Promise<void> {
    if (!this.networkState.online || this.queueProcessors.length === 0) {
      return;
    }

    // Process queues with registered processors
    for (const processor of this.queueProcessors) {
      try {
        await processor('*', []); // Signal to process all sessions
      } catch (error) {
        this.logger.error('Queue processor failed', error);
      }
    }
  }

  private async processWithRegisteredProcessors(sessionId: string, messages: any[]): Promise<void> {
    if (this.queueProcessors.length === 0) {
      throw new Error('No queue processors registered');
    }

    for (const processor of this.queueProcessors) {
      await processor(sessionId, messages);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startQueueProcessing(): void {
    this.processingInterval = setInterval(() => {
      if (this.networkState.online) {
        this.processAllQueues();
      }
    }, this.config.processingInterval);
  }

  private startConnectionQualityMonitoring(): void {
    this.connectionQualityInterval = setInterval(() => {
      if (this.networkState.online) {
        this.testConnectionQuality();
      }
    }, 30000); // Test every 30 seconds
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      // Update uptime/downtime metrics
      const now = new Date();
      if (this.networkState.online && this.connectionMetrics.lastConnectedAt) {
        this.connectionMetrics.uptime += now.getTime() - this.connectionMetrics.lastConnectedAt.getTime();
        this.connectionMetrics.lastConnectedAt = now;
      } else if (!this.networkState.online && this.connectionMetrics.lastDisconnectedAt) {
        this.connectionMetrics.downtime += now.getTime() - this.connectionMetrics.lastDisconnectedAt.getTime();
        this.connectionMetrics.lastDisconnectedAt = now;
      }
    }, 60000); // Update every minute
  }
}

// Singleton instance
let networkStateManager: NetworkStateManager | null = null;

/**
 * Get global NetworkStateManager instance
 */
export function getNetworkStateManager(): NetworkStateManager {
  if (!networkStateManager) {
    networkStateManager = new NetworkStateManager();
  }
  return networkStateManager;
}

/**
 * Initialize global NetworkStateManager
 */
export async function initializeNetworkStateManager(
  config?: Partial<QueueProcessorConfig>
): Promise<Result<NetworkStateManager>> {
  try {
    const manager = new NetworkStateManager(config);
    const result = await manager.initialize();
    
    if (result.success) {
      networkStateManager = manager;
      return createResult.success(manager);
    } else {
      return createResult.error(result.error!);
    }
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.UNKNOWN_ERROR,
      `Failed to initialize NetworkStateManager: ${error}`,
      'Failed to initialize network state management',
      { error: error?.toString() }
    ));
  }
}

/**
 * Cleanup global NetworkStateManager
 */
export function cleanupNetworkStateManager(): void {
  if (networkStateManager) {
    networkStateManager.destroy();
    networkStateManager = null;
  }
} 