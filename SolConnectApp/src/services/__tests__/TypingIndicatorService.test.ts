/**
 * @jest-environment jsdom
 */
import { TypingIndicatorService } from '../TypingIndicatorService';
import { UserSettingsService } from '../UserSettings';
import { getLogger } from '../logger/LoggerService';
import { TypingIndicatorEvent } from '../../types/typing';

// Mock dependencies
jest.mock('../UserSettings');
jest.mock('../logger/LoggerService');

describe('TypingIndicatorService', () => {
  let service: TypingIndicatorService;
  let mockUserSettings: jest.Mocked<UserSettingsService>;
  let mockTransport: { sendTypingEvent: jest.Mock };

  beforeEach(() => {
    // Mock UserSettingsService
    mockUserSettings = {
      shouldShowTypingIndicators: jest.fn().mockReturnValue(true),
    } as any;
    (UserSettingsService as jest.Mock).mockReturnValue(mockUserSettings);

    // Mock transport
    mockTransport = {
      sendTypingEvent: jest.fn().mockResolvedValue({ success: true }),
    };

    // Mock logger
    (getLogger as jest.Mock).mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });

    service = new TypingIndicatorService();
    (service as any).transport = mockTransport;
  });

  afterEach(() => {
    service.cleanup();
    jest.clearAllMocks();
  });

  describe('startTyping', () => {
    it('should start typing successfully when privacy allows', async () => {
      const sessionId = 'test-session';
      
      const result = await service.startTyping(sessionId);
      
      expect(result.success).toBe(true);
      expect(mockTransport.sendTypingEvent).toHaveBeenCalledWith({
        type: 'typing_start',
        sessionId,
        userWallet: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('should not send typing event when privacy disabled', async () => {
      mockUserSettings.shouldShowTypingIndicators.mockReturnValue(false);
      const sessionId = 'test-session';
      
      const result = await service.startTyping(sessionId);
      
      expect(result.success).toBe(true);
      expect(mockTransport.sendTypingEvent).not.toHaveBeenCalled();
    });

    it('should throttle rapid typing events', async () => {
      const sessionId = 'test-session';
      
      // Rapid calls should be throttled
      await service.startTyping(sessionId);
      await service.startTyping(sessionId);
      await service.startTyping(sessionId);
      
      // Should only send one event due to throttling
      expect(mockTransport.sendTypingEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopTyping', () => {
    it('should stop typing successfully', async () => {
      const sessionId = 'test-session';
      
      // Start typing first
      await service.startTyping(sessionId);
      
      const result = await service.stopTyping(sessionId);
      
      expect(result.success).toBe(true);
      expect(mockTransport.sendTypingEvent).toHaveBeenCalledWith({
        type: 'typing_stop',
        sessionId,
        userWallet: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });

  describe('handleIncomingTypingEvent', () => {
    it('should process incoming typing start event', () => {
      const event: TypingIndicatorEvent = {
        type: 'typing_start',
        sessionId: 'test-session',
        userWallet: 'user123',
        timestamp: new Date().toISOString(),
      };
      
      service.handleIncomingTypingEvent(event);
      
      const typingUsers = service.getTypingUsers('test-session');
      expect(typingUsers).toContain('user123');
    });

    it('should process incoming typing stop event', () => {
      const sessionId = 'test-session';
      const userWallet = 'user123';
      
      // Start typing first
      service.handleIncomingTypingEvent({
        type: 'typing_start',
        sessionId,
        userWallet,
        timestamp: new Date().toISOString(),
      });
      
      // Stop typing
      service.handleIncomingTypingEvent({
        type: 'typing_stop',
        sessionId,
        userWallet,
        timestamp: new Date().toISOString(),
      });
      
      const typingUsers = service.getTypingUsers(sessionId);
      expect(typingUsers).not.toContain(userWallet);
    });

    it('should auto-timeout typing state', (done) => {
      const event: TypingIndicatorEvent = {
        type: 'typing_start',
        sessionId: 'test-session',
        userWallet: 'user123',
        timestamp: new Date().toISOString(),
      };
      
      service.handleIncomingTypingEvent(event);
      
      // Should have typing user initially
      expect(service.getTypingUsers('test-session')).toContain('user123');
      
      // After timeout, user should be removed
      setTimeout(() => {
        expect(service.getTypingUsers('test-session')).not.toContain('user123');
        done();
      }, 5100); // Just over the 5-second timeout
    });
  });

  describe('getTypingUsers', () => {
    it('should return empty array for unknown session', () => {
      const typingUsers = service.getTypingUsers('unknown-session');
      expect(typingUsers).toEqual([]);
    });

    it('should return typing users for session', () => {
      const sessionId = 'test-session';
      
      service.handleIncomingTypingEvent({
        type: 'typing_start',
        sessionId,
        userWallet: 'user1',
        timestamp: new Date().toISOString(),
      });
      
      service.handleIncomingTypingEvent({
        type: 'typing_start',
        sessionId,
        userWallet: 'user2',
        timestamp: new Date().toISOString(),
      });
      
      const typingUsers = service.getTypingUsers(sessionId);
      expect(typingUsers).toEqual(['user1', 'user2']);
    });
  });

  describe('event handlers', () => {
    it('should notify event handlers of typing events', () => {
      const handler = jest.fn();
      service.onTypingEvent(handler);
      
      const event: TypingIndicatorEvent = {
        type: 'typing_start',
        sessionId: 'test-session',
        userWallet: 'user123',
        timestamp: new Date().toISOString(),
      };
      
      service.handleIncomingTypingEvent(event);
      
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not notify removed event handlers', () => {
      const handler = jest.fn();
      const unsubscribe = service.onTypingEvent(handler);
      
      unsubscribe();
      
      service.handleIncomingTypingEvent({
        type: 'typing_start',
        sessionId: 'test-session',
        userWallet: 'user123',
        timestamp: new Date().toISOString(),
      });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clear all state and timers on cleanup', () => {
      const sessionId = 'test-session';
      
      // Add some state
      service.handleIncomingTypingEvent({
        type: 'typing_start',
        sessionId,
        userWallet: 'user123',
        timestamp: new Date().toISOString(),
      });
      
      expect(service.getTypingUsers(sessionId)).toHaveLength(1);
      
      service.cleanup();
      
      expect(service.getTypingUsers(sessionId)).toHaveLength(0);
    });
  });
});