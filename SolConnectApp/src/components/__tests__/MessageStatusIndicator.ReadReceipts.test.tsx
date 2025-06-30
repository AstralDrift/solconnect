/**
 * Tests for MessageStatusIndicator read receipt functionality
 * Tests visual indicators, animations, and read receipt display
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MessageStatusIndicator, getNextStatus, canTransitionTo, getStatusPriority } from '../MessageStatusIndicator';
import { MessageStatus } from '../../types';

describe('MessageStatusIndicator Read Receipts', () => {
  const defaultProps = {
    status: MessageStatus.SENT,
    timestamp: '2023-01-01T12:00:00Z',
    showTooltip: false,
    size: 'small' as const,
    theme: 'light' as const,
    showReadReceipts: true
  };

  describe('Read Receipt Visual Indicators', () => {
    it('should show eye icon for read status when read receipts are enabled', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showReadReceipts={true}
        />
      );

      const iconText = container.querySelector('.iconText');
      expect(iconText).toHaveTextContent('👁');
    });

    it('should show double checkmark for read status when read receipts are disabled', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showReadReceipts={false}
        />
      );

      const iconText = container.querySelector('.iconText');
      expect(iconText).toHaveTextContent('✓✓');
    });

    it('should show appropriate icons for all status types', () => {
      const statusIcons = [
        { status: MessageStatus.SENDING, expectedIcon: '⏳' },
        { status: MessageStatus.SENT, expectedIcon: '✓' },
        { status: MessageStatus.DELIVERED, expectedIcon: '✓✓' },
        { status: MessageStatus.FAILED, expectedIcon: '❌' }
      ];

      statusIcons.forEach(({ status, expectedIcon }) => {
        const { container } = render(
          <MessageStatusIndicator
            {...defaultProps}
            status={status}
          />
        );

        const iconText = container.querySelector('.iconText');
        expect(iconText).toHaveTextContent(expectedIcon);
      });
    });

    it('should use correct colors for read status with read receipts', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showReadReceipts={true}
          theme="light"
        />
      );

      const iconText = container.querySelector('.iconText');
      expect(iconText).toHaveStyle('color: #2196F3'); // Blue for read with receipts
    });

    it('should use correct colors for read status without read receipts', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showReadReceipts={false}
          theme="light"
        />
      );

      const iconText = container.querySelector('.iconText');
      expect(iconText).toHaveStyle('color: #4CAF50'); // Green for read without receipts
    });

    it('should adapt colors for dark theme', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showReadReceipts={true}
          theme="dark"
        />
      );

      const iconText = container.querySelector('.iconText');
      expect(iconText).toHaveStyle('color: #64B5F6'); // Light blue for dark theme
    });
  });

  describe('Read Receipt Animations', () => {
    it('should trigger special animation for read status with read receipts', async () => {
      const { container, rerender } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.DELIVERED}
          showReadReceipts={true}
        />
      );

      // Change to read status to trigger animation
      rerender(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showReadReceipts={true}
        />
      );

      // Animation should be applied (checking for the animated view)
      const animatedView = container.querySelector('[style*="opacity"]');
      expect(animatedView).toBeInTheDocument();
    });

    it('should trigger standard animation for other status changes', async () => {
      const { container, rerender } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.SENT}
        />
      );

      // Change to delivered status
      rerender(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.DELIVERED}
        />
      );

      // Animation should be applied
      const animatedView = container.querySelector('[style*="opacity"]');
      expect(animatedView).toBeInTheDocument();
    });
  });

  describe('Read Receipt Tooltips', () => {
    it('should show read receipt information in tooltip', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showTooltip={true}
          showReadReceipts={true}
          readByUserAddress="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
        />
      );

      // Click to show tooltip
      const indicator = container.querySelector('[role="image"]');
      fireEvent.click(indicator!);

      const tooltip = container.querySelector('.tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('Read');
      expect(tooltip).toHaveTextContent('9WzDX...AWWm'); // Shortened address
    });

    it('should show "Read receipt received" subtext for read status', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showTooltip={true}
          showReadReceipts={true}
        />
      );

      // Click to show tooltip
      const indicator = container.querySelector('[role="image"]');
      fireEvent.click(indicator!);

      const tooltip = container.querySelector('.tooltip');
      expect(tooltip).toHaveTextContent('Read receipt received');
    });

    it('should include timestamp in tooltip when provided', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showTooltip={true}
          timestamp="2023-01-01T12:30:00Z"
        />
      );

      // Click to show tooltip
      const indicator = container.querySelector('[role="image"]');
      fireEvent.click(indicator!);

      const tooltip = container.querySelector('.tooltip');
      expect(tooltip).toHaveTextContent('12:30'); // Formatted time
    });

    it('should hide tooltip on second click', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showTooltip={true}
        />
      );

      const indicator = container.querySelector('[role="image"]');
      
      // Click to show tooltip
      fireEvent.click(indicator!);
      expect(container.querySelector('.tooltip')).toBeInTheDocument();
      
      // Click again to hide tooltip
      fireEvent.click(indicator!);
      expect(container.querySelector('.tooltip')).not.toBeInTheDocument();
    });

    it('should adapt tooltip styling for dark theme', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showTooltip={true}
          theme="dark"
        />
      );

      // Click to show tooltip
      const indicator = container.querySelector('[role="image"]');
      fireEvent.click(indicator!);

      const tooltip = container.querySelector('.tooltip');
      expect(tooltip).toHaveClass('tooltipDark');
      
      const tooltipText = container.querySelector('.tooltipText');
      expect(tooltipText).toHaveClass('tooltipTextDark');
    });
  });

  describe('Size and Responsive Behavior', () => {
    it('should apply correct size styles for different sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      const expectedFontSizes = [12, 14, 16];

      sizes.forEach((size, index) => {
        const { container } = render(
          <MessageStatusIndicator
            {...defaultProps}
            size={size}
          />
        );

        const iconText = container.querySelector('.iconText');
        expect(iconText).toHaveStyle(`font-size: ${expectedFontSizes[index]}px`);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility attributes', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          timestamp="2023-01-01T12:00:00Z"
        />
      );

      const indicator = container.querySelector('[role="image"]');
      expect(indicator).toHaveAttribute('role', 'image');
      expect(indicator).toHaveAttribute('accessible', 'true');
      expect(indicator).toHaveAttribute('accessibilityLabel', 'Message Read at 2023-01-01T12:00:00Z');
    });

    it('should update accessibility label based on status', () => {
      const { container, rerender } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.SENT}
        />
      );

      let indicator = container.querySelector('[role="image"]');
      expect(indicator).toHaveAttribute('accessibilityLabel', expect.stringContaining('Sent'));

      rerender(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
        />
      );

      indicator = container.querySelector('[role="image"]');
      expect(indicator).toHaveAttribute('accessibilityLabel', expect.stringContaining('Read'));
    });
  });

  describe('Utility Functions', () => {
    describe('getNextStatus', () => {
      it('should return correct next status in flow', () => {
        expect(getNextStatus(MessageStatus.SENDING)).toBe(MessageStatus.SENT);
        expect(getNextStatus(MessageStatus.SENT)).toBe(MessageStatus.DELIVERED);
        expect(getNextStatus(MessageStatus.DELIVERED)).toBe(MessageStatus.READ);
        expect(getNextStatus(MessageStatus.READ)).toBe(null);
        expect(getNextStatus(MessageStatus.FAILED)).toBe(null);
      });
    });

    describe('canTransitionTo', () => {
      it('should validate valid status transitions', () => {
        expect(canTransitionTo(MessageStatus.SENDING, MessageStatus.SENT)).toBe(true);
        expect(canTransitionTo(MessageStatus.SENT, MessageStatus.DELIVERED)).toBe(true);
        expect(canTransitionTo(MessageStatus.DELIVERED, MessageStatus.READ)).toBe(true);
        expect(canTransitionTo(MessageStatus.FAILED, MessageStatus.SENDING)).toBe(true); // Retry
      });

      it('should reject invalid status transitions', () => {
        expect(canTransitionTo(MessageStatus.READ, MessageStatus.DELIVERED)).toBe(false);
        expect(canTransitionTo(MessageStatus.SENT, MessageStatus.SENDING)).toBe(false);
        expect(canTransitionTo(MessageStatus.READ, MessageStatus.SENT)).toBe(false);
      });
    });

    describe('getStatusPriority', () => {
      it('should return correct priority order', () => {
        expect(getStatusPriority(MessageStatus.FAILED)).toBe(0); // Highest priority
        expect(getStatusPriority(MessageStatus.SENDING)).toBe(1);
        expect(getStatusPriority(MessageStatus.SENT)).toBe(2);
        expect(getStatusPriority(MessageStatus.DELIVERED)).toBe(3);
        expect(getStatusPriority(MessageStatus.READ)).toBe(4); // Lowest priority
      });

      it('should allow sorting by priority', () => {
        const statuses = [
          MessageStatus.READ,
          MessageStatus.FAILED,
          MessageStatus.SENT,
          MessageStatus.DELIVERED,
          MessageStatus.SENDING
        ];

        const sorted = statuses.sort((a, b) => getStatusPriority(a) - getStatusPriority(b));
        
        expect(sorted).toEqual([
          MessageStatus.FAILED,
          MessageStatus.SENDING,
          MessageStatus.SENT,
          MessageStatus.DELIVERED,
          MessageStatus.READ
        ]);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined status gracefully', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={undefined as any}
        />
      );

      const iconText = container.querySelector('.iconText');
      expect(iconText).toHaveTextContent(''); // Should show empty for unknown status
    });

    it('should handle missing timestamp', () => {
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showTooltip={true}
          timestamp={undefined}
        />
      );

      // Should still render without crashing
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should handle very long user addresses in tooltip', () => {
      const longAddress = 'A'.repeat(100);
      const { container } = render(
        <MessageStatusIndicator
          {...defaultProps}
          status={MessageStatus.READ}
          showTooltip={true}
          readByUserAddress={longAddress}
          showReadReceipts={true}
        />
      );

      // Click to show tooltip
      const indicator = container.querySelector('[role="image"]');
      fireEvent.click(indicator!);

      const tooltip = container.querySelector('.tooltip');
      // Should truncate long addresses
      expect(tooltip).toHaveTextContent('AAAAAA...AAAA');
    });
  });
});