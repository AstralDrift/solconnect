/**
 * Protocol Buffers implementation for SolConnect messaging
 * Provides TypeScript interfaces and encoding/decoding for protobuf messages
 */

import { SolConnectError, ErrorCode, Result, createResult } from '../../types/errors';

// Protocol Buffer message types (generated from .proto files)
export interface ChatMessage {
  id: string;
  senderWallet: string;
  recipientWallet: string;
  timestamp: number;
  encryptedPayload: Uint8Array;
  attachmentUrl?: string;
  ttl: number;
  signature: Uint8Array;
}

export interface AckMessage {
  id: string;
  refMessageId: string;
  status: AckStatus;
}

export enum AckStatus {
  UNSPECIFIED = 0,
  DELIVERED = 1,
  FAILED = 2,
  EXPIRED = 3,
  REJECTED = 4
}

export interface ProtocolMessage {
  type: 'chat' | 'ack' | 'ping' | 'pong';
  payload: ChatMessage | AckMessage | PingMessage | PongMessage;
  version: number;
  timestamp: number;
}

export interface PingMessage {
  id: string;
  timestamp: number;
  data?: Uint8Array;
}

export interface PongMessage {
  id: string;
  refPingId: string;
  timestamp: number;
  data?: Uint8Array;
}

/**
 * Protocol Buffers encoder/decoder for SolConnect messages
 */
export class ProtocolBufferCodec {
  private readonly version = 1;

  /**
   * Create a new chat message
   */
  createChatMessage(
    senderWallet: string,
    recipientWallet: string,
    encryptedPayload: Uint8Array,
    signature: Uint8Array,
    options: {
      attachmentUrl?: string;
      ttl?: number;
    } = {}
  ): ChatMessage {
    return {
      id: this.generateMessageId(),
      senderWallet,
      recipientWallet,
      timestamp: Date.now(),
      encryptedPayload,
      attachmentUrl: options.attachmentUrl,
      ttl: options.ttl || 0,
      signature
    };
  }

  /**
   * Create an acknowledgment message
   */
  createAckMessage(refMessageId: string, status: AckStatus): AckMessage {
    return {
      id: this.generateMessageId(),
      refMessageId,
      status
    };
  }

  /**
   * Create a ping message for connection testing
   */
  createPingMessage(data?: Uint8Array): PingMessage {
    return {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      data
    };
  }

  /**
   * Create a pong response message
   */
  createPongMessage(refPingId: string, data?: Uint8Array): PongMessage {
    return {
      id: this.generateMessageId(),
      refPingId,
      timestamp: Date.now(),
      data
    };
  }

  /**
   * Encode a protocol message to binary format
   */
  encodeMessage(message: ProtocolMessage): Result<Uint8Array> {
    try {
      // For now, we'll use JSON encoding until we have proper protobuf support
      // In production, this would use the generated protobuf encoders
      const jsonString = JSON.stringify(this.messageToJson(message));
      const encoder = new TextEncoder();
      return createResult.success(encoder.encode(jsonString));
    } catch (error) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to encode message: ${error}`,
        'Failed to encode message for transmission',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Decode a binary message to protocol message
   */
  decodeMessage(data: Uint8Array): Result<ProtocolMessage> {
    try {
      // For now, we'll use JSON decoding until we have proper protobuf support
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(data);
      const jsonData = JSON.parse(jsonString);
      
      return createResult.success(this.messageFromJson(jsonData));
    } catch (error) {
      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        `Failed to decode message: ${error}`,
        'Received invalid message format',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Validate a chat message
   */
  validateChatMessage(message: ChatMessage): Result<void> {
    const errors: string[] = [];

    if (!message.id || message.id.length === 0) {
      errors.push('Message ID is required');
    }

    if (!this.isValidWalletAddress(message.senderWallet)) {
      errors.push('Invalid sender wallet address');
    }

    if (!this.isValidWalletAddress(message.recipientWallet)) {
      errors.push('Invalid recipient wallet address');
    }

    if (!message.timestamp || message.timestamp <= 0) {
      errors.push('Invalid timestamp');
    }

    if (!message.encryptedPayload || message.encryptedPayload.length === 0) {
      errors.push('Encrypted payload is required');
    }

    if (message.encryptedPayload && message.encryptedPayload.length > 1024 * 1024) { // 1MB limit
      errors.push('Message payload too large (max 1MB)');
    }

    if (!message.signature || message.signature.length === 0) {
      errors.push('Message signature is required');
    }

    if (message.ttl < 0) {
      errors.push('TTL cannot be negative');
    }

    // Check if message has expired
    if (message.ttl > 0 && (Date.now() - message.timestamp) / 1000 > message.ttl) {
      errors.push('Message has expired');
    }

    if (errors.length > 0) {
      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        `Message validation failed: ${errors.join(', ')}`,
        'Message format is invalid',
        { errors }
      ));
    }

    return createResult.success(undefined);
  }

  /**
   * Validate an acknowledgment message
   */
  validateAckMessage(message: AckMessage): Result<void> {
    const errors: string[] = [];

    if (!message.id || message.id.length === 0) {
      errors.push('Ack ID is required');
    }

    if (!message.refMessageId || message.refMessageId.length === 0) {
      errors.push('Reference message ID is required');
    }

    if (message.status === AckStatus.UNSPECIFIED) {
      errors.push('Ack status must be specified');
    }

    if (errors.length > 0) {
      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        `Ack validation failed: ${errors.join(', ')}`,
        'Acknowledgment format is invalid',
        { errors }
      ));
    }

    return createResult.success(undefined);
  }

  /**
   * Validate a read receipt message
   */
  validateReadReceipt(message: ReadReceipt): Result<void> {
    const errors: string[] = [];

    if (!message.id || message.id.length === 0) {
      errors.push('Read receipt ID is required');
    }

    if (!message.messageId || message.messageId.length === 0) {
      errors.push('Reference message ID is required');
    }

    if (!this.isValidWalletAddress(message.readerWallet)) {
      errors.push('Invalid reader wallet address');
    }

    if (!message.timestamp || message.timestamp <= 0) {
      errors.push('Invalid timestamp');
    }

    if (errors.length > 0) {
      return createResult.error(SolConnectError.validation(
        ErrorCode.INVALID_MESSAGE_FORMAT,
        `Read receipt validation failed: ${errors.join(', ')}`,
        'Read receipt format is invalid',
        { errors }
      ));
    }

    return createResult.success(undefined);
  };