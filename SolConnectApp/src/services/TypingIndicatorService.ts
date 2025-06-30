/**
 * Service for managing typing indicators in SolConnect
 * Handles sending and receiving typing events with privacy controls
 */

import { 
  TypingIndicatorEvent, 
  TypingState, 
  TypingUser, 
  TypingEventHandler,
  TypingIndicatorConfig,
  DEFAULT_TYPING_CONFIG 
} from '../types/typing';
import { SolConnectError, ErrorCode, Result, createResult } from '../types/errors';
import { getUserSettingsService } from './UserSettings';
import { getMessageBus } from './MessageBus';
import { Logger } from './monitoring/Logger';

/**
 * Central service for managing typing indicators
 */
export class TypingIndicatorService {
  private logger = new Logger('TypingIndicatorService');
  private config: TypingIndicatorConfig;
  
  // State management
  private typingStates = new Map<string, TypingState>();
  private localTypingState = new Map<string, NodeJS.Timeout>();
  private typingThrottle = new Map<string, number>();
  
  // Event handlers
  private eventHandlers = new Set<TypingEventHandler>();
  
  private userWallet?: string;
  private initialized = false;

  constructor(config: Partial<TypingIndicatorConfig> = {}) {
    this.config = { ...DEFAULT_TYPING_CONFIG, ...config };
  }

