import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MessageStatus } from '../types';

interface MessageStatusIndicatorProps {
  status: MessageStatus;
  timestamp?: string;
  showTooltip?: boolean;
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
  readByUserAddress?: string; // Wallet address of user who read the message
  showReadReceipts?: boolean; // Whether to show enhanced read receipt info
}

export function MessageStatusIndicator({
  status,
  timestamp,
  showTooltip = false,
  size = 'small',
  theme = 'light',
  readByUserAddress,
  showReadReceipts = true
}: MessageStatusIndicatorProps): JSX.Element {
  const animatedValue = React.useRef(new Animated.Value(1)).current;
  const [shouldShowTooltip, setShouldShowTooltip] = React.useState(false);

  React.useEffect(() => {
    // Enhanced animation for read receipt transitions
    if (status === MessageStatus.READ && showReadReceipts) {
      // Special animation for read receipts - pulse effect
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Standard animation for other status changes
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status, animatedValue, showReadReceipts]);

  const getStatusIcon = (): string => {
    switch (status) {
      case MessageStatus.SENDING:
        return '⏳'; // Clock icon for sending
      case MessageStatus.SENT:
        return '✓'; // Single checkmark for sent
      case MessageStatus.DELIVERED:
        return '✓✓'; // Double checkmark for delivered (gray)
      case MessageStatus.READ:
        return showReadReceipts ? '👁' : '✓✓'; // Eye icon for read receipts or double checkmark
      case MessageStatus.FAILED:
        return '❌'; // X mark for failed (more visible than warning)
      default:
        return '';
    }
  };

  const getStatusColor = (): string => {
    const colors = {
      light: {
        [MessageStatus.SENDING]: '#999999',
        [MessageStatus.SENT]: '#999999',
        [MessageStatus.DELIVERED]: '#4CAF50', // Green for delivered
        [MessageStatus.READ]: showReadReceipts ? '#2196F3' : '#4CAF50', // Blue for read with receipts
        [MessageStatus.FAILED]: '#F44336',
      },
      dark: {
        [MessageStatus.SENDING]: '#CCCCCC',
        [MessageStatus.SENT]: '#CCCCCC',
        [MessageStatus.DELIVERED]: '#81C784', // Light green for delivered
        [MessageStatus.READ]: showReadReceipts ? '#64B5F6' : '#81C784', // Light blue for read with receipts
        [MessageStatus.FAILED]: '#EF5350',
      }
    };
    
    return colors[theme][status] || colors[theme][MessageStatus.SENT];
  };

  const getStatusText = (): string => {
    const statusTexts = {
      [MessageStatus.SENDING]: 'Sending...',
      [MessageStatus.SENT]: 'Sent',
      [MessageStatus.DELIVERED]: 'Delivered',
      [MessageStatus.READ]: showReadReceipts ? 'Read' : 'Delivered',
      [MessageStatus.FAILED]: 'Failed to send',
    };
    
    return statusTexts[status] || 'Unknown';
  };

  const getReadReceiptInfo = (): string => {
    if (status === MessageStatus.READ && readByUserAddress && showReadReceipts) {
      const shortAddress = `${readByUserAddress.slice(0, 6)}...${readByUserAddress.slice(-4)}`;
      return ` by ${shortAddress}`;
    }
    return '';
  };

  const getSizeStyles = () => {
    const sizes = {
      small: { fontSize: 10, iconSize: 12 },
      medium: { fontSize: 12, iconSize: 14 },
      large: { fontSize: 14, iconSize: 16 },
    };
    return sizes[size];
  };

  const sizeStyles = getSizeStyles();

  const handlePress = () => {
    if (showTooltip) {
      setShouldShowTooltip(!shouldShowTooltip);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.indicator,
          {
            opacity: animatedValue,
            transform: [{
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            }],
          },
        ]}
        accessible={true}
        accessibilityLabel={`Message ${getStatusText()}${timestamp ? ` at ${timestamp}` : ''}`}
        accessibilityRole="image"
        onTouchEnd={handlePress}
      >
        <Text
          style={[
            styles.iconText,
            {
              color: getStatusColor(),
              fontSize: sizeStyles.iconSize,
            },
          ]}
        >
          {getStatusIcon()}
        </Text>
      </Animated.View>
      
      {shouldShowTooltip && (
        <View style={[styles.tooltip, theme === 'dark' && styles.tooltipDark]}>
          <Text style={[styles.tooltipText, theme === 'dark' && styles.tooltipTextDark]}>
            {getStatusText()}{getReadReceiptInfo()}
            {timestamp && ` • ${new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}`}
          </Text>
          {status === MessageStatus.READ && showReadReceipts && (
            <Text style={[styles.tooltipSubtext, theme === 'dark' && styles.tooltipSubtextDark]}>
              Read receipt received
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    minWidth: 16,
    minHeight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    bottom: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
    alignItems: 'center',
    zIndex: 1000,
  },
  tooltipDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  tooltipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  tooltipTextDark: {
    color: 'black',
  },
  tooltipSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 8,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  tooltipSubtextDark: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
});

// Export utility functions for status management
export const getNextStatus = (currentStatus: MessageStatus): MessageStatus | null => {
  const statusFlow = {
    [MessageStatus.SENDING]: MessageStatus.SENT,
    [MessageStatus.SENT]: MessageStatus.DELIVERED,
    [MessageStatus.DELIVERED]: MessageStatus.READ,
    [MessageStatus.READ]: null,
    [MessageStatus.FAILED]: null,
  };
  
  return statusFlow[currentStatus] || null;
};

export const canTransitionTo = (from: MessageStatus, to: MessageStatus): boolean => {
  const validTransitions = {
    [MessageStatus.SENDING]: [MessageStatus.SENT, MessageStatus.FAILED],
    [MessageStatus.SENT]: [MessageStatus.DELIVERED, MessageStatus.FAILED],
    [MessageStatus.DELIVERED]: [MessageStatus.READ],
    [MessageStatus.READ]: [],
    [MessageStatus.FAILED]: [MessageStatus.SENDING], // Allow retry
  };
  
  return validTransitions[from]?.includes(to) || false;
};

export const getStatusPriority = (status: MessageStatus): number => {
  const priorities = {
    [MessageStatus.FAILED]: 0,
    [MessageStatus.SENDING]: 1,
    [MessageStatus.SENT]: 2,
    [MessageStatus.DELIVERED]: 3,
    [MessageStatus.READ]: 4,
  };
  
  return priorities[status] || 0;
};