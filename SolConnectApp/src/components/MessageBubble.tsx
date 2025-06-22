import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message, MessageStatus } from '../types';
import { MessageStatusIndicator } from './MessageStatusIndicator';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showStatusIndicator?: boolean;
  theme?: 'light' | 'dark';
}

export function MessageBubble({ 
  message, 
  isOwnMessage, 
  showStatusIndicator = true,
  theme = 'light'
}: MessageBubbleProps): JSX.Element {
  const getStatusTimestamp = (): string | undefined => {
    if (!message.statusTimestamps) return message.timestamp;
    
    switch (message.status) {
      case MessageStatus.READ:
        return message.statusTimestamps.readAt;
      case MessageStatus.DELIVERED:
        return message.statusTimestamps.deliveredAt;
      case MessageStatus.SENT:
        return message.statusTimestamps.sentAt;
      case MessageStatus.FAILED:
        return message.statusTimestamps.failedAt;
      default:
        return message.timestamp;
    }
  };

  const getDisplayStatus = (): MessageStatus => {
    // If message has explicit status, use it
    if (message.status) {
      return message.status;
    }
    
    // Fallback to legacy status logic for backward compatibility
    if (message.readAt) return MessageStatus.READ;
    if (message.deliveredAt) return MessageStatus.DELIVERED;
    return MessageStatus.SENT;
  };

  return (
    <View style={[
      styles.bubble,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      <Text style={[
        styles.text,
        isOwnMessage ? styles.ownMessageText : styles.otherMessageText
      ]}>
        {message.ciphertext}
      </Text>
      
      <View style={styles.metadataRow}>
        <Text style={[
          styles.timestamp,
          isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp
        ]}>
          {new Date(message.timestamp || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
        
        {/* Only show status indicator for own messages */}
        {isOwnMessage && showStatusIndicator && (
          <View style={styles.statusContainer}>
            <MessageStatusIndicator
              status={getDisplayStatus()}
              timestamp={getStatusTimestamp()}
              showTooltip={true}
              size="small"
              theme={theme}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 8,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#9945FF',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  statusContainer: {
    marginLeft: 8,
    justifyContent: 'flex-end',
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
}); 