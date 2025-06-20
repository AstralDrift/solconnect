import { Result } from '@/types';
import { Logger } from '../monitoring/Logger';
import { MessageBus } from '../MessageBus';
import { RelayConnection, RelayEndpoint } from './RelayManager';

export interface FailoverConfig {
  maxFailoverTime: number; // ms - target failover completion time
  messageQueueSize: number; // max messages to queue during failover
  statePreservationTimeout: number; // ms - max time to preserve state
  retryAttempts: number;
  retryDelay: number; // ms
  gracefulDisconnectTimeout: number; // ms
}

export interface FailoverState {
  isFailingOver: boolean;
  startTime: number;
  sourceRelay: RelayEndpoint | null;
  targetRelay: RelayEndpoint | null;
  preservedMessages: QueuedMessage[];
  subscriptions: Set<string>;
  activeRequests: Map<string, PendingRequest>;
}

export interface QueuedMessage {
  id: string;
  content: any;
  timestamp: number;
  attempts: number;
  priority: 'high' | 'normal' | 'low';
}

export interface PendingRequest {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  callback: (result: any) => void;
  timeout: NodeJS.Timeout;
}

export interface FailoverMetrics {
  totalFailovers: number;
  averageFailoverTime: number;
  messagesPreserved: number;
  messagesLost: number;
  statePreservationSuccessRate: number;
  lastFailoverTime: number;
}

/**
 * Reliability-first failover manager with state preservation and zero-downtime switching
 */
export class FailoverManager {
  private logger = new Logger('FailoverManager');
  private messageBus: MessageBus;
  private config: FailoverConfig;
  
  private failoverState: FailoverState;
  private metrics: FailoverMetrics;
  private messageQueue: QueuedMessage[] = [];
  private subscriptions = new Set<string>();
  private activeRequests = new Map<string, PendingRequest>();
  
  private queueProcessingInterval: NodeJS.Timeout | null = null;

  constructor(messageBus: MessageBus, config?: Partial<FailoverConfig>) {
    this.messageBus = messageBus;
    this.config = { ...this.getDefaultConfig(), ...config };
    
    this.failoverState = this.initializeFailoverState();
    this.metrics = this.initializeMetrics();
    
    this.startQueueProcessing();
  }

  /**
   * Execute seamless failover from source to target relay
   */
  async executeFailover(
    sourceConnection: RelayConnection,
    targetConnection: RelayConnection
  ): Promise<Result<void>> {
    const startTime = Date.now();
    
    try {
      this.logger.warn('Starting relay failover', {
        sourceRelay: sourceConnection.relay.id,
        targetRelay: targetConnection.relay.id,
        queuedMessages: this.messageQueue.length
      });

      // Initialize failover state
      this.failoverState = {
        isFailingOver: true,
        startTime,
        sourceRelay: sourceConnection.relay,
        targetRelay: targetConnection.relay,
        preservedMessages: [...this.messageQueue],
        subscriptions: new Set(this.subscriptions),
        activeRequests: new Map(this.activeRequests)
      };

      // Step 1: Preserve connection state
      await this.preserveConnectionState(sourceConnection);

      // Step 2: Gracefully disconnect from source
      await this.gracefulDisconnect(sourceConnection);

      // Step 3: Establish target connection state
      await this.restoreConnectionState(targetConnection);

      // Step 4: Process preserved messages
      await this.processPreservedMessages(targetConnection);

      // Step 5: Resume normal operations
      await this.resumeNormalOperations(targetConnection);

      const failoverTime = Date.now() - startTime;
      
      // Update metrics
      this.updateFailoverMetrics(failoverTime);
      
      // Reset failover state
      this.failoverState.isFailingOver = false;
      
      this.logger.info('Relay failover completed successfully', {
        sourceRelay: sourceConnection.relay.id,
        targetRelay: targetConnection.relay.id,
        failoverTime: `${failoverTime}ms`,
        messagesPreserved: this.failoverState.preservedMessages.length
      });

      // Emit failover success event
      this.messageBus.emit('RELAY_FAILOVER_SUCCESS', {
        sourceRelay: sourceConnection.relay,
        targetRelay: targetConnection.relay,
        failoverTime,
        messagesPreserved: this.failoverState.preservedMessages.length
      });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Relay failover failed', error);
      
      // Reset failover state on error
      this.failoverState.isFailingOver = false;
      
      // Emit failover failure event
      this.messageBus.emit('RELAY_FAILOVER_FAILED', {
        sourceRelay: sourceConnection.relay,
        targetRelay: targetConnection.relay,
        error: error.message,
        failoverTime: Date.now() - startTime
      });

      return {
        success: false,
        error: new Error(`Failover failed: ${error.message}`)
      };
    }
  }

