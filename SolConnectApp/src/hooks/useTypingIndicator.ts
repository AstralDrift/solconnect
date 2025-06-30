/**
 * React hook for managing typing indicators
 * Handles input detection, throttling, and automatic cleanup
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { getMessageBus } from '../services/MessageBus';
import { getUserSettingsService } from '../services/UserSettings';
import { TypingIndicatorEvent } from '../types/typing';

interface UseTypingIndicatorProps {
  sessionId: string;
  enabled?: boolean;
}

interface TypingIndicatorHook {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  isTyping: boolean;
  typingUsers: string[];
  isAnyoneTyping: boolean;
  startTyping: () => void;
  stopTyping: () => void;
}

/**
 * Hook for managing typing indicators on input elements
 */
export function useTypingIndicator({ 
  sessionId, 
  enabled = true 
}: UseTypingIndicatorProps): TypingIndicatorHook {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastEventTimeRef = useRef<number>(0);

  const messageBus = getMessageBus();
  const userSettings = getUserSettingsService();

  // Throttle delay for typing events (1 second)
  const THROTTLE_DELAY = 1000;
  
  // Auto-stop delay when user stops typing (3 seconds)
  const AUTO_STOP_DELAY = 3000;

  /**
   * Start typing indicator
   */
  const startTyping = useCallback(async () => {
    if (!enabled || !sessionId) return;
    
    // Check privacy settings
    if (!userSettings.shouldShowTypingIndicators()) {
      return;
    }

    // Throttle typing events
    const now = Date.now();
    if (now - lastEventTimeRef.current < THROTTLE_DELAY) {
      return;
    }

    try {
      const result = await messageBus.startTyping(sessionId);
      if (result.success) {
        setIsTyping(true);
        lastEventTimeRef.current = now;
      }
    } catch (error) {
      console.error('Failed to start typing indicator:', error);
    }
  }, [enabled, sessionId, messageBus, userSettings]);

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(async () => {
    if (!enabled || !sessionId || !isTyping) return;

    try {
      const result = await messageBus.stopTyping(sessionId);
      if (result.success) {
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Failed to stop typing indicator:', error);
    }
  }, [enabled, sessionId, isTyping, messageBus]);

  /**
   * Update typing users list
   */
  const updateTypingUsers = useCallback(() => {
    if (!sessionId) return;
    
    const users = messageBus.getTypingUsers(sessionId);
    setTypingUsers(users);
  }, [sessionId, messageBus]);

  /**
   * Handle input events
   */
  const handleInput = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const value = target.value;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing if has content and not already typing
    if (value.trim() && !isTyping) {
      startTyping();
    }

    // Set auto-stop timeout
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        stopTyping();
      }
    }, AUTO_STOP_DELAY);
  }, [isTyping, startTyping, stopTyping]);

  /**
   * Handle key events
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Stop typing on Enter (message send)
    if (event.key === 'Enter' && !event.shiftKey) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        stopTyping();
      }
    }
  }, [isTyping, stopTyping]);

  /**
   * Handle focus loss
   */
  const handleBlur = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      stopTyping();
    }
  }, [isTyping, stopTyping]);

  /**
   * Handle typing events from other users
   */
  const handleTypingEvent = useCallback((event: TypingIndicatorEvent) => {
    if (event.sessionId === sessionId) {
      updateTypingUsers();
    }
  }, [sessionId, updateTypingUsers]);

  // Set up input event listeners
  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement || !enabled) return;

    inputElement.addEventListener('input', handleInput);
    inputElement.addEventListener('keydown', handleKeyDown);
    inputElement.addEventListener('blur', handleBlur);

    return () => {
      inputElement.removeEventListener('input', handleInput);
      inputElement.removeEventListener('keydown', handleKeyDown);
      inputElement.removeEventListener('blur', handleBlur);
    };
  }, [enabled, handleInput, handleKeyDown, handleBlur]);

  // Set up typing event listeners
  useEffect(() => {
    if (!enabled || !sessionId) return;

    messageBus.onTypingEvent(handleTypingEvent);

    // Initial load of typing users
    updateTypingUsers();

    // Poll for typing users updates (backup for real-time events)
    const pollInterval = setInterval(updateTypingUsers, 2000);

    return () => {
      messageBus.offTypingEvent(handleTypingEvent);
      clearInterval(pollInterval);
    };
  }, [enabled, sessionId, handleTypingEvent, updateTypingUsers, messageBus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping && sessionId) {
        stopTyping();
      }
    };
  }, []);

  const isAnyoneTyping = typingUsers.length > 0;

  return {
    inputRef,
    isTyping,
    typingUsers,
    isAnyoneTyping,
    startTyping,
    stopTyping
  };
}

/**
 * Simplified hook for just getting typing users without input handling
 */
export function useTypingUsers(sessionId: string): string[] {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messageBus = getMessageBus();

  const updateTypingUsers = useCallback(() => {
    if (!sessionId) return;
    const users = messageBus.getTypingUsers(sessionId);
    setTypingUsers(users);
  }, [sessionId, messageBus]);

  const handleTypingEvent = useCallback((event: TypingIndicatorEvent) => {
    if (event.sessionId === sessionId) {
      updateTypingUsers();
    }
  }, [sessionId, updateTypingUsers]);

  useEffect(() => {
    if (!sessionId) return;

    messageBus.onTypingEvent(handleTypingEvent);
    updateTypingUsers();

    // Poll for updates
    const pollInterval = setInterval(updateTypingUsers, 2000);

    return () => {
      messageBus.offTypingEvent(handleTypingEvent);
      clearInterval(pollInterval);
    };
  }, [sessionId, handleTypingEvent, updateTypingUsers, messageBus]);

  return typingUsers;
}