  /**
   * Initialize the typing indicator service
   */
  async initialize(userWallet: string): Promise<Result<void>> {
    try {
      this.userWallet = userWallet;
      this.initialized = true;
      
      this.logger.info('TypingIndicatorService initialized', { 
        userWallet: userWallet.slice(0, 8) + '...',
        config: this.config 
      });
      
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize TypingIndicatorService', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to initialize typing service: ${error}`,
        'Unable to initialize typing indicators'
      ));
    }
  }

  /**
   * Start typing indicator for a session
   */
  async startTyping(sessionId: string): Promise<Result<void>> {
    if (!this.initialized || !this.userWallet) {
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        'TypingIndicatorService not initialized',
        'Typing service not ready'
      ));
    }

    try {
      // Check privacy settings
      const userSettings = getUserSettingsService();
      if (!userSettings.shouldShowTypingIndicators()) {
        this.logger.debug('Typing indicators disabled by user settings');
        return createResult.success(undefined);
      }

      // Throttle typing events
      const lastSent = this.typingThrottle.get(sessionId) || 0;
      const now = Date.now();
      
      if (now - lastSent < this.config.throttleInterval) {
        this.logger.debug('Typing event throttled', { sessionId });
        return createResult.success(undefined);
      }

      // Clear existing timeout
      const existingTimeout = this.localTypingState.get(sessionId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Send typing start event
      const event: TypingIndicatorEvent = {
        type: 'typing_start',
        sessionId,
        userWallet: this.userWallet,
        timestamp: new Date().toISOString()
      };

      const result = await this.sendTypingEvent(event);
      if (!result.success) {
        return result;
      }

      this.typingThrottle.set(sessionId, now);

      // Auto-stop after timeout
      const timeout = setTimeout(() => {
        this.stopTyping(sessionId);
      }, this.config.typingTimeout);

      this.localTypingState.set(sessionId, timeout);

      this.logger.debug('Started typing indicator', { sessionId });
      return createResult.success(undefined);
      
    } catch (error) {
      this.logger.error('Failed to start typing indicator', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to start typing: ${error}`,
        'Unable to send typing indicator'
      ));
    }
  }

  /**
   * Stop typing indicator for a session
   */
  async stopTyping(sessionId: string): Promise<Result<void>> {
    if (!this.initialized || !this.userWallet) {
      return createResult.success(undefined); // Silently succeed if not initialized
    }

    try {
      // Clear timeout
      const timeout = this.localTypingState.get(sessionId);
      if (timeout) {
        clearTimeout(timeout);
        this.localTypingState.delete(sessionId);
      }

      // Send stop event
      const event: TypingIndicatorEvent = {
        type: 'typing_stop',
        sessionId,
        userWallet: this.userWallet,
        timestamp: new Date().toISOString()
      };

      const result = await this.sendTypingEvent(event);
      
      this.logger.debug('Stopped typing indicator', { sessionId });
      return result;
      
    } catch (error) {
      this.logger.error('Failed to stop typing indicator', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to stop typing: ${error}`,
        'Unable to stop typing indicator'
      ));
    }
  }

  /**
   * Handle incoming typing event from remote user
   */
  handleIncomingTypingEvent(event: TypingIndicatorEvent): void {
    try {
      // Don't process our own events
      if (event.userWallet === this.userWallet) {
        return;
      }

      this.logger.debug('Handling incoming typing event', { 
        type: event.type, 
        user: event.userWallet.slice(0, 8) + '...',
        sessionId: event.sessionId 
      });

      // Get or create typing state for session
      if (!this.typingStates.has(event.sessionId)) {
        this.typingStates.set(event.sessionId, {
          sessionId: event.sessionId,
          typingUsers: new Map()
        });
      }

      const state = this.typingStates.get(event.sessionId)!;

      if (event.type === 'typing_start') {
        this.handleTypingStart(state, event);
      } else {
        this.handleTypingStop(state, event);
      }

      // Notify event handlers
      this.notifyEventHandlers(event);
      
    } catch (error) {
      this.logger.error('Error handling incoming typing event', error);
    }
  }

  /**
   * Get list of users currently typing in a session
   */
  getTypingUsers(sessionId: string): string[] {
    const state = this.typingStates.get(sessionId);
    if (!state) return [];

    const typingUsers = Array.from(state.typingUsers.entries())
      .map(([userWallet, user]) => user.username || this.formatUserWallet(userWallet))
      .slice(0, this.config.maxDisplayUsers);

    return typingUsers;
  }

  /**
   * Check if anyone is typing in a session
   */
  isAnyoneTyping(sessionId: string): boolean {
    const state = this.typingStates.get(sessionId);
    return state ? state.typingUsers.size > 0 : false;
  }

  /**
   * Subscribe to typing events
   */
  addEventListener(handler: TypingEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Unsubscribe from typing events
   */
  removeEventListener(handler: TypingEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all timeouts
    for (const timeout of this.localTypingState.values()) {
      clearTimeout(timeout);
    }
    
    // Clear all remote user timeouts
    for (const state of this.typingStates.values()) {
      for (const user of state.typingUsers.values()) {
        if (user.timeoutId) {
          clearTimeout(user.timeoutId);
        }
      }
    }

    this.localTypingState.clear();
    this.typingStates.clear();
    this.typingThrottle.clear();
    this.eventHandlers.clear();
    this.initialized = false;

    this.logger.info('TypingIndicatorService destroyed');
  }

  // Private methods

  private async sendTypingEvent(event: TypingIndicatorEvent): Promise<Result<void>> {
    try {
      const messageBus = getMessageBus();
      
      // Send via WebSocket relay
      const relayMessage = {
        type: 'typing_indicator',
        userWallet: event.userWallet,
        isTyping: event.type === 'typing_start',
        roomId: event.sessionId,
        timestamp: event.timestamp
      };

      // Use the transport's sendRawMessage for real-time events
      const transport = (messageBus as any).transport;
      if (transport && transport.sendRawMessage) {
        const result = await transport.sendRawMessage(relayMessage);
        if (!result.success) {
          return result;
        }
      }

      return createResult.success(undefined);
      
    } catch (error) {
      return createResult.error(SolConnectError.network(
        ErrorCode.MESSAGE_DELIVERY_FAILED,
        `Failed to send typing event: ${error}`,
        'Unable to send typing indicator'
      ));
    }
  }

  private handleTypingStart(state: TypingState, event: TypingIndicatorEvent): void {
    // Clear existing timeout for this user
    const existing = state.typingUsers.get(event.userWallet);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    // Set new typing state with timeout
    const timeoutId = setTimeout(() => {
      state.typingUsers.delete(event.userWallet);
      this.notifyStateChange(event.sessionId);
    }, this.config.typingTimeout + 1000); // Extra 1s buffer for network delay

    const typingUser: TypingUser = {
      userWallet: event.userWallet,
      username: this.formatUserWallet(event.userWallet),
      startedAt: new Date(event.timestamp),
      timeoutId
    };

    state.typingUsers.set(event.userWallet, typingUser);
    this.notifyStateChange(event.sessionId);
  }

  private handleTypingStop(state: TypingState, event: TypingIndicatorEvent): void {
    const user = state.typingUsers.get(event.userWallet);
    if (user?.timeoutId) {
      clearTimeout(user.timeoutId);
    }
    
    state.typingUsers.delete(event.userWallet);
    this.notifyStateChange(event.sessionId);
  }

  private notifyEventHandlers(event: TypingIndicatorEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Error in typing event handler', error);
      }
    }
  }

  private notifyStateChange(sessionId: string): void {
    // This could be extended to emit specific state change events
    // For now, we rely on the component polling getTypingUsers()
    this.logger.debug('Typing state changed', { 
      sessionId, 
      typingCount: this.typingStates.get(sessionId)?.typingUsers.size || 0 
    });
  }

  private formatUserWallet(wallet: string): string {
    return wallet.slice(0, 6) + '...' + wallet.slice(-4);
  }
}

// Global instance
let globalTypingService: TypingIndicatorService | null = null;

/**
 * Get the global typing indicator service instance
 */
export function getTypingIndicatorService(): TypingIndicatorService {
  if (!globalTypingService) {
    globalTypingService = new TypingIndicatorService();
  }
  return globalTypingService;
}

/**
 * Initialize the global typing indicator service
 */
export async function initializeTypingIndicatorService(
  userWallet: string,
  config?: Partial<TypingIndicatorConfig>
): Promise<Result<TypingIndicatorService>> {
  try {
    const service = new TypingIndicatorService(config);
    const result = await service.initialize(userWallet);
    
    if (result.success) {
      globalTypingService = service;
      return createResult.success(service);
    } else {
      return createResult.error(result.error!);
    }
  } catch (error) {
    return createResult.error(SolConnectError.system(
      ErrorCode.UNKNOWN_ERROR,
      `Failed to initialize typing service: ${error}`,
      'Unable to initialize typing indicators'
    ));
  }
}