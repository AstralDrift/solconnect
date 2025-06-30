/**
 * Message handling and processing for SolConnect
 * Manages message routing, validation, acknowledgments, and state updates
 */

import { ProtocolMessage, protocolCodec, ChatMessage, AckMessage, AckStatus, MessageFactory, ReadReceipt } from './ProtocolBuffers';
import { SolConnectError, ErrorCode, Result, createResult } from '../../types/errors';
import { Message, MessageStatus, MessageStatusUpdate } from '../../types';

export interface MessageProcessor {
  processChatMessage(message: ChatMessage): Promise<Result<void>>;
  processAckMessage(message: AckMessage): Promise<Result<void>>;
  processPingMessage(message: any): Promise<Result<void>>;
  processPongMessage(message: any): Promise<Result<void>>;
  processReadReceipt(message: ReadReceipt): Promise<Result<void>>;
}

export interface MessageHandlerConfig {
  enableAutoAck?: boolean;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  messageTimeout?: number;
  maxRetries?: number;
  onStatusUpdate?: (update: MessageStatusUpdate) => void;
}

export interface MessageMetrics {
  messagesSent: number;
  messagesReceived: number;
  acksSent: number;
  acksReceived: number;
  failedMessages: number;
  averageLatency: number;
  connectionQuality?: {
    current: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
    rttHistory: { timestamp: number; rtt: number }[];
    qualityHistory: string[];
  };
}

/**
 * Central message handler for processing all protocol messages
 */
export class MessageHandler implements MessageProcessor {
  private config: Required<MessageHandlerConfig>;
  private metrics: MessageMetrics;
  private pendingMessages = new Map<string, { message: ChatMessage; timestamp: number; retries: number }>();
  private messageHandlers = new Map<string, (message: Message) => void>();
  private ackHandlers = new Map<string, (status: AckStatus) => void>();
  private readReceiptHandlers = new Map<string, (readReceipt: ReadReceipt) => void>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onStatusUpdate?: (update: MessageStatusUpdate) => void;

  constructor(config: MessageHandlerConfig = {}) {
    this.config = {
      enableAutoAck: true,
      enableHeartbeat: true,
      heartbeatInterval: 30000, // 30 seconds
      messageTimeout: 10000, // 10 seconds
      maxRetries: 3,
      onStatusUpdate: undefined,
      ...config
    };

    this.onStatusUpdate = this.config.onStatusUpdate;

    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      acksSent: 0,
      acksReceived: 0,
      failedMessages: 0,
      averageLatency: 0
    };

