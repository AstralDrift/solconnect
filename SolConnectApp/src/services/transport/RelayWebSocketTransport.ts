import { ChatSession, Message } from '../../types';
import { SolConnectError, ErrorCode, Result, createResult } from '../../types/errors';
import { AnySyncMessage, SyncMessageType } from '../sync/SyncProtocol';
import { MessageTransport, DeliveryReceipt, Connection } from './MessageTransport';
import { RelayManager, RelayConfig, RelayConnection } from '../relay/RelayManager';
import { Logger } from '../monitoring/Logger';
import { getRelayConfig } from '../../config/relay.config';

/**
 * WebSocket transport with intelligent relay failover support
 */
export class RelayWebSocketTransport extends MessageTransport {
  private logger = new Logger('RelayWebSocketTransport');
  private relayManager: RelayManager;
  private messageQueue: Map<string, any> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isInitialized = false;

  constructor(relayConfig?: Partial<RelayConfig>) {
    super();
    
    // Get environment-specific configuration
    const baseConfig = getRelayConfig();
    
    // Merge with any custom configuration
    const finalConfig = relayConfig 
      ? { ...baseConfig, ...relayConfig }
      : baseConfig;

    this.relayManager = new RelayManager(finalConfig);
    this.setupRelayEventHandlers();
  }

