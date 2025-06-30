/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useTypingIndicator, useTypingUsers } from '../useTypingIndicator';
import { getMessageBus } from '../../services/MessageBus';

// Mock MessageBus
jest.mock('../../services/MessageBus');

const mockMessageBus = {
  startTyping: jest.fn(),
  stopTyping: jest.fn(),
  getTypingUsers: jest.fn(),
  onTypingEvent: jest.fn(),
};

(getMessageBus as jest.Mock).mockReturnValue(mockMessageBus);

describe('useTypingIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageBus.startTyping.mockResolvedValue({ success: true });
    mockMessageBus.stopTyping.mockResolvedValue({ success: true });
  });

  it('should provide typing controls', () => {
    const { result } = renderHook(() => 
      useTypingIndicator({ sessionId: 'test-session', enabled: true })
    );

    expect(result.current.isTyping).toBe(false);
    expect(typeof result.current.handleTypingStart).toBe('function');
    expect(typeof result.current.handleTypingStop).toBe('function');
  });

  it('should start typing when handleTypingStart is called', async () => {
    const { result } = renderHook(() => 
      useTypingIndicator({ sessionId: 'test-session', enabled: true })
    );

    await act(async () => {
      await result.current.handleTypingStart();
    });

    expect(mockMessageBus.startTyping).toHaveBeenCalledWith('test-session');
    expect(result.current.isTyping).toBe(true);
  });

  it('should stop typing when handleTypingStop is called', async () => {
    const { result } = renderHook(() => 
      useTypingIndicator({ sessionId: 'test-session', enabled: true })
    );

    // Start typing first
    await act(async () => {
      await result.current.handleTypingStart();
    });

    // Then stop typing
    await act(async () => {
      await result.current.handleTypingStop();
    });

    expect(mockMessageBus.stopTyping).toHaveBeenCalledWith('test-session');
    expect(result.current.isTyping).toBe(false);
  });

  it('should not start typing when disabled', async () => {
    const { result } = renderHook(() => 
      useTypingIndicator({ sessionId: 'test-session', enabled: false })
    );

    await act(async () => {
      await result.current.handleTypingStart();
    });

    expect(mockMessageBus.startTyping).not.toHaveBeenCalled();
    expect(result.current.isTyping).toBe(false);
  });

  it('should throttle typing start calls', async () => {
    const { result } = renderHook(() => 
      useTypingIndicator({ sessionId: 'test-session', enabled: true })
    );

    // Make multiple rapid calls
    await act(async () => {
      await Promise.all([
        result.current.handleTypingStart(),
        result.current.handleTypingStart(),
        result.current.handleTypingStart(),
      ]);
    });

    // Should only call once due to throttling
    expect(mockMessageBus.startTyping).toHaveBeenCalledTimes(1);
  });

  it('should auto-stop typing after timeout', async () => {
    jest.useFakeTimers();
    
    const { result } = renderHook(() => 
      useTypingIndicator({ sessionId: 'test-session', enabled: true })
    );

    await act(async () => {
      await result.current.handleTypingStart();
    });

    expect(result.current.isTyping).toBe(true);

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3100); // Just over 3 seconds
    });

    expect(mockMessageBus.stopTyping).toHaveBeenCalledWith('test-session');
    expect(result.current.isTyping).toBe(false);

    jest.useRealTimers();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => 
      useTypingIndicator({ sessionId: 'test-session', enabled: true })
    );

    unmount();

    // Should not cause any errors
    expect(true).toBe(true);
  });
});

describe('useTypingUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageBus.getTypingUsers.mockReturnValue(['user1', 'user2']);
  });

  it('should return typing users for session', () => {
    const { result } = renderHook(() => useTypingUsers('test-session'));

    expect(result.current).toEqual(['user1', 'user2']);
    expect(mockMessageBus.getTypingUsers).toHaveBeenCalledWith('test-session');
  });

  it('should update when typing users change', () => {
    let eventHandler: ((event: any) => void) | undefined;
    mockMessageBus.onTypingEvent.mockImplementation((handler) => {
      eventHandler = handler;
      return () => {}; // unsubscribe function
    });

    const { result, rerender } = renderHook(() => useTypingUsers('test-session'));

    // Initial state
    expect(result.current).toEqual(['user1', 'user2']);

    // Simulate typing event
    mockMessageBus.getTypingUsers.mockReturnValue(['user1', 'user2', 'user3']);
    
    act(() => {
      if (eventHandler) {
        eventHandler({
          type: 'typing_start',
          sessionId: 'test-session',
          userWallet: 'user3',
          timestamp: new Date().toISOString(),
        });
      }
    });

    expect(result.current).toEqual(['user1', 'user2', 'user3']);
  });

  it('should cleanup subscription on unmount', () => {
    const unsubscribe = jest.fn();
    mockMessageBus.onTypingEvent.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useTypingUsers('test-session'));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});