  /**
   * Preserve state from current connection before failover
   */
  private async preserveConnectionState(connection: RelayConnection): Promise<void> {
    const preservationStart = Date.now();
    
    try {
      this.logger.debug('Preserving connection state', { relayId: connection.relay.id });

      // 1. Capture pending messages from WebSocket
      await this.capturePendingMessages(connection);

      // 2. Save active subscriptions
      await this.captureActiveSubscriptions(connection);

      // 3. Preserve pending requests
      await this.capturePendingRequests(connection);

      // 4. Save session state
      await this.captureSessionState(connection);

      const preservationTime = Date.now() - preservationStart;
      this.logger.debug('State preservation completed', {
        relayId: connection.relay.id,
        preservationTime: `${preservationTime}ms`,
        capturedMessages: this.failoverState.preservedMessages.length,
        capturedSubscriptions: this.failoverState.subscriptions.size
      });
    } catch (error) {
      this.logger.error('Failed to preserve connection state', error);
      throw new Error(`State preservation failed: ${error.message}`);
    }
  }

  /**
   * Gracefully disconnect from source relay
   */
  private async gracefulDisconnect(connection: RelayConnection): Promise<void> {
    try {
      this.logger.debug('Gracefully disconnecting from relay', { relayId: connection.relay.id });

      // Send disconnect notification if connection is still active
      if (connection.state === 'connected') {
        try {
          // Send graceful disconnect message
          const disconnectMessage = JSON.stringify({
            type: 'disconnect',
            reason: 'failover',
            timestamp: Date.now()
          });
          
          connection.websocket.send(disconnectMessage);
          
          // Wait briefly for acknowledgment
          await this.waitWithTimeout(100);
        } catch (error) {
          this.logger.warn('Failed to send graceful disconnect', error);
        }
      }

      // Close WebSocket connection
      connection.state = 'disconnecting';
      connection.websocket.close();

      // Wait for clean close or timeout
      await this.waitForDisconnect(connection);
      
      this.logger.debug('Graceful disconnect completed', { relayId: connection.relay.id });
    } catch (error) {
      this.logger.error('Graceful disconnect failed', error);
      // Continue with failover even if graceful disconnect fails
    }
  }

  /**
   * Restore connection state on target relay
   */
  private async restoreConnectionState(connection: RelayConnection): Promise<void> {
    try {
      this.logger.debug('Restoring connection state', { relayId: connection.relay.id });

      // 1. Restore subscriptions
      await this.restoreSubscriptions(connection);

      // 2. Restore session state
      await this.restoreSessionState(connection);

      // 3. Initialize message handling
      await this.initializeMessageHandling(connection);

      this.logger.debug('Connection state restored', { relayId: connection.relay.id });
    } catch (error) {
      this.logger.error('Failed to restore connection state', error);
      throw new Error(`State restoration failed: ${error.message}`);
    }
  }