  /**
   * Connect to relay network with automatic failover
   */
  async connect(endpoint?: string): Promise<Result<Connection>> {
    try {
      if (!this.isInitialized) {
        const initResult = await this.relayManager.initialize();
        if (!initResult.success) {
          return createResult.error(SolConnectError.network(
            ErrorCode.CONNECTION_FAILED,
            'Failed to initialize relay manager',
            'Could not initialize relay network connection'
          ));
        }
        this.isInitialized = true;
      }

      const primaryConnection = this.relayManager.getPrimaryConnection();
      if (!primaryConnection) {
        return createResult.error(SolConnectError.network(
          ErrorCode.CONNECTION_FAILED,
          'No primary relay connection available',
          'Failed to establish connection to relay network'
        ));
      }

      this.connection = this.createConnection(
        `relay-${Date.now()}`,
        'connected',
        () => this.disconnect()
      );

      this.logger.info('Connected to relay network', {
        primaryRelay: primaryConnection.relay.id,
        availableRelays: this.relayManager.getAvailableRelays().length
      });

      // Process any queued messages
      await this.processMessageQueue();

      return createResult.success(this.connection);
    } catch (error) {
      this.logger.error('Failed to connect to relay network', error);
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Relay connection failed: ${error}`,
        'Failed to connect to relay network',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send message through relay network with automatic failover
   */
  async send(session: ChatSession, message: string): Promise<Result<DeliveryReceipt>> {
    const primaryConnection = this.relayManager.getPrimaryConnection();
    
    if (!primaryConnection || primaryConnection.state !== 'connected') {
      // Queue message for later delivery
      const messageId = this.generateMessageId();
      this.messageQueue.set(messageId, { session, message, timestamp: Date.now() });
      
      // Attempt to reconnect
      await this.connect();
      
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'No active relay connection',
        'Message queued for delivery when connection is restored'
      ));
    }

    try {
      const messageId = this.generateMessageId();
      const payload = {
        roomId: session.session_id,
        message: message,
        sender: session.peer_wallet,
        timestamp: new Date().toISOString(),
        messageId
      };

      primaryConnection.websocket.send(JSON.stringify(payload));
      primaryConnection.messagesSent++;

      const receipt: DeliveryReceipt = {
        messageId,
        timestamp: Date.now(),
        status: 'sent'
      };

      this.logger.debug('Message sent through relay', {
        messageId,
        relayId: primaryConnection.relay.id,
        sessionId: session.session_id
      });

      return createResult.success(receipt);
    } catch (error) {
      this.logger.error('Failed to send message', error);
      
      // Trigger failover on send failure
      const failoverResult = await this.relayManager.performFailover();
      if (failoverResult.success) {
        // Retry send with new connection
        return this.send(session, message);
      }

      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to send message: ${error}`,
        'Failed to send message. Please try again.',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send sync message through relay network
   */
  async sendSyncMessage(message: AnySyncMessage): Promise<Result<void>> {
    const primaryConnection = this.relayManager.getPrimaryConnection();
    
    if (!primaryConnection || primaryConnection.state !== 'connected') {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'No active relay connection',
        'Not connected to sync service'
      ));
    }

    try {
      primaryConnection.websocket.send(JSON.stringify(message));
      primaryConnection.messagesSent++;
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to send sync message', error);
      
      // Trigger failover on send failure
      await this.relayManager.performFailover();
      
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to send sync message: ${error}`,
        'Failed to send sync message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send raw message through relay network
   */
  async sendRawMessage(message: any): Promise<Result<void>> {
    const primaryConnection = this.relayManager.getPrimaryConnection();
    
    if (!primaryConnection || primaryConnection.state !== 'connected') {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'No active relay connection',
        'Not connected to relay server'
      ));
    }

    try {
      primaryConnection.websocket.send(JSON.stringify(message));
      primaryConnection.messagesSent++;
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to send raw message', error);
      
      // Trigger failover on send failure
      await this.relayManager.performFailover();
      
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to send raw message: ${error}`,
        'Failed to send message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Disconnect from relay network
   */
  async disconnect(): Promise<Result<void>> {
    try {
      await this.relayManager.shutdown();
      this.connection = null;
      this.handlers.clear();
      this.syncHandlers.clear();
      this.relayHandlers.clear();
      this.messageQueue.clear();
      this.isInitialized = false;
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to disconnect: ${error}`,
        'Error occurred while disconnecting',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get relay network metrics
   */
  getRelayMetrics() {
    return this.relayManager.getMetrics();
  }

  /**
   * Get available relays
   */
  getAvailableRelays() {
    return this.relayManager.getAvailableRelays();
  }

  /**
   * Get active relay connections
   */
  getActiveConnections() {
    return this.relayManager.getActiveConnections();
  }

  /**
   * Setup relay event handlers
   */
  private setupRelayEventHandlers() {
    // Handle incoming messages from any relay
    this.relayManager.on('messageReceived', ({ connection, data }) => {
      try {
        const parsed = JSON.parse(data);
        
        // Check if this is a sync message
        if (parsed.type && Object.values(SyncMessageType).includes(parsed.type)) {
          this.handleIncomingSyncMessage(parsed as AnySyncMessage);
          return;
        }

        // Check if this is a relay message
        if (parsed.type && ['reaction_event', 'status_update', 'delivery_receipt', 'read_receipt', 'typing_indicator'].includes(parsed.type)) {
          this.handleIncomingRelayMessage(parsed);
          return;
        }
        
        // Convert to standard message format
        const message: Message = {
          sender_wallet: parsed.sender || 'unknown',
          ciphertext: parsed.text || parsed.message || '',
          timestamp: parsed.timestamp || new Date().toISOString(),
          session_id: parsed.room || parsed.sessionId || parsed.roomId
        };

        this.handleIncomingMessage(message);
      } catch (error) {
        this.logger.error('Error parsing relay message', error);
      }
    });

    // Handle failover events
    this.relayManager.on('failoverCompleted', ({ oldRelay, newRelay, failoverTime }) => {
      this.logger.info('Relay failover completed', {
        oldRelay: oldRelay?.id,
        newRelay: newRelay.id,
        failoverTime: `${failoverTime}ms`
      });
      
      // Process any queued messages after failover
      this.processMessageQueue();
    });

    // Handle connection events
    this.relayManager.on('primaryConnected', ({ relay }) => {
      this.logger.info('Primary relay connected', { relayId: relay.id });
      if (this.connection) {
        this.connection.status = 'connected';
      }
    });

    this.relayManager.on('connectionClosed', ({ connection }) => {
      this.logger.warn('Relay connection closed', { relayId: connection.relay.id });
      if (this.connection && this.relayManager.getPrimaryConnection()?.state !== 'connected') {
        this.connection.status = 'disconnected';
      }
    });

    // Handle relay discovery
    this.relayManager.on('relayDiscovered', ({ relay }) => {
      this.logger.info('New relay discovered', {
        relayId: relay.id,
        url: relay.url,
        region: relay.region
      });
    });
  }

  /**
   * Process queued messages after reconnection
   */
  private async processMessageQueue() {
    if (this.messageQueue.size === 0) return;

    this.logger.info('Processing message queue', { queueSize: this.messageQueue.size });

    for (const [messageId, queuedMessage] of this.messageQueue.entries()) {
      try {
        const result = await this.send(queuedMessage.session, queuedMessage.message);
        if (result.success) {
          this.messageQueue.delete(messageId);
        }
      } catch (error) {
        this.logger.error('Failed to process queued message', { messageId, error });
      }
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
} 