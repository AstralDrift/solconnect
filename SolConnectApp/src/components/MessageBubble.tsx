import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message, MessageStatus } from '../types';
import { ReactionSummary } from '../types/chat';
import { MessageStatusIndicator } from './MessageStatusIndicator';
import { MessageReactions } from './MessageReactions';
import { EmojiPicker } from './EmojiPicker';
import { getMessageBus } from '../services/MessageBus';
import { getUserSettingsService } from '../services/UserSettings';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showStatusIndicator?: boolean;
  theme?: 'light' | 'dark';
  currentUserAddress?: string;
  sessionId?: string;
  showReactions?: boolean;
}

export function MessageBubble({ 
  message, 
  isOwnMessage, 
  showStatusIndicator = true,
  theme = 'light',
  currentUserAddress,
  sessionId,
  showReactions = true
}: MessageBubbleProps): JSX.Element {
  const [reactions, setReactions] = useState<ReactionSummary[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoadingReactions, setIsLoadingReactions] = useState(false);
  const [hasBeenSeen, setHasBeenSeen] = useState(false);

  useEffect(() => {
    if (showReactions && message.id && currentUserAddress) {
      loadReactions();
    }
  }, [message.id, currentUserAddress, showReactions]);

  // Auto-send read receipt when message becomes visible
  useEffect(() => {
    const shouldSendReadReceipt = 
      !isOwnMessage && // Only for messages from others
      message.id && 
      sessionId && 
      currentUserAddress && 
      !hasBeenSeen && // Only send once
      message.status !== 'read'; // Don't send if already read

    if (shouldSendReadReceipt) {
      const sendReadReceipt = async () => {
        try {
          // Check user privacy settings before sending read receipt
          const userSettings = getUserSettingsService();
          if (!userSettings.shouldSendReadReceipts()) {
            console.log('Read receipts disabled by user settings');
            setHasBeenSeen(true); // Mark as seen but don't send receipt
            return;
          }

          const messageBus = getMessageBus();
          await messageBus.sendReadReceipt(sessionId, message.id!, 'read');
          setHasBeenSeen(true);
        } catch (error) {
          console.error('Error sending read receipt:', error);
        }
      };

      // Send read receipt with a small delay to ensure message is actually visible
      const timer = setTimeout(sendReadReceipt, 500);
      return () => clearTimeout(timer);
    }
  }, [isOwnMessage, message.id, message.status, sessionId, currentUserAddress, hasBeenSeen]);

  const loadReactions = async () => {
    if (!message.id || !currentUserAddress) return;

    try {
      setIsLoadingReactions(true);
      const messageBus = getMessageBus();
      const result = await messageBus.getMessageReactions(message.id, currentUserAddress);
      
      if (result.success) {
        setReactions(result.data || []);
      }
    } catch (error) {
      console.error('Error loading reactions:', error);
    } finally {
      setIsLoadingReactions(false);
    }
  };

  const handleEmojiSelect = async (emoji: string) => {
    if (!message.id || !sessionId || !currentUserAddress) return;

    try {
      const messageBus = getMessageBus();
      await messageBus.addReaction(message.id, sessionId, currentUserAddress, emoji);
      // Reactions will be updated via the MessageReactions component's event listener
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

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
              readByUserAddress={message.status === 'read' ? currentUserAddress : undefined}
              showReadReceipts={getUserSettingsService().shouldSendReadReceipts()}
            />
          </View>
        )}
      </View>

      {/* Reactions */}
      {showReactions && currentUserAddress && sessionId && message.id && (
        <MessageReactions
          messageId={message.id}
          sessionId={sessionId}
          currentUserAddress={currentUserAddress}
          reactions={reactions}
          theme={theme}
          onEmojiPickerOpen={() => setShowEmojiPicker(true)}
        />
      )}

      {/* Emoji Picker Modal */}
      {currentUserAddress && (
        <EmojiPicker
          visible={showEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
          currentUserAddress={currentUserAddress}
          theme={theme}
        />
      )}
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