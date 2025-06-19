/**
 * WebSocket Sync Transport Adapter
 * Bridges the sync protocol with WebSocket transport
 */

import { SyncTransport } from './SyncManager';
import { AnySyncMessage } from './SyncProtocol';
import { WebSocketTransport } from '../transport/MessageTransport';
import { Result } from '../../types/errors';

export class WebSocketSyncTransport implements SyncTransport {
  constructor(private transport: WebSocketTransport) {}

  async sendSyncMessage(message: AnySyncMessage): Promise<Result<void>> {
    return this.transport.sendSyncMessage(message);
  }

  onSyncMessage(handler: (message: AnySyncMessage) => void): void {
    this.transport.onSyncMessage(handler);
  }

  isConnected(): boolean {
    return this.transport.isConnected;
  }
} 