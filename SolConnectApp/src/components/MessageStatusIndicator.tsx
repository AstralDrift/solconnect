import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MessageStatus } from '../types';

interface MessageStatusIndicatorProps {
  status: MessageStatus;
  timestamp?: string;
  showTooltip?: boolean;
  size?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
}

export function MessageStatusIndicator({
  status,
  timestamp,
  showTooltip = false,
  size = 'small',
  theme = 'light'
}: MessageStatusIndicatorProps): JSX.Element {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const [shouldShowTooltip, setShouldShowTooltip] = React.useState(false);

  React.useEffect(() => {
    // Animate the status indicator when status changes
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, animatedValue]);

  const getStatusIcon = (): string => {
    switch (status) {
      case MessageStatus.SENDING:
        return '⏳'; // Clock icon for sending
      case MessageStatus.SENT:
        return '✓'; // Single checkmark for sent
      case MessageStatus.DELIVERED:
        return '✓✓'; // Double checkmark for delivered
      case MessageStatus.READ:
        return '✓✓'; // Double checkmark with color change for read
      case MessageStatus.FAILED:
        return '⚠️'; // Warning icon for failed
      default:
        return '';
    }
  };

  const getStatusColor = (): string => {
    const colors = {
      light: {
        [MessageStatus.SENDING]: '#999999',
        [MessageStatus.SENT]: '#999999',
        [MessageStatus.DELIVERED]: '#4CAF50',
        [MessageStatus.READ]: '#2196F3',
        [MessageStatus.FAILED]: '#F44336',
      },
      dark: {
        [MessageStatus.SENDING]: '#CCCCCC',
        [MessageStatus.SENT]: '#CCCCCC',
        [MessageStatus.DELIVERED]: '#81C784',
        [MessageStatus.READ]: '#64B5F6',
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
      [MessageStatus.READ]: 'Read',
      [MessageStatus.FAILED]: 'Failed to send',
    };
    
    return statusTexts[status] || 'Unknown';
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
      
      {shouldShowTooltip && timestamp && (
        <View style={[styles.tooltip, theme === 'dark' && styles.tooltipDark]}>
          <Text style={[styles.tooltipText, theme === 'dark' && styles.tooltipTextDark]}>
            {getStatusText()}
            {timestamp && ` • ${new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}`}
          </Text>
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