    if (this.config.enableHeartbeat) {
      this.startHeartbeat();
    }
  }

  /**
   * Process incoming protocol message
   */
  async processMessage(data: Uint8Array): Promise<Result<void>> {
    try {
      const decodeResult = protocolCodec.decodeMessage(data);
      if (!decodeResult.success) {
        return decodeResult;
      }

      const protocolMessage = decodeResult.data!;

      switch (protocolMessage.type) {
        case 'chat':
          return await this.processChatMessage(protocolMessage.payload as ChatMessage);
        case 'ack':
          return await this.processAckMessage(protocolMessage.payload as AckMessage);
        case 'ping':
          return await this.processPingMessage(protocolMessage.payload);
        case 'pong':
          return await this.processPongMessage(protocolMessage.payload);
        case 'read_receipt':
          return await this.processReadReceipt(protocolMessage.payload as ReadReceipt);
        default:
          return createResult.error(SolConnectError.validation(
            ErrorCode.INVALID_MESSAGE_FORMAT,
            `Unknown message type: ${protocolMessage.type}`,
            'Received unknown message type'
          ));
      }
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Error processing message: ${error}`,
        'Failed to process incoming message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Process chat message
   */
  async processChatMessage(message: ChatMessage): Promise<Result<void>> {
    try {
      // Validate message
      const validationResult = protocolCodec.validateChatMessage(message);
      if (!validationResult.success) {
        return validationResult;
      }

      // Check if message should be processed (not expired)
      if (!protocolCodec.shouldProcessMessage(message)) {
        if (this.config.enableAutoAck) {
          await this.sendAck(message.id, AckStatus.EXPIRED);
        }
        return createResult.error(SolConnectError.validation(
          ErrorCode.INVALID_MESSAGE_FORMAT,
          'Message has expired',
          'Received expired message'
        ));
      }

      // Convert to internal message format
      const internalMessage: Message = {
        sender_wallet: message.senderWallet,
        ciphertext: '', // Will be filled after decryption
        timestamp: new Date(message.timestamp).toISOString(),
        session_id: this.generateSessionId(message.senderWallet, message.recipientWallet)
      };

      // Notify message handlers
      const sessionHandlers = this.messageHandlers.get(internalMessage.session_id);
      if (sessionHandlers) {
        sessionHandlers(internalMessage);
      }

      // Send acknowledgment if enabled
      if (this.config.enableAutoAck) {
        await this.sendAck(message.id, AckStatus.DELIVERED);
      }

      this.metrics.messagesReceived++;
      return createResult.success(undefined);
    } catch (error) {
      if (this.config.enableAutoAck) {
        await this.sendAck(message.id, AckStatus.FAILED);
      }
      
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Error processing chat message: ${error}`,
        'Failed to process chat message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Process acknowledgment message
   */
  async processAckMessage(message: AckMessage): Promise<Result<void>> {
    try {
      // Validate ack message
      const validationResult = protocolCodec.validateAckMessage(message);
      if (!validationResult.success) {
        return validationResult;
      }

      // Handle pending message acknowledgment
      const pendingMessage = this.pendingMessages.get(message.refMessageId);
      if (pendingMessage) {
        this.pendingMessages.delete(message.refMessageId);
        
        // Calculate latency
        const latency = Date.now() - pendingMessage.timestamp;
        this.updateLatencyMetrics(latency);

        // Notify ack handlers
        const ackHandler = this.ackHandlers.get(message.refMessageId);
        if (ackHandler) {
          ackHandler(message.status);
          this.ackHandlers.delete(message.refMessageId);
        }
      }

      this.metrics.acksReceived++;
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Error processing ack message: ${error}`,
        'Failed to process acknowledgment',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Process ping message
   */
  async processPingMessage(message: any): Promise<Result<void>> {
    try {
      // Respond with pong
      const pongMessage = MessageFactory.pong(message.id, message.data);
      
      // Send pong message through transport
      const encodeResult = protocolCodec.encodeMessage(pongMessage);
      if (encodeResult.success) {
        // TODO: Send through transport - this requires transport instance
        // For now, log the pong message
        console.log('[MessageHandler] Sending pong response:', pongMessage);
        this.metrics.acksSent++;
      }
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Error processing ping message: ${error}`,
        'Failed to process ping message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Process pong message
   */
  async processPongMessage(message: any): Promise<Result<void>> {
    try {
      // Calculate round-trip time and update connection metrics
      const rtt = Date.now() - (message.timestamp || Date.now());
      this.updateLatencyMetrics(rtt);
      
      // Implement connection quality tracking
      this.updateConnectionQuality(rtt);
      
      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Error processing pong message: ${error}`,
        'Failed to process pong message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Process read receipt message
   */
  async processReadReceipt(message: ReadReceipt): Promise<Result<void>> {
    try {
      // Validate read receipt message
      const validationResult = protocolCodec.validateReadReceipt(message);
      if (!validationResult.success) {
        return validationResult;
      }

      console.log(`[MessageHandler] Received read receipt for message ${message.messageId} from ${message.readerWallet}`);
      
      // Call specific read receipt handler if registered
      const readReceiptHandler = this.readReceiptHandlers.get(message.messageId);
      if (readReceiptHandler) {
        readReceiptHandler(message);
        this.readReceiptHandlers.delete(message.messageId);
      }

      // Create status update to notify UI
      if (this.onStatusUpdate) {
        const statusUpdate: MessageStatusUpdate = {
          messageId: message.messageId,
          sessionId: message.sessionId,
          status: message.status === 'read' ? MessageStatus.READ : MessageStatus.DELIVERED,
          timestamp: message.timestamp,
          userId: message.readerWallet
        };

        this.onStatusUpdate(statusUpdate);
      }

      return createResult.success(undefined);
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Error processing read receipt: ${error}`,
        'Failed to process read receipt',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Send a message and track for acknowledgment
   */
  async sendMessage(
    message: ChatMessage,
    ackHandler?: (status: AckStatus) => void
  ): Promise<Result<Uint8Array>> {
    try {
      // Validate message before sending
      const validationResult = protocolCodec.validateChatMessage(message);
      if (!validationResult.success) {
        return createResult.error(validationResult.error!);
      }

      // Create protocol message
      const protocolMessage: ProtocolMessage = {
        type: 'chat',
        version: 1,
        timestamp: Date.now(),
        payload: message
      };

      // Encode message
      const encodeResult = protocolCodec.encodeMessage(protocolMessage);
      if (!encodeResult.success) {
        return createResult.error(encodeResult.error!);
      }

      // Track pending message for acknowledgment
      this.pendingMessages.set(message.id, {
        message,
        timestamp: Date.now(),
        retries: 0
      });

      // Set up ack handler
      if (ackHandler) {
        this.ackHandlers.set(message.id, ackHandler);
      }

      // Set up timeout for retry logic
      setTimeout(() => {
        this.handleMessageTimeout(message.id);
      }, this.config.messageTimeout);

      this.metrics.messagesSent++;
      return encodeResult;
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Error sending message: ${error}`,
        'Failed to send message',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Register a handler for incoming messages
   */
  registerMessageHandler(sessionId: string, handler: (message: Message) => void): void {
    this.messageHandlers.set(sessionId, handler);
  }

  /**
   * Unregister a message handler
   */
  unregisterMessageHandler(sessionId: string): void {
    this.messageHandlers.delete(sessionId);
  }

  /**
   * Get current metrics
   */
  getMetrics(): MessageMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      acksSent: 0,
      acksReceived: 0,
      failedMessages: 0,
      averageLatency: 0
    };
  }

  /**
   * Register a handler for read receipts for a specific message
   */
  registerReadReceiptHandler(messageId: string, handler: (readReceipt: ReadReceipt) => void): void {
    this.readReceiptHandlers.set(messageId, handler);
  }

  /**
   * Unregister a read receipt handler
   */
  unregisterReadReceiptHandler(messageId: string): void {
    this.readReceiptHandlers.delete(messageId);
  }

  /**
   * Cleanup and stop heartbeat
   */
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.pendingMessages.clear();
    this.messageHandlers.clear();
    this.ackHandlers.clear();
    this.readReceiptHandlers.clear();
  }

  /**
   * Send acknowledgment message
   */
  private async sendAck(messageId: string, status: AckStatus): Promise<void> {
    try {
      const ackMessage = MessageFactory.ack(messageId, status);
      const encodeResult = protocolCodec.encodeMessage(ackMessage);
      
      if (encodeResult.success) {
        // Send through transport
        console.log('[MessageHandler] Sending ack:', { messageId, status });
        // TODO: Send through transport - requires transport instance injection
        this.metrics.acksSent++;
      }
    } catch (error) {
      console.error('Failed to send ack:', error);
    }
  }

  /**
   * Handle message timeout and retry logic
   */
  private handleMessageTimeout(messageId: string): void {
    const pendingMessage = this.pendingMessages.get(messageId);
    if (!pendingMessage) return;

    if (pendingMessage.retries < this.config.maxRetries) {
      // Retry message
      pendingMessage.retries++;
      pendingMessage.timestamp = Date.now();
      
      // Resend message through transport
      console.log(`[MessageHandler] Retrying message ${messageId} (attempt ${pendingMessage.retries}/${this.config.maxRetries})`);
      // TODO: Resend message through transport - requires transport instance injection
      
      // Set up next timeout
      setTimeout(() => {
        this.handleMessageTimeout(messageId);
      }, this.config.messageTimeout * Math.pow(2, pendingMessage.retries));
    } else {
      // Max retries reached, mark as failed
      this.pendingMessages.delete(messageId);
      this.metrics.failedMessages++;
      
      const ackHandler = this.ackHandlers.get(messageId);
      if (ackHandler) {
        ackHandler(AckStatus.FAILED);
        this.ackHandlers.delete(messageId);
      }
    }
  }

  /**
   * Start heartbeat for connection monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      // Send ping message
      const pingMessage = MessageFactory.ping();
      const encodeResult = protocolCodec.encodeMessage(pingMessage);
      
      if (encodeResult.success) {
        // TODO: Send through transport
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    // Simple moving average
    const totalMessages = this.metrics.acksReceived;
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (totalMessages - 1) + latency) / totalMessages;
  }

  /**
   * Generate session ID from wallet addresses
   */
  private generateSessionId(wallet1: string, wallet2: string): string {
    const sortedWallets = [wallet1, wallet2].sort();
    return `session_${sortedWallets[0].slice(0, 8)}_${sortedWallets[1].slice(0, 8)}`;
  }

  /**
   * Update connection quality based on RTT measurements
   */
  private updateConnectionQuality(rtt: number): void {
    // Define quality thresholds
    const EXCELLENT_RTT = 50;  // < 50ms
    const GOOD_RTT = 100;      // < 100ms
    const FAIR_RTT = 200;      // < 200ms
    const POOR_RTT = 500;      // < 500ms

    let quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';

    if (rtt < EXCELLENT_RTT) {
      quality = 'excellent';
    } else if (rtt < GOOD_RTT) {
      quality = 'good';
    } else if (rtt < FAIR_RTT) {
      quality = 'fair';
    } else if (rtt < POOR_RTT) {
      quality = 'poor';
    } else {
      quality = 'unusable';
    }

    // Log quality changes for monitoring
    console.log(`[MessageHandler] Connection quality: ${quality} (RTT: ${rtt}ms)`);

    // Update metrics with quality information
    if (!this.metrics.connectionQuality) {
      this.metrics.connectionQuality = {
        current: quality,
        rttHistory: [],
        qualityHistory: []
      };
    }

    this.metrics.connectionQuality.current = quality;
    this.metrics.connectionQuality.rttHistory.push({
      timestamp: Date.now(),
      rtt
    });

    // Keep only last 100 measurements
    if (this.metrics.connectionQuality.rttHistory.length > 100) {
      this.metrics.connectionQuality.rttHistory.shift();
    }

    // Calculate average RTT over last 10 measurements
    const recentRtts = this.metrics.connectionQuality.rttHistory.slice(-10);
    const avgRtt = recentRtts.reduce((sum, measurement) => sum + measurement.rtt, 0) / recentRtts.length;
    this.metrics.averageLatency = avgRtt;
  }
}