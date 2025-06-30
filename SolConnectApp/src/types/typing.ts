/**
 * Type definitions for typing indicator functionality
 */

export interface TypingIndicatorEvent {
  type: 'typing_start' | 'typing_stop';
  sessionId: string;
  userWallet: string;
  timestamp: string;
}

export interface TypingState {
  sessionId: string;
  typingUsers: Map<string, TypingUser>;
}

export interface TypingUser {
  userWallet: string;
  username?: string;
  startedAt: Date;
  timeoutId?: NodeJS.Timeout;
}

export interface TypingEventHandler {
  (event: TypingIndicatorEvent): void;
}

export interface TypingIndicatorConfig {
  typingTimeout: number;        // ms - Auto-stop after this time
  throttleInterval: number;     // ms - Min time between events
  showMultipleUsers: boolean;   // Show multiple users typing
  maxDisplayUsers: number;      // Max users to show in indicator
}

export const DEFAULT_TYPING_CONFIG: TypingIndicatorConfig = {
  typingTimeout: 5000,        // 5 seconds
  throttleInterval: 1000,     // 1 second
  showMultipleUsers: true,
  maxDisplayUsers: 3
};