  /**
   * Process preserved messages on new connection
   */
  private async processPreservedMessages(connection: RelayConnection): Promise<void> {
    const { preservedMessages } = this.failoverState;
    
    if (preservedMessages.length === 0) {
      return;
    }

    this.logger.debug('Processing preserved messages', {
      relayId: connection.relay.id,
      messageCount: preservedMessages.length
    });

    let processed = 0;
    let failed = 0;

    // Sort messages by priority and timestamp
    const sortedMessages = preservedMessages.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });

    // Process messages in batches to avoid overwhelming the connection
    const batchSize = 10;
    for (let i = 0; i < sortedMessages.length; i += batchSize) {
      const batch = sortedMessages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (message) => {
        try {
          await this.sendPreservedMessage(connection, message);
          processed++;
        } catch (error) {
          this.logger.warn('Failed to send preserved message', {
            messageId: message.id,
            error: error.message
          });
          failed++;
          
          // Retry high priority messages
          if (message.priority === 'high' && message.attempts < this.config.retryAttempts) {
            message.attempts++;
            this.messageQueue.push(message);
          }
        }
      });

      await Promise.allSettled(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < sortedMessages.length) {
        await this.waitWithTimeout(10);
      }
    }

    this.logger.info('Preserved message processing completed', {
      relayId: connection.relay.id,
      processed,
      failed,
      total: preservedMessages.length
    });

    // Update metrics
    this.metrics.messagesPreserved += processed;
    this.metrics.messagesLost += failed;
  }

  /**
   * Resume normal operations after failover
   */
  private async resumeNormalOperations(connection: RelayConnection): Promise<void> {
    try {
      this.logger.debug('Resuming normal operations', { relayId: connection.relay.id });

      // Resume message queue processing
      this.startQueueProcessing();

      // Notify MessageBus of successful failover
      this.messageBus.emit('RELAY_RECONNECTED', {
        relay: connection.relay,
        connection: connection
      });

      // Clear failover state
      this.clearFailoverState();

      this.logger.debug('Normal operations resumed', { relayId: connection.relay.id });
    } catch (error) {
      this.logger.error('Failed to resume normal operations', error);
      throw error;
    }
  }

  /**
   * Queue message during failover
   */
  queueMessage(content: any, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedMessage: QueuedMessage = {
      id: messageId,
      content,
      timestamp: Date.now(),
      attempts: 0,
      priority
    };

    this.messageQueue.push(queuedMessage);
    
    // Limit queue size
    if (this.messageQueue.length > this.config.messageQueueSize) {
      // Remove oldest low priority messages
      const lowPriorityIndex = this.messageQueue.findIndex(m => m.priority === 'low');
      if (lowPriorityIndex >= 0) {
        this.messageQueue.splice(lowPriorityIndex, 1);
        this.logger.warn('Message queue full, removed low priority message');
      }
    }

    this.logger.debug('Message queued for failover', {
      messageId,
      priority,
      queueSize: this.messageQueue.length
    });

    return messageId;
  }

  /**
   * Check if currently failing over
   */
  isFailingOver(): boolean {
    return this.failoverState.isFailingOver;
  }

  /**
   * Get current failover metrics
   */
  getMetrics(): FailoverMetrics {
    return { ...this.metrics };
  }

  // Private helper methods
  private async capturePendingMessages(connection: RelayConnection): Promise<void> {
    // In a real implementation, this would capture messages from the WebSocket buffer
    // For now, we'll capture from our internal queue
    this.failoverState.preservedMessages = [...this.messageQueue];
  }

  private async captureActiveSubscriptions(connection: RelayConnection): Promise<void> {
    // Capture current subscriptions
    this.failoverState.subscriptions = new Set(this.subscriptions);
  }

  private async capturePendingRequests(connection: RelayConnection): Promise<void> {
    // Capture pending requests that need responses
    this.failoverState.activeRequests = new Map(this.activeRequests);
  }

  private async captureSessionState(connection: RelayConnection): Promise<void> {
    // Capture session-specific state
    // This would include authentication tokens, session IDs, etc.
  }

  private async restoreSubscriptions(connection: RelayConnection): Promise<void> {
    const subscriptions = Array.from(this.failoverState.subscriptions);
    
    for (const subscription of subscriptions) {
      try {
        // Re-subscribe to channels/topics
        const subscribeMessage = JSON.stringify({
          type: 'subscribe',
          channel: subscription,
          timestamp: Date.now()
        });
        
        connection.websocket.send(subscribeMessage);
      } catch (error) {
        this.logger.warn('Failed to restore subscription', { subscription, error });
      }
    }
  }

  private async restoreSessionState(connection: RelayConnection): Promise<void> {
    // Restore session-specific state like authentication
    // This would send authentication messages, session restoration, etc.
  }

  private async initializeMessageHandling(connection: RelayConnection): Promise<void> {
    // Set up message handlers for the new connection
    // This integrates with the existing MessageBus system
  }

  private async sendPreservedMessage(connection: RelayConnection, message: QueuedMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message send timeout'));
      }, 5000);

      try {
        connection.websocket.send(JSON.stringify(message.content));
        connection.messagesSent++;
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private async waitForDisconnect(connection: RelayConnection): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(); // Timeout reached, continue
      }, this.config.gracefulDisconnectTimeout);

      const checkState = () => {
        if (connection.websocket.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkState, 10);
        }
      };

      checkState();
    });
  }

  private async waitWithTimeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      return; // Already running
    }

    this.queueProcessingInterval = setInterval(() => {
      if (!this.failoverState.isFailingOver && this.messageQueue.length > 0) {
        // Process queued messages when not failing over
        // This would integrate with the active connection
        this.logger.debug('Processing message queue', { queueSize: this.messageQueue.length });
      }
    }, 100);
  }

  private clearFailoverState(): void {
    this.failoverState.preservedMessages = [];
    this.failoverState.subscriptions.clear();
    this.failoverState.activeRequests.clear();
    this.messageQueue = [];
  }

  private updateFailoverMetrics(failoverTime: number): void {
    this.metrics.totalFailovers++;
    this.metrics.lastFailoverTime = failoverTime;
    
    // Update average failover time
    const totalTime = (this.metrics.averageFailoverTime * (this.metrics.totalFailovers - 1)) + failoverTime;
    this.metrics.averageFailoverTime = totalTime / this.metrics.totalFailovers;
    
    // Update state preservation success rate
    const totalMessages = this.metrics.messagesPreserved + this.metrics.messagesLost;
    this.metrics.statePreservationSuccessRate = totalMessages > 0 
      ? (this.metrics.messagesPreserved / totalMessages) * 100 
      : 100;
  }

  private getDefaultConfig(): FailoverConfig {
    return {
      maxFailoverTime: 500, // 500ms target
      messageQueueSize: 1000,
      statePreservationTimeout: 1000,
      retryAttempts: 3,
      retryDelay: 100,
      gracefulDisconnectTimeout: 2000
    };
  }

  private initializeFailoverState(): FailoverState {
    return {
      isFailingOver: false,
      startTime: 0,
      sourceRelay: null,
      targetRelay: null,
      preservedMessages: [],
      subscriptions: new Set(),
      activeRequests: new Map()
    };
  }

  private initializeMetrics(): FailoverMetrics {
    return {
      totalFailovers: 0,
      averageFailoverTime: 0,
      messagesPreserved: 0,
      messagesLost: 0,
      statePreservationSuccessRate: 100,
      lastFailoverTime: 0
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    this.logger.info('Shutting down FailoverManager');
    
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }

    // Clear any pending timeouts in active requests
    for (const request of this.activeRequests.values()) {
      clearTimeout(request.timeout);
    }

    this.clearFailoverState();
    this.logger.info('FailoverManager shutdown complete');
  }
}