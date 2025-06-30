/**
 * Integration tests for MessageBubble read receipt functionality
 * Tests automatic read receipt sending and UI integration
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import { Message, MessageStatus } from '../../types';
import { getMessageBus } from '../../services/MessageBus';
import { getUserSettingsService } from '../../services/UserSettings';

// Mock MessageBus
const mockSendReadReceipt = jest.fn();
const mockGetMessageReactions = jest.fn();
const mockAddReaction = jest.fn();

jest.mock('../../services/MessageBus', () => ({
  getMessageBus: jest.fn(() => ({
    sendReadReceipt: mockSendReadReceipt,
    getMessageReactions: mockGetMessageReactions,
    addReaction: mockAddReaction,
  }))
}));

// Mock UserSettings
const mockShouldSendReadReceipts = jest.fn();

jest.mock('../../services/UserSettings', () => ({
  getUserSettingsService: jest.fn(() => ({
    shouldSendReadReceipts: mockShouldSendReadReceipts,
  }))
}));

describe('MessageBubble Read Receipts', () => {
  const mockCurrentUserAddress = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const mockSessionId = 'test-session-123';

  const createMockMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'msg-123',
    sender_wallet: 'other-wallet-address',
    ciphertext: 'Hello, world!',
    timestamp: '2023-01-01T12:00:00Z',
    session_id: mockSessionId,
    status: MessageStatus.DELIVERED,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldSendReadReceipts.mockReturnValue(true);
    mockGetMessageReactions.mockResolvedValue({ success: true, data: [] });
    mockSendReadReceipt.mockResolvedValue({ success: true });
  });

  describe('Automatic Read Receipt Sending', () => {
    it('should send read receipt when message from other user is rendered', async () => {
      const message = createMockMessage();

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      // Wait for the 500ms delay in useEffect
      await waitFor(() => {
        expect(mockSendReadReceipt).toHaveBeenCalledWith(
          mockSessionId,
          'msg-123',
          'read'
        );
      }, { timeout: 1000 });
    });

    it('should not send read receipt for own messages', async () => {
      const message = createMockMessage({
        sender_wallet: mockCurrentUserAddress
      });

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={true}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockSendReadReceipt).not.toHaveBeenCalled();
    });

    it('should not send read receipt for messages already marked as read', async () => {
      const message = createMockMessage({
        status: MessageStatus.READ
      });

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockSendReadReceipt).not.toHaveBeenCalled();
    });

    it('should not send read receipt when user has disabled read receipts', async () => {
      mockShouldSendReadReceipts.mockReturnValue(false);
      const message = createMockMessage();

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockSendReadReceipt).not.toHaveBeenCalled();
    });

    it('should not send read receipt when missing required props', async () => {
      const message = createMockMessage();

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            // Missing currentUserAddress and sessionId
          />
        );
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockSendReadReceipt).not.toHaveBeenCalled();
    });

    it('should handle read receipt send failures gracefully', async () => {
      mockSendReadReceipt.mockResolvedValue({
        success: false,
        error: { message: 'Network error' }
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const message = createMockMessage();

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      await waitFor(() => {
        expect(mockSendReadReceipt).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Should log error but not throw
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error sending read receipt:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should only send read receipt once per message', async () => {
      const message = createMockMessage();

      const { rerender } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      // Wait for first read receipt
      await waitFor(() => {
        expect(mockSendReadReceipt).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });

      // Re-render with same message
      await act(async () => {
        rerender(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      // Should still only have been called once
      expect(mockSendReadReceipt).toHaveBeenCalledTimes(1);
    });
  });

  describe('Status Display Integration', () => {
    it('should show correct status indicator based on message status', async () => {
      const message = createMockMessage({
        status: MessageStatus.READ
      });

      const { container } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={true}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
            showStatusIndicator={true}
          />
        );
      });

      // Should show status indicator for own messages
      const statusIndicator = container.querySelector('[role="image"]');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should not show status indicator for other users messages', async () => {
      const message = createMockMessage();

      const { container } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
            showStatusIndicator={true}
          />
        );
      });

      // Should not show status indicator for messages from others
      const statusIndicator = container.querySelector('[role="image"]');
      expect(statusIndicator).not.toBeInTheDocument();
    });

    it('should pass read receipt settings to status indicator', async () => {
      mockShouldSendReadReceipts.mockReturnValue(false);
      const message = createMockMessage({
        status: MessageStatus.READ
      });

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={true}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
            showStatusIndicator={true}
          />
        );
      });

      // Verify getUserSettingsService was called to get read receipt setting
      expect(mockShouldSendReadReceipts).toHaveBeenCalled();
    });
  });

  describe('Message Content and Metadata', () => {
    it('should display message content correctly', async () => {
      const message = createMockMessage({
        ciphertext: 'Test message content'
      });

      const { getByText } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      expect(getByText('Test message content')).toBeInTheDocument();
    });

    it('should display formatted timestamp', async () => {
      const message = createMockMessage({
        timestamp: '2023-01-01T12:30:45Z'
      });

      const { getByText } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      // Should show formatted time (HH:MM format)
      expect(getByText('12:30')).toBeInTheDocument();
    });

    it('should apply correct styling for own vs other messages', async () => {
      const message = createMockMessage();

      const { container: ownContainer } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={true}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      const { container: otherContainer } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      // Own messages should have different styling
      const ownBubble = ownContainer.querySelector('.bubble');
      const otherBubble = otherContainer.querySelector('.bubble');

      expect(ownBubble).toHaveStyle('background-color: #9945FF');
      expect(otherBubble).toHaveStyle('background-color: #fff');
    });
  });

  describe('Reactions Integration', () => {
    it('should load reactions when showReactions is true', async () => {
      const message = createMockMessage();

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
            showReactions={true}
          />
        );
      });

      expect(mockGetMessageReactions).toHaveBeenCalledWith(
        message.id,
        mockCurrentUserAddress
      );
    });

    it('should not load reactions when showReactions is false', async () => {
      const message = createMockMessage();

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
            showReactions={false}
          />
        );
      });

      expect(mockGetMessageReactions).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle message without ID gracefully', async () => {
      const message = createMockMessage({
        id: undefined
      });

      await act(async () => {
        render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      // Should not attempt to send read receipt without message ID
      expect(mockSendReadReceipt).not.toHaveBeenCalled();
    });

    it('should handle missing timestamp gracefully', async () => {
      const message = createMockMessage({
        timestamp: undefined
      });

      const { container } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      // Should still render without throwing
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should handle component unmounting during read receipt send', async () => {
      const message = createMockMessage();

      const { unmount } = await act(async () => {
        return render(
          <MessageBubble
            message={message}
            isOwnMessage={false}
            currentUserAddress={mockCurrentUserAddress}
            sessionId={mockSessionId}
          />
        );
      });

      // Unmount immediately after render
      unmount();

      // Wait for potential read receipt timer
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should not crash or cause issues
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });
});