/**
 * Unified message transport abstraction for SolConnect
 * Provides consistent interface for WebSocket and QUIC transports
 */

import { ChatSession, Message } from '../../types';
import { SolConnectError, ErrorCode, ErrorCategory, Result, createResult } from '../../types/errors';
import { AnySyncMessage, SyncMessageType } from '../sync/SyncProtocol';

export interface DeliveryReceipt {
  messageId: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'failed';
}

export interface Connection {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  close: () => Promise<void>;
}

export interface Subscription {
  id: string;
  unsubscribe: () => void;
}

export type MessageHandler = (message: Message) => void;
export type SyncMessageHandler = (message: AnySyncMessage) => void;
export type RelayMessageHandler = (message: any) => void;

/**
 * Abstract message transport interface
 */
export abstract class MessageTransport {
  protected handlers = new Map<string, MessageHandler>();
  protected syncHandlers = new Set<SyncMessageHandler>();
  protected relayHandlers = new Set<RelayMessageHandler>();
  protected connection: Connection | null = null;

  abstract connect(endpoint: string): Promise<Result<Connection>>;
  abstract send(session: ChatSession, message: string): Promise<Result<DeliveryReceipt>>;
  abstract sendSyncMessage(message: AnySyncMessage): Promise<Result<void>>;
  abstract sendRawMessage(message: any): Promise<Result<void>>;
  abstract disconnect(): Promise<Result<void>>;

  /**
   * Subscribe to incoming messages for a session
   */
  subscribe(sessionId: string, handler: MessageHandler): Subscription {
    const subscriptionId = `${sessionId}-${Date.now()}`;
    this.handlers.set(subscriptionId, handler);

    return {
      id: subscriptionId,
      unsubscribe: () => {
        this.handlers.delete(subscriptionId);
      }
    };
  }

  /**
   * Subscribe to sync messages
   */
  onSyncMessage(handler: SyncMessageHandler): void {
    this.syncHandlers.add(handler);
  }

  /**
   * Unsubscribe from sync messages
   */
  offSyncMessage(handler: SyncMessageHandler): void {
    this.syncHandlers.delete(handler);
  }

  /**
   * Subscribe to relay messages (for real-time events like reactions, typing indicators)
   */
  onRelayMessage(handler: RelayMessageHandler): void {
    this.relayHandlers.add(handler);
  }

  /**
   * Unsubscribe from relay messages
   */
  offRelayMessage(handler: RelayMessageHandler): void {
    this.relayHandlers.delete(handler);
  }

  /**
   * Get current connection status
   */
  get connectionStatus(): Connection['status'] {
    return this.connection?.status || 'disconnected';
  }

  /**
   * Check if transport is connected
   */
  get isConnected(): boolean {
    return this.connection?.status === 'connected';
  }

  protected handleIncomingMessage(message: Message): void {
    // Notify all relevant handlers
    for (const [subscriptionId, handler] of this.handlers.entries()) {
      if (subscriptionId.startsWith(message.session_id || '')) {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      }
    }
  }

  protected handleIncomingSyncMessage(message: AnySyncMessage): void {
    // Notify all sync handlers
    for (const handler of this.syncHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in sync message handler:', error);
      }
    }
  }

  protected handleIncomingRelayMessage(message: any): void {
    // Notify all relay handlers
    for (const handler of this.relayHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in relay message handler:', error);
      }
    }
  }

  protected createConnection(
    id: string, 
    status: Connection['status'], 
    closeHandler: () => Promise<void>
  ): Connection {
    return {
      id,
      status,
      close: closeHandler
    };
  }
}

/**
 * WebSocket-based transport for development and web environments
 */
export class WebSocketTransport extends MessageTransport {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second

