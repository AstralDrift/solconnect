import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { EmojiReaction, ReactionSummary } from '../types/chat';
import { getMessageBus } from '../services/MessageBus';
import { Logger } from '../services/monitoring/Logger';

interface MessageReactionsProps {
  messageId: string;
  sessionId: string;
  currentUserAddress: string;
  reactions?: ReactionSummary[];
  theme?: 'light' | 'dark';
  onReactionPress?: (emoji: string) => void;
  onEmojiPickerOpen?: () => void;
}

interface ReactionTooltipProps {
  reaction: ReactionSummary;
  visible: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const ReactionTooltip: React.FC<ReactionTooltipProps> = ({ 
  reaction, 
  visible, 
  onClose, 
  theme 
}) => {
  if (!visible) return null;

  const themedStyles = {
    container: [
      styles.tooltipContainer,
      theme === 'dark' ? styles.tooltipContainerDark : styles.tooltipContainerLight
    ],
    text: [
      styles.tooltipText,
      theme === 'dark' ? styles.tooltipTextDark : styles.tooltipTextLight
    ]
  };

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
    >
      <TouchableOpacity 
        style={styles.tooltipOverlay} 
        onPress={onClose}
        activeOpacity={1}
      >
        <View style={themedStyles.container}>
          <Text style={styles.tooltipEmoji}>{reaction.emoji}</Text>
          <Text style={themedStyles.text}>
            {reaction.count} {reaction.count === 1 ? 'reaction' : 'reactions'}
          </Text>
          {reaction.userAddresses.length <= 3 && (
            <Text style={[themedStyles.text, styles.tooltipUsers]}>
              {reaction.userAddresses.map(addr => 
                addr.slice(0, 6) + '...' + addr.slice(-4)
              ).join(', ')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  sessionId,
  currentUserAddress,
  reactions = [],
  theme = 'light',
  onReactionPress,
  onEmojiPickerOpen
}) => {
  const [localReactions, setLocalReactions] = useState<ReactionSummary[]>(reactions);
  const [selectedReaction, setSelectedReaction] = useState<ReactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const logger = new Logger('MessageReactions');

  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  useEffect(() => {
    // Subscribe to reaction events for this message
    const messageBus = getMessageBus();
    
    const handleReactionEvent = (event: any) => {
      if (event.messageId === messageId) {
        logger.debug('Received reaction event for message', { messageId, event });
        refreshReactions();
      }
    };

    const unsubscribe = messageBus.onReactionEvent(handleReactionEvent);
    
    return () => {
      messageBus.offReactionEvent(unsubscribe);
    };
  }, [messageId]);

  const refreshReactions = async () => {
    try {
      const messageBus = getMessageBus();
      const result = await messageBus.getMessageReactions(messageId, currentUserAddress);
      
      if (result.success) {
        setLocalReactions(result.data || []);
      } else {
        logger.error('Failed to refresh reactions', result.error);
      }
    } catch (error) {
      logger.error('Error refreshing reactions', error);
    }
  };

  const handleReactionPress = async (emoji: string) => {
    if (isLoading) return;

    setIsLoading(true);
    
    try {
      const messageBus = getMessageBus();
      const result = await messageBus.addReaction(messageId, sessionId, currentUserAddress, emoji);
      
      if (result.success) {
        logger.info('Reaction toggled successfully', { 
          messageId, 
          emoji, 
          action: result.data?.action 
        });
        
        // Optimistically update the UI
        await refreshReactions();
        
        // Notify parent component
        onReactionPress?.(emoji);
      } else {
        logger.error('Failed to toggle reaction', result.error);
      }
    } catch (error) {
      logger.error('Error handling reaction press', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactionLongPress = (reaction: ReactionSummary) => {
    setSelectedReaction(reaction);
  };

  const handleAddReactionPress = () => {
    onEmojiPickerOpen?.();
  };

  const themedStyles = {
    container: [
      styles.container,
      theme === 'dark' ? styles.containerDark : styles.containerLight
    ],
    reaction: [
      styles.reaction,
      theme === 'dark' ? styles.reactionDark : styles.reactionLight
    ],
    reactionActive: [
      styles.reactionActive,
      theme === 'dark' ? styles.reactionActiveDark : styles.reactionActiveLight
    ],
    addButton: [
      styles.addReactionButton,
      theme === 'dark' ? styles.addReactionButtonDark : styles.addReactionButtonLight
    ],
    count: [
      styles.reactionCount,
      theme === 'dark' ? styles.reactionCountDark : styles.reactionCountLight
    ]
  };

  if (localReactions.length === 0) {
    return (
      <View style={themedStyles.container}>
        <TouchableOpacity 
          style={themedStyles.addButton}
          onPress={handleAddReactionPress}
          disabled={isLoading}
        >
          <Text style={styles.addReactionText}>😊+</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={themedStyles.container}>
        {localReactions.map((reaction) => (
          <TouchableOpacity
            key={reaction.emoji}
            style={[
              themedStyles.reaction,
              reaction.currentUserReacted ? themedStyles.reactionActive : null
            ]}
            onPress={() => handleReactionPress(reaction.emoji)}
            onLongPress={() => handleReactionLongPress(reaction)}
            disabled={isLoading}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={themedStyles.count}>{reaction.count}</Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity 
          style={themedStyles.addButton}
          onPress={handleAddReactionPress}
          disabled={isLoading}
        >
          <Text style={styles.addReactionText}>+</Text>
        </TouchableOpacity>
      </View>

      {selectedReaction && (
        <ReactionTooltip
          reaction={selectedReaction}
          visible={!!selectedReaction}
          onClose={() => setSelectedReaction(null)}
          theme={theme}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginHorizontal: -2,
  },
  containerLight: {
    // Light theme specific styles
  },
  containerDark: {
    // Dark theme specific styles
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 2,
    minWidth: 44,
    borderWidth: 1,
  },
  reactionLight: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  reactionDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },
  reactionActive: {
    borderWidth: 2,
  },
  reactionActiveLight: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  reactionActiveDark: {
    backgroundColor: '#1a3a5c',
    borderColor: '#64b5f6',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 12,
    textAlign: 'center',
  },
  reactionCountLight: {
    color: '#333',
  },
  reactionCountDark: {
    color: '#fff',
  },
  addReactionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 2,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addReactionButtonLight: {
    backgroundColor: 'transparent',
    borderColor: '#ccc',
  },
  addReactionButtonDark: {
    backgroundColor: 'transparent',
    borderColor: '#666',
  },
  addReactionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  
  // Tooltip styles
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    padding: 16,
    borderRadius: 12,
    maxWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipContainerLight: {
    backgroundColor: '#fff',
  },
  tooltipContainerDark: {
    backgroundColor: '#333',
  },
  tooltipEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  tooltipText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  tooltipTextLight: {
    color: '#333',
  },
  tooltipTextDark: {
    color: '#fff',
  },
  tooltipUsers: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
});

export default MessageReactions;