  async connect(endpoint: string): Promise<Result<Connection>> {
    try {
      // Close existing connection if any
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(endpoint);
      
      return new Promise((resolve) => {
        if (!this.ws) {
          resolve(createResult.error(SolConnectError.network(
            ErrorCode.CONNECTION_FAILED,
            'WebSocket instance not created',
            'Failed to create WebSocket connection'
          )));
          return;
        }

        const connectionId = `ws-${Date.now()}`;
        
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.connection = this.createConnection(
            connectionId,
            'connected',
            () => this.disconnect()
          );
          
          resolve(createResult.success(this.connection));
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check if this is a sync message
            if (data.type && Object.values(SyncMessageType).includes(data.type)) {
              this.handleIncomingSyncMessage(data as AnySyncMessage);
              return;
            }

            // Check if this is a relay message (reactions, typing indicators, etc.)
            if (data.type && ['reaction_event', 'status_update', 'delivery_receipt', 'read_receipt', 'typing_indicator'].includes(data.type)) {
              this.handleIncomingRelayMessage(data);
              return;
            }
            
            if (data.error) {
              console.error('WebSocket error message:', data.error);
              return;
            }

            // Convert WebSocket message to our Message format
            const message: Message = {
              sender_wallet: data.sender || 'unknown',
              ciphertext: data.text || data.message || '',
              timestamp: data.timestamp || new Date().toISOString(),
              session_id: data.room || data.sessionId || data.roomId
            };

            this.handleIncomingMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connection = this.createConnection(connectionId, 'error', () => this.disconnect());
          
          resolve(createResult.error(SolConnectError.network(
            ErrorCode.CONNECTION_FAILED,
            'WebSocket connection error',
            'Failed to connect to the relay server',
            { error: error.toString() }
          )));
        };

        this.ws.onclose = () => {
          if (this.connection) {
            this.connection = this.createConnection(connectionId, 'disconnected', () => this.disconnect());
          }
          this.attemptReconnect(endpoint);
        };

        // Set connection to connecting state
        this.connection = this.createConnection(connectionId, 'connecting', () => this.disconnect());

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            resolve(createResult.error(SolConnectError.network(
              ErrorCode.TIMEOUT,
              'WebSocket connection timeout',
              'Connection timed out. Please try again.'
            )));
          }
        }, 10000);
      });
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `WebSocket connection failed: ${error}`,
        'Failed to connect to the relay server',
        { error: error?.toString() }
      ));
    }
  }

  async send(session: ChatSession, message: string): Promise<Result<DeliveryReceipt>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'WebSocket not connected',
        'Not connected to relay server'
      ));
    }

    try {
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Format message for WebSocket relay
      const payload = {
        roomId: session.session_id,
        message: message,
        sender: session.peer_wallet, // This should be current user's wallet
        timestamp: new Date().toISOString(),
        messageId
      };

      this.ws.send(JSON.stringify(payload));

      const receipt: DeliveryReceipt = {
        messageId,
        timestamp: Date.now(),
        status: 'sent'
      };

      return createResult.success(receipt);
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to send message: ${error}`,
        'Failed to send message. Please try again.',
        { error: error?.toString() }
      ));
    }
  }

  async sendSyncMessage(message: AnySyncMessage): Promise<Result<void>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'WebSocket not connected',
        'Not connected to sync service'
      ));
    }

    try {
      this.ws.send(JSON.stringify(message));
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to send sync message: ${error}`,
        'Failed to send sync message',
        { error: error?.toString() }
      ));
    }
  }

  async sendRawMessage(message: any): Promise<Result<void>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return createResult.error(SolConnectError.network(
        ErrorCode.RELAY_DISCONNECTED,
        'WebSocket not connected',
        'Not connected to relay server'
      ));
    }

    try {
      this.ws.send(JSON.stringify(message));
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `Failed to send raw message: ${error}`,
        'Failed to send message',
        { error: error?.toString() }
      ));
    }
  }

  async disconnect(): Promise<Result<void>> {
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.connection = null;
      this.handlers.clear();
      this.syncHandlers.clear();
      this.relayHandlers.clear();
      
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

  private attemptReconnect(endpoint: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.connect(endpoint).then((result) => {
        if (!result.success) {
          console.error('Reconnection failed:', result.error);
        }
      });
    }, this.reconnectInterval * Math.pow(2, this.reconnectAttempts)); // Exponential backoff
  }
}

/**
 * QUIC-based transport for production environments
 * This is a placeholder for the actual QUIC implementation
 */
export class QuicTransport extends MessageTransport {
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private isConnecting = false;

  async connect(endpoint: string): Promise<Result<Connection>> {
    if (this.isConnecting) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        'Connection already in progress',
        'Please wait for the current connection attempt to complete'
      ));
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    try {
      // Log connection attempt for debugging
      console.log(`[QuicTransport] Attempting to connect to ${endpoint} (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);

      // TODO: Implement QUIC connection using the Rust relay server
      // For now, simulate connection delay and return error
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        return createResult.error(SolConnectError.network(
          ErrorCode.CONNECTION_FAILED,
          'QUIC transport not yet implemented - max attempts reached',
          'QUIC transport is not available yet. Please use WebSocket transport for now.',
          { 
            endpoint,
            attempts: this.connectionAttempts,
            maxAttempts: this.maxConnectionAttempts
          }
        ));
      }

      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        'QUIC transport not yet implemented',
        'QUIC transport is not available yet. Please use WebSocket transport for now.',
        { 
          endpoint,
          attempts: this.connectionAttempts,
          maxAttempts: this.maxConnectionAttempts
        }
      ));
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.CONNECTION_FAILED,
        `QUIC connection failed: ${error}`,
        'Failed to establish QUIC connection',
        { 
          error: error?.toString(),
          endpoint,
          attempts: this.connectionAttempts
        }
      ));
    } finally {
      this.isConnecting = false;
    }
  }

  async send(session: ChatSession, message: string): Promise<Result<DeliveryReceipt>> {
    return createResult.error(SolConnectError.network(
      ErrorCode.CONNECTION_FAILED,
      'QUIC transport not yet implemented',
      'QUIC transport is not available yet. Please use WebSocket transport for now.',
      { sessionId: session.session_id }
    ));
  }

  async sendSyncMessage(message: AnySyncMessage): Promise<Result<void>> {
    return createResult.error(SolConnectError.network(
      ErrorCode.CONNECTION_FAILED,
      'QUIC transport not yet implemented',
      'QUIC transport is not available yet. Please use WebSocket transport for now.'
    ));
  }

  async sendRawMessage(message: any): Promise<Result<void>> {
    return createResult.error(SolConnectError.network(
      ErrorCode.CONNECTION_FAILED,
      'QUIC transport not yet implemented',
      'QUIC transport is not available yet. Please use WebSocket transport for now.'
    ));
  }

  async disconnect(): Promise<Result<void>> {
    this.isConnecting = false;
    this.connectionAttempts = 0;
    return createResult.success(undefined);
  }

  /**
   * Get transport capabilities
   */
  getCapabilities() {
    return {
      name: 'QUIC',
      version: '0.1.0',
      features: ['reliable', 'ordered', 'multiplexed'],
      status: 'not_implemented',
      fallback: 'websocket'
    };
  }
}

/**
 * Transport factory for creating appropriate transport instances
 */
export class TransportFactory {
  static create(type: 'websocket' | 'quic' = 'websocket'): MessageTransport {
    switch (type) {
      case 'websocket':
        return new WebSocketTransport();
      case 'quic':
        return new QuicTransport();
      default:
        throw new Error(`Unknown transport type: ${type}`);
    }
  }

  static createForEnvironment(): MessageTransport {
    // Use WebSocket for development, QUIC for production
    const isProduction = process.env.NODE_ENV === 'production';
    return this.create(isProduction ? 'quic' : 'websocket');
  }
}